---
name: build-or-buy
description: Decide whether to build an idea in-house or adopt, fork, or harvest existing open source — runs a star-ranked GitHub search that surfaces well-starred maintained repos instead of abandoned toys, reads the top candidates for fit, license, and health, and returns a build/adopt/fork/harvest verdict with the runner-up named. Use when the user has a new idea, feature, tool, or capability and asks "should I build this", "build or buy", "does this already exist", "is there a repo for this", "find prior art", "what's out there", or before starting any net-new implementation.
argument-hint: "<the idea or capability>"
user-invocable: true
---

# Build or Buy

Answer one question: **is this worth writing, or does something already do 70% of it?**

Default posture is adopt — but never outsource the thing that *is* the product,
and never build the plumbing.

## Step 1 — State the capability, not the idea

Compress the request into one sentence of **capability**, plus the hard constraints.
Search matches capabilities; it does not match product names or pitches.

- **Capability** — verb plus object. "detect scene cuts in video", not "the thing
  that makes my video skill smarter".
- **Constraints** — language/runtime, license ceiling, deploy target, must-haves.
- **Core or plumbing?** Is this the differentiator or the scaffolding? Write the
  answer down *now*, before seeing candidates. It is the tiebreaker in Step 4 and
  it is very easy to rationalize after a shiny repo shows up.

Ask one clarifying question only if the capability is unreadable. Otherwise proceed.

## Step 2 — Search, ranked

Never run a bare `gh search repos`. Use the bundled script:

```bash
bash ./search-github.sh "scene detection" "shot boundary" "video segmentation" --lang python
```

Invoke it through `bash` — the Codex projection does not preserve the exec bit.

It fixes the two failures that make GitHub search look useless:

1. **Default sort is `best-match`**, which floats one-off forks above maintained
   projects. The script forces `--sort=stars --order=desc` and unions a
   best-match pass back in so relevance survives.
2. **Long queries return near-nothing.** GitHub ANDs keywords across name and
   description only, so a four-word query matches almost no real repo — and the
   handful of toys that survive then sort to the top regardless of the sort flag.
   *This is the bigger bug, and it reads exactly like "it ignores stars."* The
   script hard-rejects queries over three keywords.

So: **2-3 keywords per query, 3-5 different phrasings.** Naming conventions differ
across ecosystems — "shot boundary" and "scene detection" are the same capability
with no shared vocabulary. Brainstorm the synonyms before searching.

Flags: `--lang`, `--topic` (higher precision than keywords when a tag exists for
the domain), `--limit`.

In the same pass, also check:

- **Package registries** — npm, PyPI, crates.io. Weekly downloads are the
  registry's star count. An installable library beats a repo you have to vendor.
- **Context7** for any candidate that turns out to be a documented library — it
  tells you the real API surface faster than the README does.

Reach for web search only if both come up dry.

## Step 3 — Read the top five, not the top one

Stars are a **prior, not a verdict**. 40k stars last touched in 2022 loses to 800
stars shipping monthly. The script sorts by stars so the strong prior is on top;
the other columns exist so you can overrule it.

| Signal | Kills the candidate when |
|---|---|
| Fit | covers under ~50% of the capability, or you'd fight it the whole way |
| License | copyleft (GPL/AGPL) and this ships closed — or no license file at all |
| Last push | over ~18 months in a domain that moves |
| Bus factor | one author, no releases, no CI |
| Issues | open far outpacing closed, or maintainer has stopped replying |
| Size | after a fork you own every line — read the LOC and the test count |

## Step 4 — The verdict

Pick exactly one, and name the runner-up.

| Verdict | When | Next |
|---|---|---|
| **Adopt** | fits ≥70%, healthy, license clean, real extension points | add the dependency, `/scope` the glue |
| **Fork & tweak** | fits well but internals must change; small enough to own; permissive license | fork, `/seed-project` the wrapper, record the upstream ref |
| **Harvest** | one hard part is solved there — a parser, an algorithm, a protocol — and the rest is yours | port that piece with attribution, build around it |
| **Build** | nothing clears ~50%, **or** this is the differentiator | `/scope` → `/plan` |

Two forcing questions before landing on **Build**:

- What exactly would you write that the top candidate already ships? Put a number
  of days on it.
- If you fork, what is the exit cost when upstream diverges? A fork nobody
  rebases is worse than either pure option.

**Build is genuinely right sometimes** — when it is the product's edge, when every
candidate is a bad fit, when the dependency is bigger than the problem. Say that
plainly rather than forcing an adopt to look thorough.

## Step 5 — Report and route

In this order, and nothing else:

1. The verdict in one line, naming the repo and its star count.
2. The runner-up and the one reason it lost.
3. The ranked table, top five rows.
4. The next command — `/scope`, `/seed-project`, or the literal install line.

If a `.tasks/<slug>/` folder exists for this work, also drop the verdict and table
into `build-or-buy.md` there so the ExecPlan can cite it.

## Completion criteria

- [ ] Capability stated as a capability; core-vs-plumbing recorded *before* searching
- [ ] `search-github.sh` run with 3+ phrasings of 2-3 keywords — never a bare `gh search repos`
- [ ] Package registries checked
- [ ] Top five read for fit, license, last push, bus factor
- [ ] One of the four verdicts, with the runner-up named
- [ ] Next command handed back
