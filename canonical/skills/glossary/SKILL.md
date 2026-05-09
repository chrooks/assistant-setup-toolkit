# /glossary — Glossary Manager

Manage domain glossary entries in the project's `CONTEXT.md` file. Add, update, list, and remove terms from the `## Language` section.

## Commands

| Command | Action |
|---|---|
| `/glossary <term>` | Add or update a glossary term |
| `/glossary list` | List all terms with definitions |
| `/glossary remove <term>` | Remove a term (alias: `delete`) |

## Routing

1. **First word matches `list`**: list all terms.
2. **First word matches `remove` or `delete`**: remove the named term.
3. **Anything else**: treat first word as the term name. Add or update.

## CONTEXT.md Location

Find at project root (via git root or cwd). If `CONTEXT.md` doesn't exist, create minimal scaffold:

```markdown
# <ProjectName>

## Language
```

Only modify the `## Language` section. Never touch `## Relationships`, `## Example dialogue`, `## Flagged ambiguities`, or any other section.

## Glossary Entry Format

```markdown
**TermName**:
Definition text. Can span multiple sentences.
_Avoid_: Alternate terms that should not be used
```

Entries separated by blank lines. Bold term name. Italic _Avoid_ line.

## Behavior

### Adding/updating (`/glossary PlayerPool`)

1. Read `CONTEXT.md`, find the `## Language` section.
2. Search for `**PlayerPool**:` in that section.
3. **If found**: ask user for updated definition (or accept inline). Replace the full entry block in place.
4. **If not found**: ask user for definition and _Avoid_ terms. Append new entry to end of `## Language` section.
5. Output: `added PlayerPool to glossary` or `updated PlayerPool in glossary`

If the user provides the definition inline (`/glossary PlayerPool the set of available players`), skip the prompt and write directly.

### Listing (`/glossary list`)

1. Read `CONTEXT.md`, parse all `**Term**:` entries from `## Language`.
2. Display as compact list: bold term + first sentence of definition.
3. Include count: `14 terms defined`

### Removing (`/glossary remove Build`)

1. Confirm: `Remove Build from glossary?`
2. Check if `Build` appears in `## Relationships`, `## Example dialogue`, or `## Flagged ambiguities`.
3. If found in other sections, warn: `Build also referenced in: Relationships, Flagged ambiguities. Clean up manually.`
4. Remove the full entry block (term line, definition lines, _Avoid_ line, trailing blank line).
5. Output: `removed Build from glossary`

## Unnamed Concept Naming

Sometimes the user describes a concept or thing that should have a glossary name, but they do not know the right name yet.

When this happens:

1. Restate the concept briefly in plain language.
2. Suggest the 3 best candidate names for the concept.
3. Prefer names that are concise, domain-specific, and consistent with existing `CONTEXT.md` vocabulary.
4. If one candidate is clearly strongest, mark it as recommended and explain why in one short sentence.
5. Ask which name to add before modifying `CONTEXT.md`, unless the user explicitly asked you to choose.

## Passive Recognition

When the user writes CamelCase or PascalCase nouns in conversation (e.g., `ChemistryScore`, `DraftPick`):

1. Check if the term exists in the `## Language` section.
2. If it exists: use it correctly per the definition. No prompt.
3. If it does NOT exist: offer once per term per session: `"ChemistryScore isn't in the glossary yet. Add it?"`

Do not offer for common programming terms (e.g., `useState`, `NextConfig`). Only for terms that look domain-specific.
