---
name: figure
description: "Render data as a chart/figure — `/figure md` for a quick inline ASCII bar/sparkline, `/figure html` for a real interactive D3 figure (Observable Plot, hover tooltips, color legend). Use when showing a dataset as a chart in chat (a la /table and /diagram), OR when building chart components in frontend code — there it writes bespoke raw D3. The dataviz-craft sibling of /impeccable: honest axes, deliberate visual encoding, color-for-data not decoration, no chartjunk. Reach for it for trends, comparisons, distributions, rankings, parts-of-whole, correlations."
argument-hint: "[md|html] [chart-type] <what to chart, or the data>"
---

# /figure — Data Visualization Craft + D3 Renderer

The dataviz counterpart to `/impeccable`. `/impeccable` makes interfaces excellent; `/figure`
makes a *chart* excellent — then renders it. One skill, two render modes, plus a frontend-code mode.

It rides on `/impeccable`'s rule that "data visualization is treated as part of the design
system, not an afterthought." The craft layer below is the non-negotiable part — the renderer
is just the delivery.

## Invocation

```
/figure            <what>   → pick the mode by judgment (see below)
/figure md         <what>   → inline ASCII bars/sparkline in chat
/figure html       <what>   → real interactive D3 figure in the browser
```

You may name a `chart-type` after the mode: `bar`, `barh`, `line`, `area`, `dot`/`scatter`.
The type drives the encoding, not a separate tool.

## The Craft Layer (do this BEFORE rendering, every time)

Pick the encoding from the *question*, not the data shape. The shape a chart carries:

| The question / data shape | Chart type |
|---|---|
| Change over time, a trend | `line` (or `area` for cumulative/volume) |
| Compare values across categories | `bar` (vertical) / `barh` (long labels, many categories) |
| Rank items | `barh`, sorted |
| Relationship between two numbers | `dot`/`scatter` |
| Distribution of one number | histogram (raw `plot` spec) |

Non-negotiable craft rules (these are the whole point of the skill):

- **Honest axes.** Bar/area charts **start the value axis at 0** — truncating exaggerates. Line charts may zoom the y-range, but say so.
- **Encode with judgment.** One number → length (bars) reads more accurately than angle (pie) or area. Avoid pie beyond ~3 slices; prefer a sorted `barh`.
- **Color carries data, not decoration.** Use a color split only for a real series/category. Don't rainbow a single series. Cap distinct series at ~6–7; beyond that, facet or aggregate.
- **No chartjunk.** No 3-D, no gradients-for-vibes, no gridline clutter. Maximize data-ink.
- **Label the units and the takeaway.** Title states the point; subtitle states units/scope.
- **Sort categorical bars by value** unless the category has a natural order (months, sizes).

If the request is bland ("just chart this"), still apply the rules — that is the `/impeccable`
posture: commit to a deliberate, honest encoding.

## Mode Selection (bare `/figure`)

Charts are inherently visual, so default to **`html`** — ASCII is lossy for anything but a
simple ranking. Choose **`md`** only when the data is a single ranked/compared bar series
(categorical x, one numeric y, ≲ 20 rows) and a quick inline read beats opening a file.
A `line`/`scatter`/multi-series figure → always `html`.

## `md` Mode — Inline ASCII bars / sparkline

For a one-dimensional ranking or comparison, print a horizontal bar sketch inline so the shape
lands immediately in chat. Scale bars to the max value; use block chars; right-pad labels.

```
Revenue by region (USD, FY25)
NA   ████████████████████  1.84M
EU   █████████████         1.20M
APAC ███████               0.64M
LATAM ███                  0.28M
```

Conventions: full block `█`, partial `▏▎▍▌▋▊▉` for the last cell, ` ` for empty. Print the
real value at the end of each bar. For a time series, a unicode sparkline `▁▂▃▄▅▆▇█` is fine.
If the data isn't a clean 1-D ranking, say so and switch to `html`.

## `html` Mode — Interactive D3 Figure

The template at [`templates/figure-template.html`](templates/figure-template.html) loads
**Observable Plot** (D3 by the same author — the concise grammar over D3 scales/axes) plus D3
itself from CDN. It gives axes, a color legend, and hover tooltips for free.

### Steps

1. **Apply the craft layer** — choose the type, sort, decide the axis baseline, pick whether a
   color series is warranted.
2. **Shape the spec** (JSON-friendly, the common path):
   ```json
   {
     "title": "Revenue by month",
     "subtitle": "FY25, USD",
     "type": "line",
     "data": [{ "month": "Jan", "revenue": 100, "region": "NA" }],
     "x": "month",
     "y": "revenue",
     "series": "region",
     "options": { "marginLeft": 60, "y": { "grid": true } }
   }
   ```
   For anything the high-level shape can't express (histograms, multi-mark overlays, custom
   scales), use the raw escape hatch: `{ "title", "plot": { ...PlotOptions, "marks": [{ "mark": "rectY", "data": [...], "options": {...} }] } }`.
3. **Run the fill script** (lives in `scripts/`, siblings `templates/`):
   ```bash
   python3 scripts/build-figure.py spec.json     # or: build-figure.py spec.json out.html
   ```
   It injects the spec, escapes `</script>` in the data, HTML-escapes the title, writes to
   `<cwd>/.figure-exports/<slug>.html`, and prints the absolute path.
4. **Open** the printed path: `xdg-open "<path>"` on Linux (`open` macOS, `start` Windows), and report it.

### Notes

- Use the script, not a hand-rolled fill — it is the tested path
  (`tests/setup/skill-html-fill.test.ts`) that guarantees the `</script>` escaping.
- `.figure-exports/` is generated output — mention it can be gitignored.
- Plot is loaded from CDN (needs internet when opening). To vendor it offline, drop the UMD
  bundles into a `vendor/` sibling and inline them like `/diagram` — add that only if you
  actually need offline figures.

## Frontend Mode — Bespoke raw D3 in a repo

When the task is *building a chart component in real frontend code* (not a chat figure), write
**raw D3** matching the repo's stack and conventions — `d3.select`, scales, `axisBottom`, an
`enter/update/exit` join or a React-friendly ref. This is where D3's full control earns its
keep. Same craft layer applies. Reuse the project's design tokens (colors, type, spacing) from
`/impeccable`'s system rather than inventing chart-only styles.

Use Observable Plot in frontend code too when the chart is standard and you want less
boilerplate — but reach for raw D3 the moment you need bespoke interaction, layout, or animation.

## Behavior

- No confirmation prompts. `/figure md X` → ASCII sketch immediately. `/figure html X` → build, open, report path.
- This skill renders the data you give it (or data already in context). It does not go fetch a dataset for you.
- Reach for `/figure` proactively when a number-story would land better as a chart than a `/table` —
  a trend, a comparison, a correlation, a ranking, a distribution.
