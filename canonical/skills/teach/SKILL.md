---
name: teach
description: Teach the user a new skill or concept over multiple sessions in a stateful learning workspace — mission-grounded lessons, a growing reference set, learning records that track the zone of proximal development, and durable storage strength via spaced retrieval and interleaving. Wired to the Obsidian brain for source material and study-material export. Use when the user says "teach me X", "I want to learn X", "build me a course/curriculum on X", or wants longitudinal learning rather than a one-shot explanation.
disable-model-invocation: true
argument-hint: "<topic to learn> [| resume]"
---

The user has asked you to teach them something. This is a stateful request — they intend to learn the topic over multiple sessions.

This skill is the **curriculum** layer. It is the longitudinal teacher, distinct from the one-shot explainers it can call:

- `/wym` explains one concept in the moment; `/walkthrough` marches through a document topic-by-topic. Both are ephemeral. `teach` uses them as the per-concept rendering engine inside a lesson when a quick illustration helps.
- `/ingest` files a source into the Obsidian brain (storage). `teach` _pulls from_ the brain as a resource and _pushes durable reference docs back_ into it (see [Wired to the brain](#wired-to-the-brain)).
- `/notebooklm-export` turns brain pages into study materials. `teach` can use it as an output channel for a lesson or reference doc.

## Workspace location

Each topic gets its own **teaching workspace** — a directory under a dedicated `learning/` root, never the current working directory.

1. Read `~/.claude/knowledge-config.json` for `learningRoot` (the dedicated root) and `vaultPath` / `wikiDir` (the brain).
2. If `learningRoot` is missing, default to `~/Learning` and write the key back into the config so it sticks.
3. The workspace is `<learningRoot>/<dash-case-topic>/`. Create it lazily on first lesson. If a workspace for this topic already exists, resume it — read its `MISSION.md`, `learning-records/`, and `NOTES.md` first.

## Teaching workspace

The state of the user's learning lives in the workspace directory:

- `MISSION.md`: why the user is learning the topic — grounds all teaching. Use the format in [MISSION-FORMAT.md](./MISSION-FORMAT.md).
- `RESOURCES.md`: trusted sources for knowledge, plus communities for wisdom. Use the format in [RESOURCES-FORMAT.md](./RESOURCES-FORMAT.md).
- `./reference/*.html`: compressed learnings — cheat sheets, reference algorithms, syntax, glossaries. Beautiful documents that print well, designed for quick reference.
- `GLOSSARY.md`: the canonical language for this workspace. Use the format in [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md) — it follows the same `_Avoid_` convention as the global Lexicon, so the user reads it in a familiar shape.
- `./learning-records/*.md`: what the user has learned — the equivalent of ADRs. Drives the zone of proximal development. Titled `0001-<dash-case-name>.md`, incrementing. Use the format in [LEARNING-RECORD-FORMAT.md](./LEARNING-RECORD-FORMAT.md).
- `./lessons/*.html`: lessons. A **lesson** is one self-contained HTML output teaching one tightly-scoped thing tied to the mission. The primary unit of teaching.
- `./assets/*`: reusable **components** shared across lessons. See [Assets](#assets).
- `NOTES.md`: a scratchpad for user preferences and working notes.

## Wired to the brain

The dedicated `learning/` root holds _course state_; the Obsidian brain holds _curated reference knowledge_. Keep them connected, not siloed:

- **Pull first.** Before searching the web for `RESOURCES.md`, check the brain — read the vault's `<wikiDir>/index.md` and any pages relevant to the topic. The user may already have ingested gold on this subject.
- **Push back.** When a `reference/` doc or `GLOSSARY.md` matures into durable, trusted knowledge, offer to `/ingest` it into the brain so it joins the wider knowledge base. Course scaffolding (lessons, learning-records) stays in the workspace; distilled knowledge graduates to the brain.
- **Export.** When the user wants study materials (quiz, audio overview, study guide) from a body of lessons or reference, route through `/notebooklm-export`.

## Philosophy

To learn at a deep level, the user needs three things:

- **Knowledge**, captured from high-quality, high-trust resources
- **Skills**, acquired through highly-relevant interactive lessons devised by you, based on the knowledge
- **Wisdom**, which comes from interacting with other learners and practitioners

Before `RESOURCES.md` is well-populated, your focus is to find high-quality resources that help the user acquire knowledge. Never trust your parametric knowledge.

Some topics need more skills than knowledge. Theoretical physics leans knowledge-based; yoga leans skills-based.

### Fluency vs storage strength

Split between two types of learning:

- **Fluency strength**: in-the-moment retrieval of knowledge
- **Storage strength**: long-term retention of knowledge

Fluency can give an illusory sense of mastery, but storage strength is the real goal. Design lessons that build long-term retention by desirable difficulty:

- Retrieval practice (recall from memory)
- Spacing (distributing practice over time)
- Interleaving (mixing different but related topics — skills practice only)

## Lessons

A lesson is the main thing you produce — the unit in which knowledge and skills reach the user. Each lesson is one self-contained HTML file, saved to `./lessons/` and titled `0001-<dash-case-name>.html`, incrementing.

A lesson should be **beautiful** — clean, readable typography and layout — since the user returns to these to review. Think Tufte.

The lesson should be short and completable quickly. Working memory is small; stay within it. Each lesson gives one tangible win to build on, directly tied to the mission, in the user's zone of proximal development.

If possible, open the lesson for the user with `open <file>` (macOS opens it in the default browser — never use headless Chrome to render or verify, it crashes on this machine).

Each lesson links via HTML anchors to other lessons and reference documents. Each recommends one primary source — the highest-quality resource you found. Each contains a reminder to ask the agent followup questions: you are the teacher, and can clarify anything.

## Assets

Lessons are built from reusable **components**, stored in `./assets/`: stylesheets, quiz widgets, simulators, diagram helpers — anything a second lesson could reuse.

Reuse is the default. Before authoring a lesson, read `./assets/` and build from the components already there. When a lesson needs something new and reusable, write it as a component in `./assets/` and link to it — never inline code a future lesson would duplicate.

A shared stylesheet is the first component every workspace earns: every lesson links it, so lessons look like one consistent course rather than a pile of one-offs. As the workspace grows, so should the component library.

## The mission

Every lesson ties into the mission — the reason the user is learning the topic.

If the mission is unclear or `MISSION.md` is empty, your first job is to question the user on why they want to learn this. Failing to understand the mission means knowledge acquisition isn't grounded in real-world goals — lessons feel abstract, and you have no way to judge what comes next.

Missions change as the user develops. That's normal — update `MISSION.md` and add a learning record to capture the change. Confirm with the user before changing the mission.

## Zone of proximal development

Each lesson, the user should feel challenged 'just enough'.

The user may specify exactly what they want to learn. If they don't, figure out their zone of proximal development by:

- Reading their `learning-records`
- Figuring out the right thing to teach based on their mission
- Teaching the most relevant thing that fits in that zone

## Knowledge

Lessons are designed around a skill the user is going to learn. The knowledge in a lesson is only what's required to acquire that skill. Teach the knowledge first, then have the user practice via an interactive feedback loop.

Gather knowledge from trusted resources — track them in `RESOURCES.md`, drawing on the brain first. Litter lessons with citations to back up any claim made; this increases trustworthiness.

For acquiring knowledge, difficulty is the enemy. It eats working memory you need for understanding.

## Skills

If knowledge is acquisition, skills are durability and flexibility — making the knowledge stick.

For skill acquisition, difficulty is the tool. Effortful retrieval builds storage strength. Teach skills through interactive lessons:

- Interactive lessons with quizzes and light in-browser tasks
- Lessons guiding the user through real-world steps (e.g. yoga poses)

Each is based on a **feedback loop** giving feedback as tightly as possible — immediately, ideally automatically.

For quizzes, each answer should be the same number of words (and characters, if possible). Don't leak the answer through formatting.

## Acquiring wisdom

Wisdom comes from real-world interaction — testing skills outside the learning environment.

When the user asks something that needs wisdom, attempt to answer — but ultimately delegate to a **community**: a place (online or offline) where the user tests skills in the real world (a forum, subreddit, real-world class, local interest group). Find high-reputation communities. If the user prefers not to join one, respect it and note the preference in `RESOURCES.md`.

## Reference documents

While creating lessons, also create reference documents. Lessons reference these — useful raw units of knowledge across lessons.

Lessons are rarely revisited; reference documents will be. They are the compressed essence of the lesson, in a format designed for quick reference. Topics that lend themselves to reference: syntax and snippets for programming, algorithms and flowcharts for processes, poses and sequences for yoga, exercises and routines for fitness, glossaries for any topic with its own nomenclature.

Glossaries in particular are essential. Once created, adhere to `GLOSSARY.md` in every lesson.

## `NOTES.md`

The user sometimes expresses preferences for how they want to be taught. Record them here so you can refer back when designing lessons.
