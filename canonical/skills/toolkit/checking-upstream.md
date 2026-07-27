# Checking upstream

Some Skills in `canonical/skills/` were copied from, or wrap, Skills that live in
other people's public repositories. This branch answers one question: **has any of
that upstream work moved since we last looked?**

Run it, read it, decide. The check itself is a plain script that costs no tokens:

    npm run check-upstream

## The record

Each tracked Skill declares where it came from in its own `SKILL.md` frontmatter:

    ---
    name: security-review
    description: Review code for security vulnerabilities before committing.
    upstream:
      repo: affaan-m/everything-claude-code
      path: skills/security-review/SKILL.md
      ref: 7113b5bf63694b716f8b2413c5919824a82fc095
      relationship: near-copy
    ---

`ref` is **not** the current upstream tip. It is the commit this repository was last
reconciled against — the point at which a human read upstream and decided the local
file was correct.

The block lives in frontmatter rather than a central lock file so it travels with the
Skill: renaming or moving a Skill directory cannot orphan it, and a reader sees the
answer at the moment they are confused.

## The four relationships

`relationship` is declared by a human, never derived. No diff can tell a deliberate
rewrite from a stale near-copy, because that distinction is a decision somebody made.

| Relationship | What it means | What a hit implies |
|---|---|---|
| `verbatim` | Byte-identical to upstream on purpose | Re-copy the upstream file — ADR-0001 requires it stay identical |
| `near-copy` | Copied, then lightly edited | Port the change by hand, preserving the local edits |
| `rewrite` | Local file is the real implementation; upstream's is thin or different | Review for interest only; usually nothing to do |
| `wrapper` | A short local Skill layering overrides on a *fetched* upstream Skill | Check whether the wrapped Skill's contract moved under the overrides |

`wrapper` is the dangerous one. There is no local copy of the upstream file, and the
upstream Skill re-downloads on every install, so its foundation shifts continuously
underneath a local file that says "upstream tells you to do X, we do Y instead." When
upstream stops saying X, the override is describing something that no longer exists.

## Drift is upstream-then vs upstream-now

The check compares **upstream at the recorded `ref` against upstream at its current
tip**. It never compares the local file against upstream.

That framing is easy to get backwards and the reverse does not work. Local-vs-upstream
reports "these files differ" forever for every `rewrite`, which is noise, and it cannot
run at all for a `wrapper`, which has no local copy to compare. Upstream-then vs
upstream-now asks the only useful question — *what did the other project change since
we last looked* — and asks it identically for all four relationships.

## The check reports; it never writes

Not even for `verbatim`, where re-copying would be mechanically safe. Automatic
application needs write logic, a backup path, and conflict handling — strictly more
code than printing — and a script that silently rewrites a Skill file is the kind of
thing discovered at an inconvenient hour.

Acting on a hit is a **`/toolkit update`** on the affected Skill: read the upstream
commits, decide whether the change is worth taking, apply what is, then install.

## Advance the `ref` after every port

A `ref` left at its old value re-reports the same upstream commits forever, and a
report that cries wolf stops being read. After porting an upstream change — or after
reading it and deciding deliberately not to take it — set the Skill's `ref` to the
commit you reconciled against. Deciding not to port is still a reconciliation.

## `path-missing` means a human re-points it

When the recorded `path` no longer exists upstream, the check prints the Skill under a
loud heading and stops evaluating it. It does not guess where the file moved.

Rename detection ends in a heuristic; a human editing one line of frontmatter is faster
and cannot be wrong. Re-point `upstream.path` at the file's new home, or — when the
upstream Skill is genuinely gone — delete the whole `upstream:` block, because the
Skill is locally owned now.
