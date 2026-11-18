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
from google.genai import types
from google.genai.errors import ClientError, ServerError
from PIL import Image, ImageFilter, ImageOps

load_dotenv()

EXPLANATION_PROMPT_TEMPLATE = """
あなたはプロの色彩検定講師・カラーコーディネーターです。
以下の条件で作成された配色の特徴、視覚的効果、およびこのイメージに合う理由を分かりやすく日本語で解説してください。

【使用カラーパレット】
{colors}

【ユーザーの希望イメージ】
{theme}

※出力は3〜4文程度の自然な解説文のみとし、前置きや箇条書きの記号は使わないでください。
"""

THEME_ANALYSIS_PROMPT_TEMPLATE = """
あなたはプロのイラストレーター兼カラーディレクターです。
線画イラストを「指定された3色のカラーパレット」で自動彩色するための塗り分けパラメータを、ユーザーの希望イメージから判断してJSONのみで出力してください。

【使用カラーパレット（インデックス0, 1, 2）】
0: {c0}
1: {c1}
2: {c2}

【ユーザーの希望イメージ】
{theme}

【出力JSON仕様（厳守・他の文章やマークダウン記号は不要）】
{{
  "brightness": 1.0,
  "saturation": 1.0,
  "color_order": [1, 0, 2],
  "fill_background": false,
  "bg_color_index": 1,
  "bg_opacity": 0.25
}}

【各項目の判断基準】
- brightness (0.55 〜 1.35): 「夜・暗い・重厚・シック・大人」なら 0.65〜0.85、「パステル・淡い・優しい・ふんわり・明るい」なら 1.15〜1.30、標準は 1.0。
- saturation (0.45 〜 1.30): 「淡い・ナチュラル・くすみ・レトロ・上品」なら 0.55〜0.80、「ポップ・元気・ネオン・鮮やか・派手」なら 1.10〜1.25、標準は 1.0。
- color_order: [ベース/大きい面の色番号, メイン/文字の色番号, アクセントの色番号] を 0, 1, 2 の並び替えで指定。
- fill_background (true または false): 「夜空・海・宇宙・夕焼け・背景まで世界観があるポスター」なら true、「白背景のロゴ・アイコン・切り抜きイラスト・POP」なら false。
- bg_color_index (0, 1, 2): fill_background が true のときに背景に使う色番号。
- bg_opacity (0.12 〜 0.85): 背景の濃さ。「夜・宇宙・濃い背景」なら 0.65〜0.85、「淡い空・ふんわり背景」なら 0.15〜0.35。
"""

COLORIZE_PROMPT_TEMPLATE = """
添付された線画イラストに対して、以下のカラーパレットとイメージのみを使用して綺麗に彩色してください。

【指定カラーパレット（HEXコード）】
{colors}

【イメージ・雰囲気】
{theme}

【厳守ルール】
- 元の線画の輪郭線・構図・キャラクターやモチーフの形は一切変更しないでください。
- 指定されたカラーパレットの色とその明暗・濃淡を中心に使って塗り分けてください。
- 文字やロゴ、余計な背景オブジェクトは描き足さないでください。
"""


class AIClientError(Exception):
    """AI通信・リトライ失敗時の例外"""
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


def _apply_hsv_adjust(rgb: tuple[int, int, int], brightness: float, saturation: float) -> tuple[int, int, int]:
    """HSV空間で明度(V)と彩度(S)を自然に調整する"""
    r, g, b = [x / 255.0 for x in rgb]
    h, s, v = colorsys.rgb_to_hsv(r, g, b)

    s = max(0.0, min(1.0, s * saturation))
    # brightness > 1.0 のときは白方向へ持ち上げてパステル調も表現できるようにする
    if brightness > 1.0:
        lift = (brightness - 1.0) * 0.7
        v = min(1.0, v + (1.0 - v) * lift)
        s = max(0.0, s * (1.0 - lift * 0.6))
    else:
        v = max(0.05, min(1.0, v * brightness))

    nr, ng, nb = colorsys.hsv_to_rgb(h, s, v)
    return (int(nr * 255), int(ng * 255), int(nb * 255))


def _analyze_theme_with_gemini(colors: list[str], theme: str) -> dict:
    """
    Geminiテキストモデル（無料枠）を使って、任意の自由イメージ文から
    塗り分け用パラメータ(JSON)を生成する。
    """
    default_params = {
        "brightness": 1.0,
        "saturation": 1.0,
        "color_order": [1, 0, 2],
        "fill_background": False,
        "bg_color_index": 1,
        "bg_opacity": 0.25,
    }

    if not theme or not theme.strip():
        return default_params

    padded = list(colors) if colors else ["#FF130A"]
    while len(padded) < 3:
        padded.append(padded[0])

    client = _get_client()
    prompt = THEME_ANALYSIS_PROMPT_TEMPLATE.format(
        c0=padded[0],
        c1=padded[1],
        c2=padded[2],
        theme=theme.strip(),
    )

    def _request():
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=prompt,
        )
        return response.text or ""

    try:
        raw_text = _call_with_retry(_request)
        match = re.search(r"\{[\s\S]*\}", raw_text)
        if not match:
            return default_params
        parsed = json.loads(match.group(0))

        # 安全な範囲にクランプして返却
        brightness = max(0.55, min(1.35, float(parsed.get("brightness", 1.0))))
        saturation = max(0.45, min(1.30, float(parsed.get("saturation", 1.0))))
        order = parsed.get("color_order", [1, 0, 2])
        if not isinstance(order, list) or len(order) < 3 or any(i not in (0, 1, 2) for i in order[:3]):
            order = [1, 0, 2]
        fill_bg = bool(parsed.get("fill_background", False))
        bg_idx = int(parsed.get("bg_color_index", 1))
        if bg_idx not in (0, 1, 2):
            bg_idx = 1
        bg_opacity = max(0.12, min(0.85, float(parsed.get("bg_opacity", 0.25))))

        result = {
            "brightness": brightness,
            "saturation": saturation,
            "color_order": order[:3],
            "fill_background": fill_bg,
            "bg_color_index": bg_idx,
            "bg_opacity": bg_opacity,
        }
        print(f"[INFO] Geminiイメージ解析結果 ('{theme.strip()}'): {result}")
        return result
    except Exception as e:
        print(f"[WARN] Geminiイメージ解析のフォールバックを使用します: {e}")
        return default_params


def _fallback_colorize_with_pillow(image: Image.Image, colors: list[str], theme: str = "") -> Image.Image:
    """
    Geminiによる自由イメージ解析パラメータ + Pillowによる高精度フラット塗り分け処理:
    1. Geminiでイメージ文から明度・彩度・主役色順・背景塗りの有無を取得
    2. 線の隙間閉じ処理でパーツ（閉領域）を抽出
    3. AIの判断に基づき、背景処理と各パーツのフラット彩色を実行
    """
    params = _analyze_theme_with_gemini(colors, theme)

    base_rgb = [_hex_to_rgb(c) for c in colors] if colors else [(255, 19, 10)]
    while len(base_rgb) < 3:
        base_rgb.append(base_rgb[0])

    # Geminiが判断した明度・彩度パラメータで3色のトーンを調整
    adjusted_rgb = [
        _apply_hsv_adjust(c, params["brightness"], params["saturation"])
        for c in base_rgb
    ]
    ordered_colors = [adjusted_rgb[i] for i in params["color_order"]]

    # 同じ条件なら再現性を保ちつつ、イメージ文ごとのパーツ割り当てバリエーションを生成
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

    # 背景色の決定（Geminiが fill_background=True と判断した場合は指定色のティントで塗る）
    if params["fill_background"]:
        bg_base = adjusted_rgb[params["bg_color_index"]]
        op = params["bg_opacity"]
        bg_color = (
            int(255 * (1 - op) + bg_base[0] * op),
            int(255 * (1 - op) + bg_base[1] * op),
            int(255 * (1 - op) + bg_base[2] * op),
        )
    else:
        bg_color = (255, 255, 255)

    fill_layer = Image.new("RGB", (w, h), bg_color)
    fill_px = fill_layer.load()

    inner_regions = [pxs for is_bg, pxs in regions if not is_bg and len(pxs) >= 6]
    inner_regions.sort(key=len, reverse=True)

    for idx, pxs in enumerate(inner_regions):
        if idx == 0:
            target_color = ordered_colors[0]
        else:
            color_idx = (idx + (seed % 3)) % 3
            target_color = ordered_colors[color_idx]

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
            res_px[x, y] = (
                int(fr * lum),
                int(fg * lum),
                int(fb * lum),
            )

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
    Gemini画像生成モデルを呼び出す。無料枠制限(429)の場合は
    Gemini自由イメージ解析 + Pillowフラット自動彩色を実行する。
    """
    client = _get_client()
    colors_str = "、".join(colors)
    prompt = COLORIZE_PROMPT_TEMPLATE.format(
        colors=colors_str,
        theme=theme or "指定なし（自然な仕上がり）"
    )

    def _request():
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[prompt, image],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            ),
        )
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                return Image.open(io.BytesIO(part.inline_data.data)).convert("RGB")
        raise AIClientError("AIから彩色画像が返却されませんでした。")

    try:
        return _call_with_retry(_request)
    except ClientError as e:
        if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
            print("[INFO] Gemini画像生成の無料枠制限(429)を検知したため、Geminiイメージ解析＋自動彩色を実行します。")
            return _fallback_colorize_with_pillow(image, colors, theme)
        raise AIClientError(f"画像生成APIエラー: {str(e)}") from e