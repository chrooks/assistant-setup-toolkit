# Branch: external source

The request is somebody else's published work worth pulling in. It becomes an entry in `manifests/install.yaml`.

This surface has the worst failure history in the toolkit. A YAML quoting mistake silently degraded an install twice — the written-file count dropped from 692 to 312 and nothing reported an error. **Always verify by re-parsing.** The last section of this file is the part that matters most.

## The entry shape

Append to the `externalSources:` list. The schema is strict — unknown fields are rejected, so a typo fails loudly rather than being ignored.

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | stable slug, referenced by presets and flags |
| `name` | yes | human label shown in the wizard summary |
| `kind` | yes | `skill`, `skill-pack`, `plugin`, `skill-or-plugin`, or `mcp-server` |
| `url` | yes | must be a valid URL |
| `default` | yes | whether a default install includes it |
| `targets` | yes | `claude-code`, `codex-cli`, or both — at least one |
| `notes` | no | list of strings; why it exists, what breaks without it |
| `exclude` | no | skill names to drop from a `skill-pack` |
| `installCommands` | no | native install commands per target, surfaced as Next Steps |
| `requiresConfirmation` | no | gate the fetch behind a prompt |
| `requiredSecrets` | no | secret names the source needs |
| `installWhen` | no | conditional-install predicate |

A minimal entry:

    - id: find-skills
      name: Vercel Labs — find-skills
      kind: skill
      url: https://github.com/vercel-labs/skills/tree/main/skills/find-skills
      default: true
      targets:
        - claude-code
        - codex-cli

`exclude` exists because a `skill-pack` is otherwise all-or-nothing per group, which forces a choice between standing updates and inheriting every skill the group happens to contain. It is ignored for non-pack kinds.

## Fetch or vendor

**Fetch anything upstream still maintains.** A vendored copy of a live skill rots quietly — that is exactly how upstream's Negation failure mode and YAGNI-scoping improvements went missing for a month, and both were caught by accident.

**Vendor only what upstream no longer maintains.** A dead upstream cannot send you improvements, so the copy costs nothing and buys local control.

Overlaps are safe. `payload.ts` layers external files first and local files last, so a local `skills/<name>/SKILL.md` always wins a name collision. The wizard prints one "local wins" line per conflict. Adding a source that overlaps an existing local Skill does not clobber it.

## The YAML plain-scalar hazard

This is the failure that halved an install twice. Read it before writing any `notes:` entry.

A **plain scalar** — an unquoted YAML string — has two constraints that bite exactly where prose about code lives:

1. **It cannot contain `: ` followed by a backtick.** YAML reads the colon-space as a key separator and the line becomes a malformed mapping.
2. **It cannot span lines with an implicit key.** A wrapped sentence under a list item parses as a new key, not a continuation.

Both produce output that *looks* like valid YAML. The parser either throws, or — worse historically — the document parses into a shape that drops entries, and the install silently ships fewer files.

The fix is a `>-` block scalar for every multi-line note. Everything indented under it is literal text; colons, backticks, and line wraps are all safe:

    notes:
      - >-
        Supplies the grilling primitive that /grill-me and /grill-with-docs
        wrap. Disabling this group breaks both wrappers, so keep it on unless
        you re-vendor grilling deliberately.

**Use `>-` for every note longer than a few words**, not only for ones you think are risky. Judging which strings are safe is the process that failed twice. The block scalar costs one line and removes the question.

## Verify by re-parsing — not optional

Writing the entry is half the job. The other half is proving the file still parses into the shape you expect.

After every write, re-parse and report the source count:

    npx tsx -e "import('./src/setup/manifest.js').then(async m => { \
      const manifest = await m.loadInstallationManifest('manifests/install.yaml'); \
      console.log(manifest.externalSources.length + ' external sources'); \
    })"

**Compare the count to what you expected**, which is the count before your edit plus one. A number lower than that is the silent-degradation failure happening again — the file parsed, but not into the entries you wrote.

`loadInstallationManifest` fails loudly on both a YAML syntax error and a schema violation, naming the line and column. Reading its error is faster than reading the YAML. The hazard above reports as:

    Failed to parse YAML in manifests/install.yaml: Plain value cannot
    start with reserved character ` at line 11, column 23

A schema violation reports the field path instead — `externalSources.3.kind: Invalid enum value`.

Then run the wizard and read its `Sources` line:

    npm run setup -- --claude --default

Expect the fetched count to include your new source, and the `Writes` count to go up rather than down. A drop is the signal that something parsed into a smaller shape than intended.

## Create

1. Decide fetch versus vendor.
2. Write the entry, using `>-` for every `notes:` string.
3. Re-parse and check the count against your expectation.
4. Run the wizard, read `Sources` and `Writes`.

## Update

Read the entry first. Changing `default:` or `targets:` changes what a fresh install produces on every machine — say so in the report. Re-parse after, same as create.

## Remove

Deleting an entry stops the fetch but does not remove what it already installed. Confirm the blast radius, delete the entry, then prune:

    npm run setup -- --claude --codex --default --write prune --yes

Re-parse and confirm the count went **down by one**, not by more. Deleting a list item is where an accidental indentation change takes neighbouring entries with it.
