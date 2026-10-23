#!/usr/bin/env python3
"""Render a tailored resume and cover letter to one-page PDFs, then check them.

    python render.py content.json --resume resume.pdf --posting posting.txt --out out

Needs ReportLab, plus pypdf when --resume is a PDF. Prints one line per
problem and exits 1 if any check fails, so the caller fixes content.json and
runs it again. Prints OK when every check passes. The PDFs are written either
way, so a failed run can still be looked at.
"""

import argparse
import json
import re
import sys
from collections.abc import Callable
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer

NAVY = HexColor("#31465A")
INK = HexColor("#333333")
META = HexColor("#444444")
RULE = HexColor("#B7BEC5")

SIDE_MARGIN = 0.62 * inch
TOP_MARGIN = 0.55 * inch
RESUME_BOTTOM_MARGIN = 0.5 * inch
LETTER_BOTTOM_MARGIN = 0.6 * inch
FRAME_PADDING = 12  # SimpleDocTemplate's frame pads 6pt on each side
TEXT_WIDTH = LETTER[0] - 2 * SIDE_MARGIN - FRAME_PADDING
BULLET_INDENT = 12

SCALE_STEP = 0.02
MIN_SCALE = 0.80  # smaller than this is hard to read; cut content instead
MIN_LAST_LINE = 0.45  # a wrapped bullet's last line must fill this much of the line
LETTER_PARAGRAPHS = 4

# Regular spaces inside keep line breaks possible; the no-break spaces keep the gap wide.
SEP = "  |  "
SKILL_SEP = "  •  "
NUMBER = re.compile(r"\d[\d,.]*%?")


def styles(scale: float) -> dict:
    def style(
        name: str, size: float, leading: float, font: str = "Helvetica", color: HexColor = INK, **spacing: float
    ) -> ParagraphStyle:
        spacing = {k: v * scale for k, v in spacing.items()}
        return ParagraphStyle(
            name, fontName=font, fontSize=size * scale, leading=leading * scale, textColor=color, **spacing
        )

    bullet = style("bullet", 9.4, 11.9, spaceAfter=0.6)
    bullet.leftIndent = BULLET_INDENT
    bullet.bulletIndent = 2
    bullet.bulletFontSize = 9.4 * scale
    return {
        "name": style("name", 23, 27, "Helvetica-Bold", NAVY),
        "contact": style("contact", 9.4, 12, spaceBefore=1, spaceAfter=4),
        "heading": style("heading", 11, 13, "Helvetica-Bold", NAVY, spaceBefore=9, spaceAfter=3),
        "body": style("body", 9.4, 11.9),
        "job": style("job", 10, 12.4, "Helvetica-Bold", spaceBefore=5),
        "meta": style("meta", 9, 11, "Helvetica-Oblique", META, spaceAfter=1.5),
        "bullet": bullet,
        "letter": style("letter", 10.6, 14.6, spaceAfter=8),
        "scale": scale,
    }


def esc(text: object) -> str:
    return escape(str(text))


def header(candidate: dict, st: dict) -> list:
    return [
        Paragraph(esc(candidate["name"]), st["name"]),
        Paragraph(SEP.join(esc(c) for c in candidate["contact"]), st["contact"]),
        HRFlowable(width="100%", thickness=0.7, color=RULE, spaceBefore=0, spaceAfter=2 * st["scale"]),
    ]


def resume_story(content: dict, st: dict) -> list:
    resume = content["resume"]

    def heading(text: str) -> Paragraph:
        return Paragraph(text.upper(), st["heading"])

    story = header(content["candidate"], st)
    story += [heading("Professional Summary"), Paragraph(esc(resume["summary"]), st["body"])]
    story.append(heading("Work History"))
    for job in resume["jobs"]:
        story.append(Paragraph(esc(job["header"]), st["job"]))
        story.append(Paragraph(esc(job["location"]) + SEP + esc(job["dates"]), st["meta"]))
        story += [Paragraph(esc(b), st["bullet"], bulletText="•") for b in job["bullets"]]
    story += [heading("Skills"), Paragraph(SKILL_SEP.join(esc(s) for s in resume["skills"]), st["body"])]
    story.append(heading("Education"))
    story += [Paragraph(f"<b>{esc(e['degree'])}</b>{SEP}{esc(e['detail'])}", st["body"]) for e in resume["education"]]
    return story


def letter_story(content: dict, st: dict) -> list:
    letter = content["letter"]
    para = st["letter"]
    story = header(content["candidate"], st)
    story += [Spacer(1, 10 * st["scale"]), Paragraph(esc(letter["date"]), para)]
    story.append(Paragraph("<br/>".join(esc(line) for line in letter["address"]), para))
    story.append(Paragraph("Re: " + esc(letter["re"]), para))
    story.append(Paragraph("Dear Hiring Team,", para))
    story += [Paragraph(esc(p), para) for p in letter["body"]]
    story.append(Paragraph("Sincerely,<br/>" + esc(content["candidate"]["name"]), para))
    return story


def fit_one_page(
    make_story: Callable[[dict, dict], list], content: dict, bottom_margin: float
) -> tuple[bytes, int, float]:
    """Build at full size, then 2% smaller each try until it fits one page."""
    scale = 1.0
    while True:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=LETTER,
            leftMargin=SIDE_MARGIN,
            rightMargin=SIDE_MARGIN,
            topMargin=TOP_MARGIN,
            bottomMargin=bottom_margin,
        )
        doc.build(make_story(content, styles(scale)))
        if doc.page == 1 or scale - SCALE_STEP < MIN_SCALE - 1e-9:
            return buffer.getvalue(), doc.page, scale
        scale = round(scale - SCALE_STEP, 2)


def last_line_fill(text: str, style: ParagraphStyle) -> float | None:
    """How much of the line a wrapped paragraph's last line fills, or None if it does not wrap."""
    paragraph = Paragraph(esc(text), style, bulletText="•")
    paragraph.wrap(TEXT_WIDTH, 10_000)
    lines = paragraph.blPara.lines
    if len(lines) < 2:
        return None
    last = lines[-1]
    extra = last.extraSpace if hasattr(last, "extraSpace") else last[0]
    usable = TEXT_WIDTH - style.leftIndent - style.rightIndent
    return (usable - extra) / usable


def short_last_lines(content: dict, scale: float) -> list[str]:
    st = styles(scale)
    resume = content["resume"]
    checks = [(resume["summary"], st["body"])]
    checks += [(b, st["bullet"]) for job in resume["jobs"] for b in job["bullets"]]
    problems = []
    for text, style in checks:
        fill = last_line_fill(text, style)
        if fill is not None and fill < MIN_LAST_LINE:
            problems.append(f'SHORT LAST LINE ({fill:.0%} of the line): "{text[:60]}..." -- reword it')
    return problems


def new_numbers(content: dict, sources: str) -> list[str]:
    """Numbers in the output that appear in neither the resume nor the posting."""
    resume, letter, candidate = content["resume"], content["letter"], content["candidate"]
    texts = [*candidate["contact"], resume["summary"], *resume["skills"], letter["re"], *letter["body"]]
    for job in resume["jobs"]:
        texts += [job["header"], job["location"], job["dates"], *job["bullets"]]
    for school in resume["education"]:
        texts += [school["degree"], school["detail"]]
    found = {m.group().rstrip(".,") for text in texts for m in NUMBER.finditer(str(text))}
    # Whole numbers, not substrings: an invented "2" must not pass because "2021" is in the resume.
    known = {m.group().rstrip(".,") for m in NUMBER.finditer(sources)}
    known |= {n.rstrip("%") for n in known}
    return [
        f'NEW NUMBER: "{n}" is not in the resume or the posting -- remove it or use the resume\'s number'
        for n in sorted(found)
        if n not in known
    ]


def read_text(path: str) -> str:
    file = Path(path)
    if file.suffix.lower() == ".pdf":
        from pypdf import PdfReader

        # strict=False reads PDFs that other tools re-saved with a broken structure.
        return "\n".join(page.extract_text() or "" for page in PdfReader(file, strict=False).pages)
    return file.read_text(encoding="utf-8")


def file_stem(text: str) -> str:
    return re.sub(r"\W+", "_", text).strip("_")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("content", help="content.json")
    parser.add_argument("--resume", required=True, help="the original resume, as .pdf or .txt")
    parser.add_argument("--posting", required=True, help="the job posting's text, as .txt")
    parser.add_argument("--out", default="out", help="folder for the PDFs")
    args = parser.parse_args(argv)

    try:
        content = json.loads(Path(args.content).read_text(encoding="utf-8"))
        sources = read_text(args.resume) + "\n" + read_text(args.posting)
        name = file_stem(content["candidate"]["name"])
        tag = file_stem(content["tag"])
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)

        problems = []
        if len(content["letter"]["body"]) != LETTER_PARAGRAPHS:
            problems.append(f"LETTER: write exactly {LETTER_PARAGRAPHS} body paragraphs")

        builds = [
            ("resume", resume_story, RESUME_BOTTOM_MARGIN, f"{name}_Resume_{tag}.pdf"),
            ("letter", letter_story, LETTER_BOTTOM_MARGIN, f"{name}_Cover_Letter_{tag}.pdf"),
        ]
        for label, make_story, bottom, filename in builds:
            pdf, pages, scale = fit_one_page(make_story, content, bottom)
            (out / filename).write_bytes(pdf)
            print(f"{label}: {pages} page(s) at {scale:.0%} size -> {out / filename}")
            if pages > 1:
                problems.append(f"TOO LONG: the {label} needs {pages} pages even at {MIN_SCALE:.0%} size -- cut text")
            if label == "resume":
                problems += short_last_lines(content, scale)
        problems += new_numbers(content, sources)
    except KeyError as missing:
        print(f"content.json is missing {missing} -- see the format in SKILL.md")
        return 2
    except (OSError, ValueError) as error:
        print(f"Could not read the input: {error}")
        return 2

    for problem in problems:
        print(problem)
    if problems:
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
