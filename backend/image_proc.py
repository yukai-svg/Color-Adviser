import base64
import io
from PIL import Image

def prepare_image(image_bytes: bytes) -> tuple[Image.Image, bool]:
    """
    アップロードされた画像バイト列を読み込み、透過があれば白背景を合成する。
    戻り値: (処理後のPIL.Imageオブジェクト, 透過があったかどうかのbool)
    """
    img = Image.open(io.BytesIO(image_bytes))
    
    # 透過チャンネル（RGBA, LA, または透明度付きパレット画像P）を持っているか判定
    has_transparency = (
        img.mode in ("RGBA", "LA")
        or (img.mode == "P" and "transparency" in img.info)
    )
    
    if has_transparency:
        rgba_img = img.convert("RGBA")
        # 元画像と同じサイズの真っ白なキャンバスを作成して合成
        white_bg = Image.new("RGBA", rgba_img.size, (255, 255, 255, 255))
        composited = Image.alpha_composite(white_bg, rgba_img)
        return composited.convert("RGB"), True
    
    return img.convert("RGB"), False

def image_to_base64_data_url(img: Image.Image, format: str = "PNG") -> str:
    """PIL.Imageオブジェクトをフロントエンドの<img>タグでそのまま表示できるData URL形式に変換する"""
    buffer = io.BytesIO()
    img.save(buffer, format=format)
    b64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
    mime_type = f"image/{format.lower()}"
    return f"data:{mime_type};base64,{b64_str}"