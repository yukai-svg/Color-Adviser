import colorsys
import hashlib
import io
import json
import os
import re
import time
from collections import deque
from dotenv import load_dotenv
from google import genai
from google.genai.errors import ClientError, ServerError
from PIL import Image, ImageChops, ImageFilter, ImageOps

load_dotenv()

# diffusers / torch の遅延ロード用キャッシュ
_DIFFUSERS_PIPE = None
_DIFFUSERS_AVAILABLE = None

EXPLANATION_PROMPT_TEMPLATE = """
あなたはプロの色彩検定講師・カラーコーディネーターです。
以下の条件で作成された配色の特徴、視覚的効果、およびこのイメージに合う理由を分かりやすく日本語で解説してください。

【使用カラーパレット】
{colors}

【ユーザーの希望イメージ】
{theme}

※出力は3〜4文程度の自然な解説文のみとし、前置きや箇条書きの記号は使わないでください。
"""

DIFFUSERS_PROMPT_TEMPLATE = """
あなたはプロのイラストレーター兼AIプロンプトエンジニアです。
線画イラストを Stable Diffusion + ControlNet (Lineart) で高精度に彩色するための「英語プロンプト」と「ネガティブプロンプト」を、指定された3色とイメージから作成し、JSONのみで出力してください。

【使用カラーパレット（HEX）】
ベース色（面積大）: {c0}
メイン色（主役）: {c1}
アクセント色: {c2}

【ユーザーの希望イメージ】
{theme}

【出力JSON仕様（厳守・他の文章やマークダウン記号は不要）】
{{
  "positive_prompt": "masterpiece, best quality, anime style illustration, clean coloring, ...",
  "negative_prompt": "monochrome, greyscale, lineart only, uncolored, sketch, lowres, bad anatomy, blurry, text, watermark"
}}

【作成ルール】
- HEXコード（#FF0000など）はStable Diffusionが理解できないため、必ず具体的な英語の色名・トーン表現（例: vibrant crimson red, soft pastel sky blue, warm cream yellow）に翻訳して組み込むこと。
- ユーザーの希望イメージ（時間帯・空気感・質感・ライティング）を英語で具体的に描写すること。
- 輪郭線を保ったまま美しく塗るため、"flat color, cel shading, soft lighting, clean lineart" などの画風タグを適切に含めること。
"""


class AIClientError(Exception):
    """AI通信・処理失敗時の例外"""
    pass


def _get_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise AIClientError("GEMINI_API_KEY が .env に設定されていません。")
    return genai.Client(api_key=api_key)


def _call_with_retry(func, max_retries: int = 2, wait_sec: float = 2.0):
    """503 UNAVAILABLE（サーバー混雑）時に自動リトライするラッパー"""
    last_err = None
    for attempt in range(max_retries + 1):
        try:
            return func()
        except ServerError as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(wait_sec)
            else:
                raise AIClientError("AIサーバーが混雑しています。少し時間を置いて再度お試しください。") from e
        except ClientError:
            raise
        except Exception as e:
            raise AIClientError(f"AI通信中にエラーが発生しました: {str(e)}") from e
    raise AIClientError(str(last_err))


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return (255, 19, 10)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _generate_diffusers_prompts_with_gemini(colors: list[str], theme: str) -> tuple[str, str]:
    """
    Geminiテキストモデル（無料枠）を使って、3色のHEXコードとイメージ文から
    diffusers（ControlNet）用の英語プロンプトを生成する。
    """
    padded = list(colors) if colors else ["#FF130A"]
    while len(padded) < 3:
        padded.append(padded[0])

    default_pos = (
        "masterpiece, best quality, high quality digital illustration, clean coloring, "
        "soft shading, vibrant harmonious colors, detailed lighting"
    )
    default_neg = (
        "monochrome, greyscale, lineart only, uncolored, sketch, lowres, "
        "blurry, muddy colors, text, watermark, signature"
    )

    try:
        client = _get_client()
        prompt = DIFFUSERS_PROMPT_TEMPLATE.format(
            c0=padded[0],
            c1=padded[1],
            c2=padded[2],
            theme=theme.strip() if theme and theme.strip() else "バランスの良い鮮やかなイラスト",
        )

        def _request():
            response = client.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=prompt,
            )
            return response.text or ""

        raw_text = _call_with_retry(_request)
        match = re.search(r"\{[\s\S]*\}", raw_text)
        if not match:
            return default_pos, default_neg

        parsed = json.loads(match.group(0))
        pos = str(parsed.get("positive_prompt", default_pos)).strip()
        neg = str(parsed.get("negative_prompt", default_neg)).strip()
        print(f"[INFO] Gemini生成プロンプト: {pos}")
        return pos, neg
    except Exception as e:
        print(f"[WARN] Geminiプロンプト生成失敗のためデフォルトプロンプトを使用します: {e}")
        return default_pos, default_neg


def _get_diffusers_pipeline():
    """
    ControlNet (Lineart) + Stable Diffusion パイプラインをロードしてキャッシュする。
    初回実行時のみHugging Faceからモデルをダウンロードする。
    """
    global _DIFFUSERS_PIPE, _DIFFUSERS_AVAILABLE

    if _DIFFUSERS_AVAILABLE is False:
        return None
    if _DIFFUSERS_PIPE is not None:
        return _DIFFUSERS_PIPE

    try:
        import torch
        from diffusers import (
            ControlNetModel,
            StableDiffusionControlNetPipeline,
            UniPCMultistepScheduler,
        )

        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32

        print(f"[INFO] diffusers パイプラインを初期化中... (device={device}, dtype={dtype})")

        controlnet_id = os.getenv("CONTROLNET_MODEL_ID", "lllyasviel/control_v11p_sd15_lineart")
        base_model_id = os.getenv("SD_BASE_MODEL_ID", "runwayml/stable-diffusion-v1-5")

        controlnet = ControlNetModel.from_pretrained(controlnet_id, torch_dtype=dtype)
        pipe = StableDiffusionControlNetPipeline.from_pretrained(
            base_model_id,
            controlnet=controlnet,
            torch_dtype=dtype,
            safety_checker=None,
        )
        pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)

        if device == "cuda":
            pipe = pipe.to("cuda")
        else:
            # CPU環境でもメモリ不足で落ちにくくする最適化
            pipe.enable_attention_slicing()

        _DIFFUSERS_PIPE = pipe
        _DIFFUSERS_AVAILABLE = True
        print("[INFO] diffusers パイプラインのロード完了")
        return _DIFFUSERS_PIPE

    except Exception as e:
        print(f"[WARN] diffusers の初期化に失敗しました（Pillowフォールバックへ切り替えます）: {e}")
        _DIFFUSERS_AVAILABLE = False
        return None


def _prepare_controlnet_lineart(image: Image.Image, target_size: tuple[int, int]) -> Image.Image:
    """
    白背景・黒線の線画を ControlNet Lineart が認識しやすい「黒背景・白線」に変換する。
    """
    gray = ImageOps.grayscale(image.convert("RGB")).resize(target_size, Image.Resampling.LANCZOS)
    inverted = ImageOps.invert(gray)
    # 薄いノイズを飛ばして主線をはっきりさせる
    enhanced = inverted.point(lambda p: 255 if p > 60 else int(p * 0.5))
    return enhanced.convert("RGB")


def _tint_with_palette_guide(colored_img: Image.Image, orig_lineart: Image.Image, colors: list[str]) -> Image.Image:
    """
    diffusers生成画像の豊かな陰影・グラデーションを活かしつつ、
    元の線画を乗算合成して輪郭線をシャープに仕上げる。
    """
    w, h = colored_img.size
    line_rgb = orig_lineart.convert("RGB").resize((w, h), Image.Resampling.LANCZOS)
    # 元の線画の白背景部分を完全な白(255)に近づけ、黒線だけを残す
    line_clean = line_rgb.point(lambda p: 255 if p > 210 else p)
    return ImageChops.multiply(colored_img, line_clean)


def _colorize_with_diffusers(image: Image.Image, colors: list[str], theme: str) -> Image.Image:
    """
    Geminiで英語プロンプト生成 → diffusers (ControlNet Lineart) で彩色 → Pillowで主線乗算仕上げ
    """
    pipe = _get_diffusers_pipeline()
    if pipe is None:
        raise AIClientError("diffusersパイプラインが利用できません。")

    pos_prompt, neg_prompt = _generate_diffusers_prompts_with_gemini(colors, theme)

    orig_size = image.size
    # Stable Diffusion 1.5 に適した8の倍数サイズへリサイズ（長辺512px）
    w, h = orig_size
    scale = 512.0 / max(w, h)
    gen_w = max(256, int((w * scale) // 8) * 8)
    gen_h = max(256, int((h * scale) // 8) * 8)

    control_image = _prepare_controlnet_lineart(image, (gen_w, gen_h))

    import torch
    seed = int(hashlib.md5(f"{colors}-{theme}".encode("utf-8")).hexdigest()[:8], 16)
    generator = torch.Generator(device="cpu").manual_seed(seed)

    # CPU実行時はステップ数を抑えて現実的な待ち時間にする（GPU時は25ステップ）
    steps = 25 if torch.cuda.is_available() else 12

    output = pipe(
        prompt=pos_prompt,
        negative_prompt=neg_prompt,
        image=control_image,
        num_inference_steps=steps,
        guidance_scale=7.5,
        controlnet_conditioning_scale=1.0,
        generator=generator,
    ).images[0]

    # 元の線画を乗算合成して輪郭線をくっきりさせる
    finished = _tint_with_palette_guide(output, image, colors)

    if finished.size != orig_size:
        finished = finished.resize(orig_size, Image.Resampling.LANCZOS)

    return finished


def _fallback_colorize_with_pillow(image: Image.Image, colors: list[str], theme: str = "") -> Image.Image:
    """
    diffusersが未インストール・メモリ不足等で動かない環境向けのバックアップ彩色処理
    """
    base_rgb = [_hex_to_rgb(c) for c in colors] if colors else [(255, 19, 10)]
    while len(base_rgb) < 3:
        base_rgb.append(base_rgb[0])

    seed = int(hashlib.md5(theme.strip().encode("utf-8")).hexdigest(), 16) if theme.strip() else 0

    orig_size = image.size
    work_img = image.convert("RGB")
    work_img.thumbnail((800, 800), Image.Resampling.LANCZOS)
    w, h = work_img.size

    gray = ImageOps.grayscale(work_img)
    closed_gray = gray.filter(ImageFilter.MinFilter(3))
    c_px = closed_gray.load()
    g_px = gray.load()

    is_white = [[c_px[x, y] > 205 for x in range(w)] for y in range(h)]
    visited = [[False] * w for _ in range(h)]

    regions = []
    for sy in range(h):
        for sx in range(w):
            if is_white[sy][sx] and not visited[sy][sx]:
                q = deque([(sx, sy)])
                visited[sy][sx] = True
                region_pixels = []
                touches_border = False

                while q:
                    cx, cy = q.popleft()
                    region_pixels.append((cx, cy))
                    if cx == 0 or cy == 0 or cx == w - 1 or cy == h - 1:
                        touches_border = True

                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h:
                            if is_white[ny][nx] and not visited[ny][nx]:
                                visited[ny][nx] = True
                                q.append((nx, ny))

                regions.append((touches_border, region_pixels))

    fill_layer = Image.new("RGB", (w, h), (255, 255, 255))
    fill_px = fill_layer.load()

    inner_regions = [pxs for is_bg, pxs in regions if not is_bg and len(pxs) >= 6]
    inner_regions.sort(key=len, reverse=True)

    for idx, pxs in enumerate(inner_regions):
        target_color = base_rgb[0] if idx == 0 else base_rgb[(idx + (seed % 3)) % 3]
        for px, py in pxs:
            fill_px[px, py] = target_color

    soft_layer = fill_layer.filter(ImageFilter.GaussianBlur(radius=0.8))
    blended_fill = Image.blend(fill_layer, soft_layer, alpha=0.25)
    b_px = blended_fill.load()

    result = Image.new("RGB", (w, h))
    res_px = result.load()
    for y in range(h):
        for x in range(w):
            lum = g_px[x, y] / 255.0
            fr, fg, fb = b_px[x, y]
            res_px[x, y] = (int(fr * lum), int(fg * lum), int(fb * lum))

    if result.size != orig_size:
        result = result.resize(orig_size, Image.Resampling.LANCZOS)

    return result


def generate_color_explanation(colors: list[str], theme: str) -> str:
    """
    【1回目の通信：seq 解説文通信】
    テキストモデルを呼び出し、配色の解説文を生成する。
    """
    client = _get_client()
    colors_str = "、".join(colors)
    prompt = EXPLANATION_PROMPT_TEMPLATE.format(
        colors=colors_str,
        theme=theme or "指定なし（バランスの良い配色）"
    )

    def _request():
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt,
        )
        if not response.text:
            raise AIClientError("解説文の生成結果が空でした。")
        return response.text.strip()

    try:
        return _call_with_retry(_request)
    except ClientError as e:
        raise AIClientError(f"解説文APIの制限エラーが発生しました: {str(e)}") from e


def colorize_line_art(image: Image.Image, colors: list[str], theme: str) -> Image.Image:
    """
    【2回目の通信：seq 彩色通信】
    1. Geminiで3色パレット＋イメージを英語プロンプト化
    2. diffusers (ControlNet Lineart) で陰影・質感つきのAI彩色を実行
    3. diffusers未導入・エラー時のみPillowフォールバックを使用
    """
    try:
        return _colorize_with_diffusers(image, colors, theme)
    except Exception as e:
        print(f"[WARN] diffusers彩色の代替としてPillow彩色を実行します: {e}")
        return _fallback_colorize_with_pillow(image, colors, theme)