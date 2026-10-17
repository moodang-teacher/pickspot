"""Create square home screen icons from the PickSpot brand artwork."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BACKGROUND = "#10172e"
OUTPUTS = (
    ("apple-touch-icon.png", 180, 156),
    ("assets/icon-192.png", 192, 166),
    ("assets/icon-512.png", 512, 440),
    ("assets/icon-maskable-512.png", 512, 330),
    ("assets/favicon-48.png", 48, 40),
)


def main() -> None:
    artwork = Image.open(ROOT / "assets/pickspot_logo.png").convert("RGBA")
    artwork = artwork.crop(artwork.getbbox())
    for filename, size, artwork_size in OUTPUTS:
        logo = artwork.copy()
        logo.thumbnail((artwork_size, artwork_size), Image.Resampling.LANCZOS)
        icon = Image.new("RGBA", (size, size), BACKGROUND)
        icon.alpha_composite(logo, ((size - logo.width) // 2, (size - logo.height) // 2))
        icon.convert("RGB").save(ROOT / filename, optimize=True)


if __name__ == "__main__":
    main()
