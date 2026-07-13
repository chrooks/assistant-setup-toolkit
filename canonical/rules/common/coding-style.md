# Coding Style

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones — return an updated copy instead of changing the original in place.
Rationale: prevents hidden side effects, makes debugging easier, enables safe concurrency.

## File Organization

- Split by cohesion, not dogma: ~200-400 lines typical, 800 max per file.
- Organize by feature/domain, not by type.
- Don't shard files for its own sake — the fewest files that stay cohesive wins.

## Errors & Validation

- Handle errors explicitly; never silently swallow them.
- Validate at trust boundaries: user input, API responses, file content. Fail fast with clear messages.

## Naming Conventions

- Variables and functions: `camelCase`; booleans get `is`/`has`/`should`/`can` prefixes.
- Interfaces, types, and components: `PascalCase`; constants: `UPPER_SNAKE_CASE`; custom hooks: `use` prefix.
- Name magic numbers: meaningful thresholds, delays, and limits become named constants.
