---
name: sketch
description: "Make a UI decision concrete and comparable before the plan is final — name the top five Affordances a Surface must enable, harvest proven interaction patterns and platform conventions from real products that already solved them, then build three lo-fi HTML layouts to pick and mix into one. Use when shaping a new screen or rethinking an existing one; when the user says 'what should this look like', 'show me some options', 'wireframe this', 'give me a few layouts', 'what should a user be able to do here', or 'find me good examples of this'; or before /plan on any user-facing work. Structure only — aesthetics, color, and type are /impeccable. Not for auditing a built flow — that is /design-audit."
argument-hint: "<surface or feature> [existing]"
user-invocable: true
disable-model-invocation: false
allowed-tools: Read, Write, Glob, Grep, WebSearch, WebFetch
---

# /sketch — concrete before it is expensive

One move, three steps: decide what the Surface must let people do, find out how good
products already do it, then draw three different answers and keep the best parts.

Everything here is cheap to throw away. That is the point. A layout argued over as
three gray HTML pages costs a minute. The same argument after the build costs a week.

**It lands before `/plan` is final** — the acceptance criteria get written against the
chosen layout, not the other way round. Arriving at implement is too late: by then the
plan has already committed to a shape nobody saw.

## Boundary with `/impeccable shape`

They compose. This one goes first.

| | `/sketch` | `/impeccable shape` |
|---|---|---|
| Settles | **structure** — what exists, where, and in what order | **aesthetics** — color, type, visual direction |
| References | **functional** patterns: how a proven product solved the interaction | **aesthetic** anchors: mood and brand |
| Options | **three lo-fi HTML layouts**, always, to pick and mix | visual probes, when image generation exists |
| Actions | **top five** Affordances | one primary user action |

Hand the chosen layout to `/impeccable shape` as the structure it must dress.

## Quick start

    /sketch the order-review screen existing

Read the arguments positionally. The first is the Surface. `existing` means the screen
already exists and the job is to reconsider it, not invent it.

## Step 1 — The top five Affordances

What must this Surface let a person do? Name **five**, ranked. Not features — actions,
in the user's words: *"see what I still owe,"* not *"balance widget."*

- **Requirements exist** (`.tasks/<issue#>-<slug>/research/requirements.md`, from
  `/discover`) → derive the five from them, and name the requirement ID behind each.
  This is the bridge from what people said to what the screen does.
- **Existing Surface** → read the current screen first. List what people actually do
  there today, then re-rank. An action the screen makes easy and nobody needs is a
  finding.
- **Neither** → derive from the design frame, and mark all five `unsourced`.

Five is a ceiling, not a target. If only three matter, stop at three. The ranking is the
**Hierarchy** — the first action gets the most prominent place in every layout below.

## Step 2 — Harvest proven patterns

For each of the top five, find **how a good product already solved it**. The goal is to
take what is proven, not to invent.

- Search for real products doing the same action well. Prefer products the user already
  admires, then well-known ones in the same domain.
- For each pattern: the product, the specific interaction, **why it works**, and a link.
  "Stripe's invoice list" is a reference. "Clean and modern" is not.
- **Name the platform convention** each action is expected to follow — close in the top
  corner, primary action bottom-right in a dialog, destructive actions separated and
  confirmed, search at the top. Breaking a convention is allowed, but only on purpose,
  and the sketch must say so. An unmarked break is a bug.
- Two or three patterns per action at most. The same discipline `/build-or-buy` applies
  to repositories, pointed at interactions.

## Step 3 — Three lo-fi layouts, as HTML

Build **three genuinely different** layouts as self-contained HTML files. Different in
**structure** — what sits where, what is grouped, what is one step versus two — not in
styling.

HTML, not ASCII, because a layout lives or dies on real proportions: how much fits above
the fold, how a column collapses, how far the eye travels between related things. ASCII
hides all of it.

**Keep them lo-fi on purpose.** HTML makes polish tempting, and polish biases the pick
toward whichever option looks finished. So:

- Grayscale only. One `system-ui` font. Size is the only type variation.
- Regions are bordered boxes with a plain label. Body text is gray bars, not copy. Real
  words only on buttons, headings, and nav — those are structure.
- Images are gray boxes with an ✕. No icons, shadows, gradients, rounding, or motion.
- Inline CSS, no external requests, no framework. Each file opens straight from disk.
- **Every region gets a readable `id`** — `primary-action`, `order-list`, `filter-bar` —
  so the user can say "move `#filter-bar` above `#order-list`" and mean one thing.
- Tag each region with the Affordance it serves: a small `A1`–`A5` in its corner.
- A short header in each file: which of the five it serves best, which worst, and which
  harvested pattern it borrows.
- Mark a deliberate convention break inside the region that breaks it.
- **Every annotation carries one of five classes, and nothing else does:** `.tag`
  (Affordance tags), `.rid` (`#id` labels), `.break` (convention-break callouts),
  `.notes` (the notes list), `.anno` (any other note-only text). The calm copy hides
  exactly these, so text in no class leaks into it and UI copy in one vanishes from it.
- Make them disagree. If two layouts answer the same question the same way, one of them
  is wasted.

Write `layout-a.html`, `layout-b.html`, `layout-c.html`.

**Every HTML file ships as two copies: annotated and calm.** The annotated copy is for
talking about the layout by `#id`; the calm copy is for judging how it feels, with the
annotation layer gone and the ids still in the markup. Generate the calm copies — never
write one by hand — with the bundled script, and re-run it after every edit:

    python3 <this skill's directory>/make-calm.py sketch/layout-a.html sketch/layout-b.html sketch/layout-c.html

It writes `layout-a-calm.html` and the rest beside each source.

**Render every file, annotated and calm, at the target viewport and look at it before handing off** — headless,
never a window on the user's screen. Overflow, a region pushed below the fold, and a
ranked-higher Affordance sitting under a lower one only show in a render; the markup
reads fine. Found by the first run: a lane map whose tags overflowed at 1440px, and a
merged detail pane that put A4 above A2 and sank A2 below the fold. No headless browser
available → say so, and call the layouts unrendered.

Then tell the user how to open them — serve and link **both** copies of every file, calm
and annotated. On a remote machine, follow the machine context for serving — never a
localhost URL.

## Step 4 — Pick and mix

Ask the user which parts of which layout to keep. This is **taste** — their side of the
Division of Responsibility. Offer a recommendation and its one reason, never a neutral
menu.

Then build the amalgamation as `chosen.html`, same lo-fi rules, run `make-calm.py` on it
for `chosen-calm.html`, and confirm it before anything moves to `/plan`.

## Where it lands

`.tasks/<issue#>-<slug>/sketch.md` — the five, the patterns with links, and the pick.
The layouts sit beside it in `sketch/`: `layout-a.html` through `layout-c.html`, and
`chosen.html`, each with its `-calm.html` copy. `/plan` reads `sketch.md` and the
annotated `chosen.html`.

## Handoffs

- Chosen layout → `/plan`. Each acceptance criterion names the Affordance it serves.
- Structure settled → `/impeccable shape` dresses it.
- Built → `/design-audit` checks the result against these five.

## Completion criteria

- [ ] Five or fewer Affordances, ranked, in the user's words — sourced or marked `unsourced`
- [ ] Every harvested pattern names a real product, the interaction, why it works, and a link
- [ ] Every platform convention is named, and every deliberate break is marked
- [ ] Three self-contained HTML layouts that differ in structure, not styling
- [ ] Every region has a readable `id` and an Affordance tag
- [ ] Every HTML file has a `-calm.html` copy made by `make-calm.py`, and both copies were served and linked
- [ ] Every file, annotated and calm, was rendered at the target viewport and looked at, `chosen.html` too
- [ ] The user chose, and the amalgamation was confirmed before `/plan`
