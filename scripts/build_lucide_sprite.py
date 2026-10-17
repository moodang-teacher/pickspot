"""Build the small local icon sprite from the official lucide-static package."""

from copy import deepcopy
from pathlib import Path
from urllib.request import urlopen
import xml.etree.ElementTree as ET


VERSION = "1.59.0"
ICONS = (
    "arrow-left",
    "arrow-right",
    "arrow-up-right",
    "chart-column-increasing",
    "circle-check",
    "circle-dashed",
    "circle-dot",
    "copy",
    "pencil",
    "plus",
    "rotate-ccw",
    "vote",
    "x",
)
SVG_NS = "http://www.w3.org/2000/svg"
BASE_URL = f"https://cdn.jsdelivr.net/npm/lucide-static@{VERSION}"
ROOT = Path(__file__).resolve().parents[1] / "assets"


def fetch(path: str) -> bytes:
    with urlopen(f"{BASE_URL}/{path}", timeout=20) as response:
        return response.read()


def main() -> None:
    ET.register_namespace("", SVG_NS)
    sprite = ET.Element(f"{{{SVG_NS}}}svg")
    for name in ICONS:
        source = ET.fromstring(fetch(f"icons/{name}.svg"))
        symbol = ET.SubElement(sprite, f"{{{SVG_NS}}}symbol", {
            "id": name,
            "viewBox": source.attrib["viewBox"],
            "fill": source.attrib.get("fill", "none"),
            "stroke": "currentColor",
            "stroke-width": source.attrib.get("stroke-width", "2"),
            "stroke-linecap": source.attrib.get("stroke-linecap", "round"),
            "stroke-linejoin": source.attrib.get("stroke-linejoin", "round"),
        })
        for child in source:
            symbol.append(deepcopy(child))
    ROOT.joinpath("lucide-icons.svg").write_bytes(
        f"<!-- lucide-static {VERSION}; see LUCIDE_LICENSE -->\n".encode()
        + ET.tostring(sprite, encoding="utf-8")
    )
    ROOT.joinpath("LUCIDE_LICENSE").write_bytes(fetch("LICENSE"))


if __name__ == "__main__":
    main()
