---
name: letterhead
description: Render Markdown files to branded PDFs with a running letterhead, page numbers, and print typography, styled by a CSS file the repo owns. Use when the user invokes /letterhead, asks to make a PDF from markdown, export or print a document, send a contract, proposal, invoice, brief, or report to someone outside the repo, or wants a document on company letterhead.
argument-hint: "<file.md> [more.md ...]"
allowed-tools: Read, Write, Edit, Bash
disable-model-invocation: false
---

# /letterhead — Markdown to a Branded PDF

One command turns a repo's Markdown into a PDF a client can receive.

    <skill>/scripts/md2pdf.py path/to/doc.md

The PDF lands in `.exports/pdf/doc.pdf`. Several files at once is fine.

Model invocation stays **on** deliberately. The natural ask — "send that as a PDF" —
arrives in conversation, and the blast radius is one new file in an ignored directory.

## The one idea

**Styling lives in CSS; the script never changes.** Branding is a file the repo owns,
so a logo change or a new colour is a CSS edit, not a code edit.

The script resolves its stylesheet in this order:

1. `--css PATH`, if given.
2. `<repo root>/brand/letterhead.css`, if it exists. **This is the normal case.**
3. The bundled `templates/letterhead.css`, as a fallback.

## First run in a new repo

1. Copy the template in, then edit the two obvious strings:

       mkdir -p brand && cp <skill>/templates/letterhead.css brand/letterhead.css

2. In `brand/letterhead.css`, replace `ORGANISATION NAME` and `example.com` in the
   `@page` block. Those are the running header.
3. Add `.exports/` to `.gitignore`. Rendered PDFs are build output, not source.
4. Render something and look at it before trusting it.

## Prerequisites

- **`uv`** runs the script and fetches its Python dependencies. `brew install uv`, or
  `curl -LsSf https://astral.sh/uv/install.sh | sh`.
- **Pango**, a system text-drawing library the PDF engine needs. It is not a Python
  package, so `uv` cannot supply it:
  - macOS — `brew install pango`
  - Debian or Ubuntu — `sudo apt install -y libpangocairo-1.0-0 libpangoft2-1.0-0`

The script names the missing piece and the install line rather than printing a traceback.

## Options

| Flag | Effect |
|---|---|
| `--css PATH` | Use this stylesheet instead of the resolved default |
| `--out DIR` | Write PDFs here instead of `<repo>/.exports/pdf` |

## Changing the look

Everything visual is in `brand/letterhead.css`.

- **Running header** — the `@top-left` and `@top-right` rules inside `@page`.
- **A logo instead of text** — put the image in `brand/` and swap the rule:

      @top-left { content: url("logo.png"); }

- **Page numbers** — the `@bottom-right` rule, using `counter(page)` and `counter(pages)`.
- **A clean cover page** — the `@page :first` block suppresses the running header on
  page one, so the document title carries it instead.
- **Paper size** — `size: letter` or `size: a4` in `@page`.

## Why this engine

WeasyPrint supports `@page` margin boxes. That is the CSS feature that puts a repeating
header and footer on every page, and it is exactly what a letterhead is.

Chromium print-to-PDF — which is what "Export to PDF" does in most editors, Obsidian
included — does not support them. Reach for this skill rather than an editor's export
whenever the document leaves the building.

## Checks before handing a PDF to anyone

- [ ] Page one looks right, and the running header starts on page two
- [ ] Page numbers read `n of N`
- [ ] Tables fit the page width and did not overflow
- [ ] No drafting notes or bracketed blanks survived into the client copy
- [ ] The file went to its destination, not just to `.exports/`

## Troubleshooting

**A traceback about `libpangoft2` or `libpango`** — Pango is missing. See Prerequisites.

**Fonts look wrong** — the CSS names a font the machine does not have. Every font stack
in the template ends in a generic family, so add your face to the front of the stack
rather than replacing the stack.

**The header is missing entirely** — the running header is suppressed on page one by
design. Check page two before changing anything.
