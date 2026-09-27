# Development Workflow

> Extends [common/git-workflow.md](./git-workflow.md) with the work that happens before git.

## Four principles for every problem → solution

Name what each demands before building. Give a build order that proves the first case by hand without blocking the rest. `/scope` names the four demands; `/plan` carries them into the ExecPlan.

- **Human-centered design**: meet people where they are and help them get where they need to go.
- **Solution architecture**: one home per responsibility. Name the Boundaries and the Seams.
- **Solve at scale, three levels**: this case, all cases, the pattern. Design the Contracts generically first; write code after the first case lands by hand.
- **Separation of concerns**: honor every Boundary the work sits inside: data, money, record. One repo per context, one machine per repo; no cross-repo read.
<!-- Case: a classifier built for one account, then re-planned for all accounts and for reuse across the business (2026-09-15). -->

## Feature implementation

Route new work through `/scope`, then the workflow it picks. `/implement` holds the build steps: research and reuse first, `/tdd` to build, `/code-review` or `/review-fanout` after, `/commit` last.

## Proof Before Done

Work that changes runtime behavior is done only when you have driven the affected flow for real. A compile, lint, or unit-test pass is not proof.

- This applies to subagent work too. Never relay an agent's "done" before you drive the flow.
- **Drive browsers headless, always.** A Chrome window must never appear on the user's screen. Go headed only when the user asks to watch.
<!-- Case: a headed prove run popped a window mid-game (2026-08-06). -->
- **Prove on the Surface the user opens, and name it.** State the exact URL or screen before you drive: `https://dex.hestia.chrooks.com`, not `localhost:3000`. If you proved somewhere else, or nowhere, say so in the same sentence and call the work unproven.
<!-- Case: "Photos are on the site — driven in a headless browser" → "I dont see it. Im on the dev site" (2026-08-02); the same failure on a second dev site (2026-08-27). -->
- Lead the completion report with a `Proof:` line, then the change detail.
- **A target mockup is the acceptance criterion.** Screenshot the built page, compare it with the reference image, and close the gap until they match. "It builds" and "it looks like the design" are different claims.
<!-- Case: ~12 "I don't see it / still broken" corrections in one project cycle (2026-07 loop audit). -->

## Quote Every Add

Quoting is project management, the assistant's side of the **Division of Responsibility**. Scope that the user adds mid-work gets a price before work starts, so that cutting stays possible.

- **An add** is new behavior, a new Surface, or a new case beyond the agreed task. A clarification, a correction, or a fix to the current work is not an add.
- **Quote in one line, then recommend:** its size in sessions, what it pushes back, and keep or park. "Two M commits, about 20 active minutes: under one session. The export work moves to after this. Recommend: park it."
- **Price from measured rates, never from instinct.** Instinct gives human-developer days, which is wrong by an order of magnitude. List the planned commits and size each one by lines changed: S up to 50, M up to 200, L above 200. One commit costs about 6 (S), 9 (M), or 15 (L) active minutes and 1–2 user turns. A session is one sitting: about 50 active minutes, or 3–4 commits. Each rate can be off by 2× either way. Never quote in days or weeks.
<!-- Rates: 402 build sittings, Jul–Sep 2026 archive; per-commit medians by diff size. Re-measure at each 12-week cycle boundary. -->
- **The user answers keep or cut.** Cut → park it as a tracker issue, so that cutting loses nothing.
- **Small enough to finish this turn, and it displaces nothing?** Do it and name it in one line. No quote, no decision.
- **Never ask the user for an estimate.** The studio quotes; the user decides.
<!-- Case: ~370 adds against ~11 scope cuts and zero estimates in 5,584 turns (2026-09 archive sweep). -->

## Close the Loop

After a unit of work, run the capture pass without being asked:

- **Tracker**: do it. Update the issue, create issues for side ideas, close what is verified (`/to-issues`), then report in one line. Ask first only for a direction change or a destructive edit.
- **Docs**: update runbooks and docs when the work changed how something operates, or offer in one line.
- **Memory**: save non-obvious learnings that matter next session, or offer in one line.
