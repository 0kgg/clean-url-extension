"""
Generate extension icons from an input image.

Requirements:
- Pillow (pip install pillow)

Usage:
    python tools/icon_from_image.py
"""

from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Pillow が必要です。 pip install pillow") from exc

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "unnamed.jpg"
OUT_DIR = ROOT / "icons"
SIZES = [16, 32, 48, 128]


def generate():
    if not SRC.exists():
        raise SystemExit(f"元画像が見つかりません: {SRC}")

    img = Image.open(SRC).convert("RGBA")
    OUT_DIR.mkdir(exist_ok=True)

    for size in SIZES:
        icon = img.resize((size, size), Image.LANCZOS)
        icon.save(OUT_DIR / f"icon-{size}.png")
    print(f"icons generated under {OUT_DIR}")


if __name__ == "__main__":
    generate()
