"""Build screen-sized artwork for the enlarged poster viewer."""

from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "works"
DESTINATION = ROOT / "assets" / "work-display"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"}
MAX_SIZE = (2400, 2400)


def main() -> None:
    before = after = count = 0
    for source in SOURCE.rglob("*"):
        if not source.is_file() or source.is_symlink() or source.suffix.lower() not in EXTENSIONS:
            continue
        target = DESTINATION / source.relative_to(SOURCE).parent / f"{source.name}.display.webp"
        if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as original:
            image = ImageOps.exif_transpose(original)
            image.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGB")
            image.save(target, "WEBP", quality=88, method=6)
        count += 1
        before += source.stat().st_size
        after += target.stat().st_size
    print(f"Created {count} display images ({before / 1048576:.1f} MB -> {after / 1048576:.1f} MB).")


if __name__ == "__main__":
    main()
