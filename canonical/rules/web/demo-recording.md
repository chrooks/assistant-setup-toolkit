---
paths:
  - "**/e2e/**"
  - "**/*.spec.*"
---
> This file extends [testing.md](./testing.md) with the convention for recording a
> watchable demo clip. Playwright (Node) is the reference implementation.

# Demo Recording

Some acceptance criteria cannot be settled by an assertion. "Does this layout read
right", "is the flow smooth", "does the empty state feel dead" — these need a human
to look. A recorded clip turns that from *"go re-drive the app yourself"* into
*"watch fifteen seconds during assess."*

The clip is **evidence for a human**, never a substitute for an assertion. If the
behavior is mechanically checkable, assert it and skip the recording.

## One clip per criterion

Record each criterion in its own browser context, and name the file after the
criterion. Do not record one long session and hand back timestamps — bare `.webm`
carries no chapter track, so a timestamp means the viewer scrubs, and you own the
offset bookkeeping for no gain.

Independently named clips are cheap (about a second of context startup each) and
let the reviewer open only the one criterion they doubt.

## The recipe

Verified against Playwright 1.62.1.

```ts
import { chromium } from 'playwright';
import { rm } from 'node:fs/promises';

const SIZE = { width: 1280, height: 800 };

async function recordCriterion(id: string, slug: string, drive) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    // Match the viewport to the video size, or the clip is letterboxed with a
    // grey bar where the default 720-high viewport falls short.
    viewport: SIZE,
    recordVideo: {
      dir: '.tasks/current/proof/',
      size: SIZE,
      // Overlays the action title, a rendered cursor, and a highlight on the
      // element being touched. This is what makes it a demo, not a screen capture.
      showActions: { duration: 700, position: 'top-right', fontSize: 24 },
    },
  });

  const page = await context.newPage();
  await drive(page);

  // The video is only finalized once the page or context closes.
  await context.close();

  const raw = await page.video()?.path();
  await page.video()?.saveAs(`.tasks/current/proof/${id}-${slug}.webm`);
  // saveAs copies rather than moves — drop the hash-named original.
  if (raw) await rm(raw, { force: true });

  await browser.close();
}
```

Notes that bite if ignored:

- **`await context.close()` before reading the video.** Playwright finalizes the
  file on close; skip it and you get a truncated or missing `.webm`.
- **Rename explicitly with `video().saveAs(path)`.** The default filename is a
  random hash, which defeats the whole point of per-criterion naming. `saveAs`
  **copies** — delete the original or the proof directory fills with hash twins.
- **Set `viewport` equal to `recordVideo.size`.** Mismatched, the page renders at
  the default viewport and the video pads the difference with grey.
- **Output is `.webm` only.** There is no mp4 option. Anything that needs to travel
  to a surface which cannot play `.webm` needs a conversion step.
- **`showActions` labels can clip at the viewport edge.** At `top-right` on a
  narrow viewport the action title runs off the frame. Move it to `top-left` if
  the clip is being recorded narrow.
- **`showActions` is a recent option.** On an older Playwright it is ignored and you
  still get a usable clip, just without the overlays — degrade, do not fail.

## Where clips land

`.tasks/<issue#>-<slug>/proof/<criterion-id>-<short-slug>.webm`

`.tasks/` is gitignored, so clips stay local by default. That is correct for the
prove stage, where the reviewer is on this machine. Moving a clip anywhere else is
a separate decision — do not push clips to a remote surface without one.

## Guardrails

- **Drive the real flow.** A clip of a page loading proves nothing; the clip has to
  show the interaction the criterion describes.
- **Keep it short.** One criterion, one path through it. If a clip runs past about
  thirty seconds, the criterion is doing too much.
- **Prefer this over headless Google Chrome screenshots**, which are known to crash
  on this machine. Playwright drives its own bundled Chromium and is unaffected.
- **Add a trace when the clip raises a question it cannot answer** —
  `context.tracing.start({ screenshots: true, snapshots: true })` produces a
  scrubbable DOM timeline. A video shows what happened; a trace shows why.
