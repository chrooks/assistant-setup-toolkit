---
name: decision-doc
description: "Write a decision document — the decisions and your recommendation BLUF (bottom line up front), then the measured evidence in the order a reader needs it — and post it where the work is tracked. Use when a call is the user's to make and rests on data: a threshold or rule cut, a scoring weight, a set of options with measurable costs, or when the user asks for 'a more considered approach' to a number. Also when another Skill needs the user's approval on a measured tradeoff."
---

# Decision document

A **decision document** puts the decision **BLUF**: the choices the reader must make, each with a recommendation, before any evidence. Everything after it is evidence, sequenced so the reader can stop reading the moment they trust the recommendation. It is built to be read in a GitHub comment on a phone.

The reader owns the taste; you own the measurement. So every number is **measured**, never estimated, and every claim names a concrete example — a player, a record, a file — the reader can check against what they know.

Not for a single yes/no that fits one line (answer it in the reply, with the recommendation), and not for a completion report.

## Steps

1. **Measure.** Pull every number from the real data through the production code path, read-only. Keep the raw outputs (a scratch JSON per run) so the verifiers in step 4 can compare.
   Done when: each figure the document will cite exists in a saved output.
2. **Build the options.** Always include today's state as the baseline, your recommendation, a small-change alternative, and any tested extreme that teaches something. Measure each one the same way, with the same named examples.
   Done when: every option has counts and a named-examples column, and you can say in one line why the recommendation beats the small-change alternative.
3. **Write** in the section order below. [example.md](example.md) is a complete, abridged instance.
   Done when: all eleven sections exist or are consciously dropped (a section with nothing to say is omitted, not padded).
4. **Verify.** Hand the document to independent read-only verifiers, one lens each — *numbers* (re-derive every figure with their own queries), *logic* (does each claim hold against the code), *names* (is every named example in the right bucket). Tell them to refute. Fix every slip they prove before anything is posted.
   Done when: every claim is verified or corrected, and the corrections are in the file.
5. **Post.** The full document goes as a comment on the tracker issue that owns the question; link it from the parent issue and record it in the plan. In chat, give only the decisions table, the reply line, and the link.
   Done when: the comment URL resolves (read it back — a silent CLI failure is common) and the chat reply fits one screen.
6. **Act on the answer exactly as numbered.** A parked item becomes its own issue in the same turn. Show the staged result before anything irreversible, and say "commit" is the reader's word, not yours.

## Section order

1. **Title** — the thing, and "what it costs": *Spot Up Shooter — the stat rule, and what it costs*.
2. **The decisions, BLUF.** A numbered table: `# · Decision · My recommendation`. Then one line showing a complete reply (*"1, 2, park 3" is a complete answer*), and one line saying everything below is the evidence.
3. **Provenance** — one line: what was measured, against how much data, through which code, read-only.
4. **What it asks, in plain words.** Each input as a bold question, then the technical name, a plain definition, and one concrete example with its real value.
5. **What today's state does.** Findings as bold lead-ins, each carrying its number and named examples. Include where today's state misses its own documented expectations.
6. **The distribution** — a percentile table of each input, then one line reading the proposed cuts in percentile terms.
7. **The options, measured** — a counts table (baseline first, recommendation bold), a named-examples table across the options, and what the recommendation moves: grouped lists with counts and names.
8. **Why the obvious yardstick does not decide it** — only when one exists (earlier human calls, an old benchmark); show the measurement that proves it cannot separate the options.
9. **The add** — any scope the analysis surfaced, sized in sessions, with a park-or-keep recommendation. Never folded into the recommendation.
10. **What happens when you answer** — numbered steps, including any window where the reader must not act (a staged change, a running job).
11. **Caveats** — last, one line each.

## Form rules

- **Decision before detail, at every level:** a table's reading line goes above or beside it, never three paragraphs later.
- A comparison is a table; a finding is a bold lead-in sentence; a list of names carries its count.
- Every recommendation names its one reason and the alternative you are not recommending.
- Tables stay narrow enough for a phone — about seven columns; split a wider one.
- Prose follows the reader's writing instructions (plain register, short sentences) when they exist.
