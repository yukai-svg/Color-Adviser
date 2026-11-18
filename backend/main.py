import json
from typing import Optional
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from ai_client import AIClientError, colorize_line_art, generate_color_explanation
from color_logic import generate_palettes
from image_proc import image_to_base64_data_url, prepare_image

app = FastAPI(title="Color Adviser API")

# フロントエンド（Live ServerやローカルHTML）からの通信を許可するCORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Color Adviser API is running"}


@app.post("/api/palette")
async def create_palette(
    main_color: str = Form(..., description="メインカラー（例: #FF130A）"),
    image: Optional[UploadFile] = File(None, description="検証用の線画画像（任意）"),
):
    """
    【シーケンス 1.1: 計算を要求する()】
    画像の透過チェック・白背景合成と、メインカラーからの3パレット計算を行う。
    """
    has_transparency = False
    processed_image_url = None

    if image is not None:
        try:
            image_bytes = await image.read()
            processed_img, has_transparency = prepare_image(image_bytes)
            processed_image_url = image_to_base64_data_url(processed_img)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"画像の読み込みに失敗しました: {str(e)}")

    try:
        palettes = generate_palettes(main_color)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"カラーコードの形式が不正です: {str(e)}")

    return {
        "main_color": main_color.upper(),
        "palettes": palettes,
        "has_transparency": has_transparency,
        "processed_image": processed_image_url,
    }


@app.post("/api/colorize")
async def colorize_image(
    image: UploadFile = File(..., description="線画画像ファイル"),
    colors: str = Form(..., description='選択パレットのJSON配列文字列（例: ["#FF130A", "#0AF6FF", "#0AFF8E"]）'),
    theme: str = Form("", description="希望のイメージ・雰囲気"),
):
    """
    【シーケンス 2.1: 処理を要求する()】
    1. 画像前処理（透過がある場合は白背景合成）
    2. 解説文通信（Geminiテキストモデル）
    3. 彩色通信（Gemini画像生成モデル）
    """
    # パレットのJSONパース（カンマ区切り文字列でも受け取れるよう柔軟に対応）
    try:
        parsed_colors = json.loads(colors)
        if not isinstance(parsed_colors, list) or len(parsed_colors) == 0:
            raise ValueError
    except Exception:
        parsed_colors = [c.strip() for c in colors.split(",") if c.strip()]
        if not parsed_colors:
            raise HTTPException(status_code=400, detail="カラーパレットの指定が不正です。")

    # 画像読み込み・白背景合成
    try:
        image_bytes = await image.read()
        base_img, has_transparency = prepare_image(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"画像データの処理に失敗しました: {str(e)}")

    # 2段階のGemini API通信（解説文生成 → 彩色画像生成）
    try:
        explanation = generate_color_explanation(parsed_colors, theme)
        colored_img = colorize_line_art(base_img, parsed_colors, theme)
    except AIClientError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "explanation": explanation,
        "colored_image": image_to_base64_data_url(colored_img),
        "used_colors": parsed_colors,
        "has_transparency": has_transparency,
    }