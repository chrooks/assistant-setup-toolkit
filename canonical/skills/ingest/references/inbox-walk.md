# Inbox walk — many sources, one at a time

The user has a backlog in `<rawDir>/inbox/` and wants it cleared. This is Steps 1–6 of the
main flow run in a loop, with one addition that makes it survivable: **a fixed presentation
format per file, and a hard stop for approval before any write.**

Fire on: "ingest the inbox", "ingest my inbox one at a time", "work through the backlog",
"explain each file before executing".

## The loop

1. **Enumerate once.** `ls -la <rawDir>/inbox/` — this gives you N. Say the count up front so
   the user knows the size of what they agreed to.
2. **For each file, in order:** read it fully → present it in the format below → **stop.**
3. **Wait for approval.** Do not write, and do not read ahead to the next file. Approval is
   per-file; "good" on file 7 says nothing about file 8.
4. **On approval:** write the pages, update `index.md` and `log.md`, move the raw to
   `<rawDir>/archived/`.
5. **Then, and only then,** move to the next file.

A single log entry per file keeps the log parseable and lets the user see the walk's shape
afterwards. Don't batch several files into one entry.

## The presentation format

Fixed shape, every file. Predictability is the point — the user is reviewing many of these in
a row and should never have to hunt for the decision.

```
**File X of N: [filename](path/to/file.md)**

What's in it — <one clause framing what kind of thing this is>:

- <the substance, as bullets — quote the lines that carry weight>
- <what's notable, surprising, or connects to something already in the wiki>

How I'd file it:

- <destination page(s) and why — new page vs. fold into existing>
- <cross-links you'd add>
- <what you'd drop, and why>

<One closing question, only if a real decision is open.>
```

Rules for the format:

- **Link the file** so the user can open it alongside your summary.
- **"What's in it" is a report, not a pitch.** If the file is thin, say it's thin. If it's
  four years stale, say so.
- **"How I'd file it" is a plan the user can veto in one word.** Name real destinations, not
  categories.
- **Ask at most one question**, and only when the answer changes the work. A file with an
  obvious home gets a plan and a "Good?" — not a menu.
- **Say when something is already held.** Much of a real backlog duplicates what the wiki has.
  Reporting "~90% of this is already on `<page>`; only X and Y are new" is the honest result
  and saves the user a redundant approval.

## Batching only the trivial

Two or three genuinely tiny fragments (a saved lyric, a one-line jot) may be presented
together in one turn, clearly labelled "Files X & Y of N". Anything with real content gets its
own turn. When in doubt, don't batch — the user asked for one at a time.

Small fragments usually shouldn't each become a page. A single running collection page
(`fragments.md` or similar, newest first, each entry keeping its original capture date) beats
either bloating the wiki or dropping them.

## Before proposing a new page, check what already exists

The most common failure in a long walk is creating a page that duplicates a list already
living on a hub. Before proposing a **new collection page**, grep the wiki for the concepts it
would hold — hubs often already carry a "smaller seeds" or "backlog" section that is the
correct home. Folding into the existing list is almost always right.

If a duplicate does get created, delete it, fold the content into the canonical page, and
**log the reversal** rather than quietly removing it.

## When a raw contradicts the wiki

A backlog raw is often the *original* of something already summarised, and it can expose bad
metadata — a wrong date, a mis-attributed quote, a page pointing at the wrong source file.
Fix it, leave an inline correction note with the date on the affected page, and record the
correction in `log.md`. Never silently overwrite; the correction is the valuable part.

## Pace and consent

- The user may say "slow down". Take it literally: one file per turn, and re-surface anything
  you wrote that they haven't yet reviewed.
- When the user says to drop something, drop it — archive the raw with **nothing** filed, and
  say so in the log entry.
- Sensitive material (a deceased relative, a private conflict) gets named, handled lightly,
  and offered a route out of the wiki entirely rather than filed on judgment.
- Every few files, a short pause report — what landed, what's left — keeps a long walk
  reviewable.

## Finishing

The walk ends when `inbox/` is empty. Close with a consolidated report: new pages by domain,
pages updated, corrections made, and anything still open for the user to decide.
