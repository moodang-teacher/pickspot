"""Build display-sized WebP logos while keeping the original PNGs for app icons."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "assets"
SIZES = {"pickspot_logo": 96, "pickspot_logo_big": 860}


def main() -> None:
    for name, max_dimension in SIZES.items():
        source = ROOT / f"{name}.png"
        target = ROOT / f"{name}.webp"
        with Image.open(source) as original:
            image = original.convert("RGBA")
            image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            image.save(target, "WEBP", quality=88, method=6)
        print(f"{source.name}: {source.stat().st_size:,} B -> {target.name}: {target.stat().st_size:,} B")


if __name__ == "__main__":
    main()
