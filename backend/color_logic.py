from colormath.color_objects import sRGBColor, HSVColor
from colormath.color_conversions import convert_color

def _shift_hue(hex_color: str, degrees: list[float]) -> list[str]:
    """基準のHEXカラーから色相(H)を回転させたHEXカラーのリストを返す"""
    rgb = sRGBColor.new_from_rgb_hex(hex_color)
    hsv = convert_color(rgb, HSVColor)
    
    palette = []
    for deg in degrees:
        new_h = (hsv.hsv_h + deg) % 360
        new_hsv = HSVColor(new_h, hsv.hsv_s, hsv.hsv_v)
        new_rgb = convert_color(new_hsv, sRGBColor)
        palette.append(new_rgb.get_rgb_hex().upper())
    return palette

def generate_palettes(main_color: str) -> dict:
    """メインカラーを基に補色・類似色・三分色の3パレットを生成する"""
    # 補色（ベース + 180度反対色 + 調整色）
    complementary = _shift_hue(main_color, [0, 180, 150])
    # 類似色（ベース + 隣り合う±30度）
    analogous = _shift_hue(main_color, [0, 30, -30])
    # 三分色（ベース + 120度ずつ等間隔）
    triadic = _shift_hue(main_color, [0, 120, 240])
    
    return {
        "complementary": complementary,
        "analogous": analogous,
        "triadic": triadic
    }

# 単体テスト用
if __name__ == "__main__":
    print(generate_palettes("#FF130A"))