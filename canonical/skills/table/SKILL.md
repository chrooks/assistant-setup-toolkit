---
name: table
description: "Render tabular data as a table — `/table md` for a quick read-only Markdown table, `/table html` for a self-contained interactive table with sort, filter, search, and column toggles. Use when showing comparative or multi-attribute data, lists of records, query results, or anything Chris should scan or manipulate as a table instead of prose."
argument-hint: "[md|html] <data, file, or description of what to tabulate>"
---

# /table — Markdown or Interactive Table Renderer

Chris reads and retains in table form. This skill turns tabular data into one of two
outputs, chosen by need:

- **`md`** — a read-only Markdown table, rendered inline in the response. The common case:
  data that just needs to be *seen*. Reach for this proactively whenever a response
  carries comparative or multi-attribute data.
- **`html`** — a single self-contained HTML file with sort, per-column filter, global
  search, and column toggles, opened in the browser. For data that needs to be
  *manipulated*: many rows, exploratory comparison, or something Chris will keep.

## Invocation

```
/table              <data>   → pick the mode by judgment (see below)
/table md           <data>   → force a Markdown table
/table html         <data>   → force the interactive HTML table
```

Aliases: `full`, `interactive`, `app` → `html`. `markdown`, `quick` → `md`.

`<data>` may be: data already in the conversation, a file to read (CSV/JSON/etc.),
a query result, or a prose description of what to tabulate.

## Mode Selection (bare `/table`)

Default to **`md`** — it is cheaper and covers most needs. Choose **`html`** only when
at least one is true:

- More than ~25 rows, or enough columns that scanning needs filtering.
- Chris will sort, filter, or search the data, not just read it once.
- Chris signals he wants to keep or revisit it ("a tool", "let me filter", "sortable").

When genuinely ambiguous, render `md` now and offer the `html` upgrade in one line.

## `md` Mode — Markdown Table

- Emit a GitHub-flavored Markdown table inline. No file, no browser.
- First row is headers; include the alignment row (`---`). Right-align numeric columns
  with `---:`.
- Escape literal pipes in cell values as `\|`. Replace newlines inside a cell with a
  space or `<br>`.
- Do **not** truncate rows or columns silently. If the data is large, render it and add
  one line: "That is N rows — say `/table html` for a sortable, filterable version."
- Keep cells terse and scannable. Lead with the column that anchors each row.

## `html` Mode — Interactive Table

The template at [`templates/table-template.html`](templates/table-template.html) is a
zero-dependency, single-file table whose filtering and sorting are ported from the
Cornerstone `/players` explorer (`FilterBar` + `playerFilters` + `SortControls`). It gives:

- **A composable filter builder** — pick a column, get the right input (text contains,
  a value dropdown for low-cardinality columns, or an operator `≥ ≤ = > <` + number for
  numeric columns), then **Add Filter**. Filters combine with **AND/OR** connectors, can
  be **NOT**-negated, grouped with **( )** parentheses, and drag-reordered. Evaluated
  recursively (AND binds tighter than OR), capped at 10 active filters.
- **Multi-key sort** — up to 3 keys, each with a direction toggle; click a header to sort
  by that column, or build secondary/tertiary keys in the Sort row.
- **Column toggles, global search, and pagination.**

Filter kinds are derived automatically from the column schema, so you do NOT hand-write
filters — just give good `type`s:

- `type: "number"` → numeric filter (operator + value), right-aligned, sorts numerically.
- `type: "string"` with ≤ 25 distinct values → a select dropdown filter.
- `type: "string"` with many distinct values → a text "contains" filter.

Build it with the bundled fill script — it injects your data, escapes `</script>` so a
hostile value cannot break the page, HTML-escapes the title, and writes a self-contained file.

### Steps

1. **Shape the data** into two arrays:
   - `COLUMNS`: `[{ "key": "name", "label": "Name", "type": "string" }, ...]`
     - `key` matches the row object keys. `label` is the human header — **labels must be
       unique**, they key the filter-type dropdown.
     - `type` is `"string"` or `"number"` — `number` sorts numerically and right-aligns.
   - `DATA`: `[{ "name": "...", "pts": 12 }, ...]` — one object per row.
2. **Write the spec** to a JSON file: `{ "title": "...", "columns": COLUMNS, "data": DATA }`.
3. **Run the fill script** (it lives in `scripts/` next to this SKILL.md; `templates/` is its sibling):
   ```bash
   python3 scripts/build-table.py spec.json        # or: build-table.py spec.json out.html
   ```
   It fills the template, escapes `</script>`/`<!--` in the data, HTML-escapes the title,
   writes to `<cwd>/.table-exports/<slug>.html`, and prints the absolute path.
4. **Open** the printed path: `open "<path>"` on macOS (`xdg-open` Linux, `start` Windows),
   and report it so Chris can find, move, or re-open it.

### Notes

- The template handles its own sort/filter/search/column-toggle — do not add libraries.
- Use the script, not a hand-rolled fill: it is the tested path
  (`tests/setup/skill-html-fill.test.ts`) that guarantees the `</script>` escaping.
- `.table-exports/` is a generated-output dir — mention it can be gitignored if the
  project does not already ignore it.

## Behavior

- No confirmation prompts. `/table md X` → table immediately. `/table html X` → build,
  open, report path.
- This skill is for *display*. It does not fetch or compute the data — it formats data it
  is given or can read.
- If the input is not actually tabular (no consistent columns), say so and suggest a list
  instead of forcing a table.
