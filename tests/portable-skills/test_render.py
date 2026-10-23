"""Checks for portable-skills/apply-to-job/render.py.

    uv run --with pytest --with reportlab --with pypdf pytest tests/portable-skills
"""

import copy
import json
import sys
from pathlib import Path

from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "portable-skills" / "apply-to-job"))
import render

RESUME = """Jordan Rivera
Newark, NJ | (555) 010-0199 | jordan.rivera@example.com
Program Assistant, Acme Health, Remote, 03/2023 - Present
Support onboarding for new staff across three teams. Cut scheduling errors by 10%.
Facilitate weekly benefits Q&A sessions for employees.
Front Desk Associate, Riverside Clinic, Newark, NJ, 06/2021 - 02/2023
Checked in patients and verified insurance details.
B.A., Communication, State University, 2021
Skills: Scheduling, Microsoft Excel, Workday, Customer service
"""

POSTING = "Program Coordinator, Acme Health, Pasadena, CA. Job ID 12345. Pay $60,000 - $70,000."

CONTENT = {
    "candidate": {"name": "Jordan Rivera", "contact": ["Newark, NJ", "(555) 010-0199", "jordan.rivera@example.com"]},
    "tag": "Acme_Program_Coordinator",
    "resume": {
        "summary": "Program assistant who supports onboarding and benefits programs for a remote health team, "
        "with a steady record of cleaner scheduling and clear communication with employees.",
        "jobs": [
            {
                "header": "Program Assistant, Acme Health",
                "location": "Remote",
                "dates": "03/2023 – Present",
                "bullets": [
                    "Support onboarding for new staff across three teams, keeping start dates and paperwork on track.",
                    "Cut scheduling errors by 10% by tightening how calendars and room bookings are confirmed.",
                    "Facilitate weekly benefits Q&A sessions that help employees understand their options.",
                ],
            },
            {
                "header": "Front Desk Associate, Riverside Clinic",
                "location": "Newark, NJ",
                "dates": "06/2021 – 02/2023",
                "bullets": ["Checked in patients and verified insurance details before each appointment began."],
            },
        ],
        "skills": ["Scheduling", "Microsoft Excel", "Workday", "Customer service"],
        "education": [{"degree": "B.A., Communication", "detail": "State University, 2021"}],
    },
    "letter": {
        "date": "October 23, 2026",
        "address": ["Hiring Team", "Acme Health", "Pasadena, CA"],
        "re": "Program Coordinator (Job ID 12345)",
        "body": [
            "I am applying for the Program Coordinator role at Acme Health.",
            "In my current role I support onboarding for new staff across three teams.",
            "I also facilitate weekly benefits Q&A sessions for employees.",
            "I am based in Newark and work remotely. Thank you for your time.",
        ],
    },
}


def run(tmp_path: Path, content: dict) -> tuple[int, Path]:
    (tmp_path / "content.json").write_text(json.dumps(content))
    (tmp_path / "resume.txt").write_text(RESUME)
    (tmp_path / "posting.txt").write_text(POSTING)
    out = tmp_path / "out"
    args = ["content.json", "--resume", "resume.txt", "--posting", "posting.txt", "--out", "out"]
    return render.main([str(tmp_path / a) if not a.startswith("--") else a for a in args]), out


def test_clean_content_passes_with_one_page_each(tmp_path: Path, capsys) -> None:
    code, out = run(tmp_path, CONTENT)
    assert code == 0, capsys.readouterr().out
    pdfs = sorted(out.glob("*.pdf"))
    assert [p.name for p in pdfs] == [
        "Jordan_Rivera_Cover_Letter_Acme_Program_Coordinator.pdf",
        "Jordan_Rivera_Resume_Acme_Program_Coordinator.pdf",
    ]
    assert all(len(PdfReader(p).pages) == 1 for p in pdfs)


def test_invented_number_fails(tmp_path: Path, capsys) -> None:
    content = copy.deepcopy(CONTENT)
    content["resume"]["jobs"][0]["bullets"][1] = "Cut scheduling errors by 25% by tightening how calendars are confirmed."
    code, _ = run(tmp_path, content)
    assert code == 1
    assert 'NEW NUMBER: "25%"' in capsys.readouterr().out


def test_number_hidden_inside_a_longer_number_still_fails(tmp_path: Path, capsys) -> None:
    content = copy.deepcopy(CONTENT)
    content["resume"]["summary"] += " Trained 202 new hires."
    code, _ = run(tmp_path, content)
    assert code == 1
    assert 'NEW NUMBER: "202"' in capsys.readouterr().out


def test_short_last_line_fails(tmp_path: Path, capsys) -> None:
    content = copy.deepcopy(CONTENT)
    content["resume"]["jobs"][1]["bullets"][0] = (
        "Checked in patients and verified insurance details before each appointment began, so that the clinic "
        "team always had what it needed on time."
    )
    code, _ = run(tmp_path, content)
    assert code == 1
    assert "SHORT LAST LINE" in capsys.readouterr().out


def test_too_long_resume_shrinks_then_fails(tmp_path: Path, capsys) -> None:
    content = copy.deepcopy(CONTENT)
    content["resume"]["jobs"] *= 12
    code, _ = run(tmp_path, content)
    assert code == 1
    assert "TOO LONG: the resume" in capsys.readouterr().out
