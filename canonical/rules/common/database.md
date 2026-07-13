---
paths:
  - "**/*.sql"
  - "**/migrations/**"
  - "**/supabase/**"
  - "**/prisma/**"
  - "**/drizzle/**"
---
> This file extends [common/coding-style.md](./coding-style.md) with PostgreSQL/Supabase database rules.
> Distilled from the ECC `postgres-patterns` skill (credit: Supabase team, MIT). Applies whenever
> writing SQL, migrations, schemas, or RLS against a PostgreSQL/Supabase database.

# PostgreSQL / Supabase Rules

## Default Types (pick the right one, every time)

| Use case | Correct type | Avoid |
|----------|-------------|-------|
| IDs | `bigint` (identity) | `int`, random `uuid` as PK |
| Strings | `text` | `varchar(255)` |
| Timestamps | `timestamptz` | `timestamp` |
| Money | `numeric(10,2)` | `float` / `double` |
| Flags | `boolean` | `int`, `varchar` |

## Indexing

- Match the index to the query shape:
  - `WHERE col = v` or `col > v` → B-tree (default)
  - `WHERE a = x AND b > y` → composite, **equality columns first, range last**
  - `jsonb @> '{}'` or full-text `@@` → GIN
  - Time-series ranges → BRIN
- Reach for a **partial index** when most rows are irrelevant (`WHERE deleted_at IS NULL`).
- Reach for a **covering index** (`INCLUDE (...)`) to skip the table lookup on hot read paths.
- **Always index foreign keys** — unindexed FKs are a silent performance trap.

## Row Level Security (Supabase)

- Wrap `auth.uid()` in a subquery so Postgres caches it per-statement instead of per-row:

```sql
CREATE POLICY policy ON orders
  USING ((SELECT auth.uid()) = user_id);  -- SELECT wrapper matters
```

## Query Patterns

- **Pagination:** use cursor/keyset pagination, not `OFFSET`:

```sql
SELECT * FROM products WHERE id > $last_id ORDER BY id LIMIT 20;  -- O(1), not O(n)
```

- **Upsert:** `INSERT ... ON CONFLICT (...) DO UPDATE SET col = EXCLUDED.col`.
- **Queue / job claim:** `FOR UPDATE SKIP LOCKED` so concurrent workers don't block each other.

## Safety Defaults

- Set `statement_timeout` and `idle_in_transaction_session_timeout` so runaway queries die.
- Enable `pg_stat_statements` for slow-query visibility (`mean_exec_time > 100ms` is a smell).
- `REVOKE ALL ON SCHEMA public FROM public;` — don't leave the default open grant.
- Watch dead tuples (`pg_stat_user_tables.n_dead_tup`) and vacuum bloated tables.

## Migrations

- Prefer additive, reversible changes; avoid destructive column drops in the same deploy as code that stops using them.
- For zero-downtime: add nullable column → backfill → add constraint → switch reads → drop old.
