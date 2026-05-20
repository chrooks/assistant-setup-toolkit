---
name: lexicon
description: "Manage CONTEXT.md Lexicon entries: add a term from a name and definition, name only, or definition only; look up remembered terms; list, update, and remove entries. Use when the user invokes /lexicon or mistypes /lxicon."
argument-hint: "add <term - definition | term | definition> | <lookup> | list | remove <term>"
disable-model-invocation: false
---

# /lexicon - Lexicon Manager

Manage Lexicon entries in the project's `CONTEXT.md` file. Add, update, look up,
list, and remove terms from the `## Language` section.

## Commands

| Command | Action |
|---|---|
| `/lexicon add <input>` | Add or update a Lexicon entry |
| `/lexicon <query>` | Look up a term the user thinks is already in the Lexicon |
| `/lexicon list` | List all terms with definitions |
| `/lexicon remove <term>` | Remove a term (alias: `delete`) |

If the user types `/lxicon`, treat it as `/lexicon`.

## Routing

1. First word matches `add`: add or update a Lexicon entry from the remaining text.
2. First word matches `list`: list all terms.
3. First word matches `remove` or `delete`: remove the named term.
4. Anything else: treat the input as a lookup query for an existing Lexicon term.

## CONTEXT.md Location

Find `CONTEXT.md` at the project root, resolved from the git root or current
working directory. If it does not exist, create this minimal scaffold:

```markdown
# Lexicon

## Language
```

Only modify the `## Language` section. Never touch `## Relationships`,
`## Example dialogue`, `## Flagged ambiguities`, or any other section unless the
user explicitly asks.

## Lexicon Entry Format

```markdown
**TermName**:
Definition text. Keep it lean and source-faithful.
_Avoid_: Alternate terms that should not be used
```

Entries are separated by blank lines. The term line is bold. The `_Avoid_` line
is italic and optional when there are no known terms to avoid.

## Adding

`/lexicon add` accepts a name and definition, name only, or definition only.

Examples:

```text
/lexicon add rectangle - four-sided 2D shape with 4 right angles
/lexicon add rectangle
/lexicon add four-sided 2D shape with 4 right angles
```

All three examples should produce this Lexicon entry:

```markdown
**Rectangle**:
A four-sided 2D shape with 4 right angles.
```

### Parse Rules

1. Name and definition: split on ` - `, `:`, or `=`. Normalize the name to title
   case unless the existing Lexicon uses another casing.
2. Name only: if the name is common and stable, infer a concise definition. If
   the name is ambiguous or project-specific, ask for the definition.
3. Definition only: infer the best concise term name from the definition. If no
   name is clearly strongest, suggest the 3 best names and ask which one to add.
4. Existing term: replace the full entry block in place.
5. New term: append the entry to the end of `## Language`.
6. Output `added <Term> to Lexicon` or `updated <Term> in Lexicon`.

Do not invent private definitions for software or product terms. Prefer
industry-standard meanings unless project context clearly defines otherwise.

## Lookup

Use `/lexicon <query>` when the user thinks a word is in the Lexicon but forgot
the exact term.

1. Read all `**Term**:` entries from `## Language`.
2. Search names, definitions, and `_Avoid_` lines case-insensitively.
3. Return the closest matches as a compact list: bold term plus first sentence of
   the definition.
4. If there is one clear match, state it directly and include any `_Avoid_`
   guidance.
5. If there are no matches, say it is not in the Lexicon and offer to add it if
   the input looks like a new term or definition.

## Listing

1. Read all `**Term**:` entries from `## Language`.
2. Display a compact list: bold term plus first sentence of the definition.
3. Include count: `<n> terms defined`.

## Removing

1. Confirm: `Remove <Term> from Lexicon?`
2. Check if the term appears in `## Relationships`, `## Example dialogue`, or
   `## Flagged ambiguities`.
3. If found in other sections, warn:
   `<Term> is also referenced in: <sections>. Clean up manually.`
4. Remove the full entry block.
5. Output `removed <Term> from Lexicon`.

## Unnamed Concept Naming

Sometimes the user describes a concept that should have a Lexicon name but does
not know the right name yet.

When this happens:

1. Restate the concept briefly in plain language.
2. Suggest the 3 best candidate names.
3. Prefer names that are concise, domain-specific, and consistent with existing
   `CONTEXT.md` terms.
4. If one candidate is clearly strongest, mark it as recommended and explain why
   in one short sentence.
5. Ask which name to add before modifying `CONTEXT.md`, unless the user
   explicitly asked you to choose.

## Passive Recognition

When the user writes CamelCase or PascalCase nouns in conversation, such as
`ChemistryScore` or `DraftPick`:

1. Check whether the term exists in the `## Language` section.
2. If it exists, use it correctly per the definition.
3. If it does not exist, offer once per term per session:
   `ChemistryScore is not in the Lexicon yet. Add it?`

Do not offer for common programming terms such as `useState` or `NextConfig`.
Only offer for terms that look domain-specific.
