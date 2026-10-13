"""Build the static image list used by the PickSpot admin screen."""

import json
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
WORKS = ROOT / "assets" / "works"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"}


def main() -> None:
    WORKS.mkdir(parents=True, exist_ok=True)
    images = []
    for image in sorted(WORKS.rglob("*"), key=lambda path: str(path).casefold()):
        if not image.is_file() or image.is_symlink() or image.suffix.lower() not in EXTENSIONS:
            continue
        relative = image.relative_to(WORKS)
        encoded = "/".join(quote(part) for part in relative.parts)
        images.append({"name": image.name, "path": f"assets/works/{encoded}"})

    target = WORKS / "index.json"
    target.write_text(json.dumps({"images": images}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {target.relative_to(ROOT)} with {len(images)} image(s).")


if __name__ == "__main__":
    main()
