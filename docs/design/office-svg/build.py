"""Builds the four room SVGs the app serves (docs/design/office-svg/*.svg, copied to
frontend/public/office/) from the two GSAP spikes and the canvas files.

Run it from anywhere: python3 docs/design/office-svg/build.py
Needs Node (for the canvas exporters in ../gsap-ask-spike/).
"""

import re
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
DESIGN = HERE.parent
UPLOAD_SPIKE = DESIGN / "gsap-spike"
ASK_SPIKE = DESIGN / "gsap-ask-spike"
CANVAS = DESIGN / "upload-page" / "project"
PUBLIC = DESIGN.parent.parent / "frontend" / "public" / "office"

VIEW_BOX = "150 0 1060 600"  # the canvas's zoom

LABEL_UPLOAD = (
    "A cut-away isometric office in warm light: an inbox cabinet with an interoffice envelope, "
    "the Chopper's paper-cutting workbench on the left with a guillotine paper cutter, the "
    "Translator's desk at the back with a 1990s beige computer, a printer and an index-card box, "
    "a side table with in and out trays, a stamping table with an ink pad and a stamp carousel, "
    "and a bank of filing cabinets with the Archivist in front. A counter above the file "
    "cabinets shows how many documents are on file. The Chopper, Translator and Archivist are "
    "drawn from behind as faceless bean-shaped figures facing their work."
)
LABEL_ASK = (
    "A cut-away isometric office in warm light. Along the left wall: the door to the Query room, "
    "the Translator at a beige 1990s computer with a printer, and a bank of filing cabinets with "
    "the Scout shining a lantern on them. Along the right wall: the Judge at a desk facing a "
    "detective board of pinned papers and red string, and the Storyteller in front of a desk with "
    "a classic typewriter. Once you ask a question the Clerk comes in, writes it on a big mobile "
    "whiteboard at the front left of the room, and waits beside the board until the answer is "
    "written."
)
LABEL_QUERY = (
    "A small reception room: the Clerk stands behind a counter in front of a door marked Staff "
    "only. On the wall: a framed landscape, a clock and a sign that says All facts, no fiction; "
    "a tall plant in the corner, and a pen cup and a stack of question forms on the counter."
)
LABEL_BREAK = (
    "Illustration of the office break room: a window with half-lowered blinds striping the floor "
    "with light, a plant, a wall clock, a corkboard titled Why RAG? with six pinned notes named "
    "after the sections of this page joined by red string, the Clerk standing beside the board and "
    "waving at it, a kitchen counter with a coffee machine, a mug shelf with one mug in each "
    "colleague's colour, a sugar jar and a microwave, a sign saying Please cite your sources and "
    "wash your mug, and a small round table with two chairs."
)

# Feet positions (SVG coordinates) from the spikes' P tables, under the convention's names.
UPLOAD_SPOTS = {
    "spot-chopper": (416, 434),
    "spot-chopper-inbox": (300, 474),
    "spot-chopper-tray": (604, 326),
    "spot-translator": (664, 358),
    "spot-translator-stamp": (764.8, 376.4),
    "spot-archivist": (1040, 470),
    "spot-archivist-around": (960, 500),
    "spot-archivist-table": (856, 388),
}
ASK_SPOTS = {
    "spot-clerk-doorway": (212, 428),
    "spot-clerk-door": (240, 442),
    "spot-clerk-board": (636, 564),
    "spot-clerk-storyteller": (840, 546),
    "spot-translator": (400, 410),
    "spot-translator-scout": (660, 334),
    "spot-scout": (608, 314),
    "spot-scout-judge": (752, 346),
    "spot-judge": (812, 396),
    "spot-judge-desk": (1003.2, 507.2),
    "spot-judge-past-desk": (856, 462),
    "spot-judge-clerk": (692, 572),
    "spot-judge-files": (512, 330),
    "spot-storyteller": (920, 546),
}


def read(path: Path) -> str:
    return path.read_text()


def spots_group(spots: dict[str, tuple[float, float]]) -> str:
    circles = "".join(f'<circle id="{name}" cx="{x}" cy="{y}" r="0"></circle>' for name, (x, y) in spots.items())
    return f'  <g id="spots" display="none">{circles}</g>\n'


def accessible(svg: str, label: str) -> str:
    """Give the root <svg> role="img" and an aria-label."""
    label = label.replace("&", "&amp;").replace('"', "&quot;")
    return re.sub(r"<svg\b", f'<svg role="img" aria-label="{label}"', svg, count=1)


def build_upload() -> str:
    svg = read(UPLOAD_SPIKE / "upload-room.svg")
    assert '<g id="label-maker">' in svg and '<g id="spots"' in svg
    svg = svg.replace('<g id="label-maker">', read(UPLOAD_SPIKE / "drawer.svgfrag") + '  <g id="label-maker">', 1)
    svg = svg.replace(
        '<g id="spots"',
        read(UPLOAD_SPIKE / "translator.svgfrag") + read(UPLOAD_SPIKE / "chars.svgfrag") + '  <g id="spots"',
        1,
    )
    # the spike's visible spot markers become hidden markers read by the scenes
    svg = svg[: svg.index('  <g id="spots"')] + spots_group(UPLOAD_SPOTS) + "</svg>\n"
    return accessible(svg, LABEL_UPLOAD)


def build_ask() -> str:
    office = read(ASK_SPIKE / "ask-room-raw.svg")
    office = office.replace(">STAFF<", ">QUERY<")
    office = office.replace(
        'viewBox="0 0 1280 600" width="1280" height="600"', f'viewBox="{VIEW_BOX}" width="1060" height="600"', 1
    )
    assert f'viewBox="{VIEW_BOX}"' in office
    assert office.rstrip().endswith("</svg>")
    # depth: room, then props lying on furniture, then the crew, then the door overlay, copies, answer and the Clerk
    office = (
        office.rstrip()[: -len("</svg>")]
        + '  <g id="a-props"></g>\n'
        + read(ASK_SPIKE / "crew.svgfrag")
        + read(ASK_SPIKE / "office-extras.svgfrag")
        + "</svg>"
    )
    # the whiteboard stands on the front planks, in front of everyone who walks past it: draw it last
    a = office.index('      <g id="qboard">')
    b = office.index("</g>", a) + len("</g>\n")
    board, office = office[a:b], office[:a] + office[b:]
    office = office.rstrip()[: -len("</svg>")] + board + spots_group(ASK_SPOTS) + "</svg>\n"
    return accessible(office, LABEL_ASK)


def build_query() -> str:
    return accessible(read(ASK_SPIKE / "query-room.svg"), LABEL_QUERY)


def node(*args: str) -> str:
    result = subprocess.run(["node", *args], check=True, capture_output=True, text=True, cwd=ASK_SPIKE)
    return result.stdout


def build_break() -> str:
    svg = node("export-room.js", str(CANVAS / "OfficeBreakRoom.dc.html"), "{}")
    svg = re.sub(r'viewBox="0 0 1280 600" width="1280" height="600"', 'viewBox="0 0 1280 300" width="1280" height="300"', svg, count=1)
    assert 'viewBox="0 0 1280 300"' in svg
    # the front-view Clerk: the canvas overlay is left 50.8%, top 45.3% of 1280 x 300, 80 x 120 box
    clerk = node("export-char.js", str(CANVAS / "CharClerk.dc.html"), "clerk", "690.2", "251.9", '{"pose":"wave","facing":"front"}')
    svg = svg.rstrip()[: -len("</svg>")] + clerk + "</svg>\n"
    return accessible(svg, LABEL_BREAK)


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    files = {
        "upload-room.svg": build_upload(),
        "ask-room.svg": build_ask(),
        "query-room.svg": build_query(),
        "break-room.svg": build_break(),
    }
    for name, svg in files.items():
        (HERE / name).write_text(svg)
        shutil.copyfile(HERE / name, PUBLIC / name)
        print(f"wrote {name} ({len(svg) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
