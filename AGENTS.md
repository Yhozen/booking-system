# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Full-stack booking/scheduling system built with Next.js 15, tRPC v11, Prisma 6, and PostgreSQL. See `README.md` for architecture and common commands (`bun run dev`, `bun run test`, `bun run lint`, `bun run typecheck`).

### Services

| Service | Port | How to start |
|---|---|---|
| PostgreSQL | 5432 | Docker container `booking-system-postgres` (see below) |
| Next.js dev server | 3000 | `bun run dev` |

### Database setup

Docker must be running before starting PostgreSQL:

```
sudo dockerd &>/tmp/dockerd.log &
sudo docker start booking-system-postgres || sudo docker run -d --name booking-system-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=booking-system -p 5432:5432 postgres:16
```

After Postgres is up, apply migrations with `bun run db:migrate` (`prisma migrate deploy`). Do **not** use `bun run db:push` — the project relies on custom SQL migrations with PL/pgSQL functions and exclusion constraints that `db:push` skips.

After the first migration, you must also ensure the `Post` table exists (it is in the Prisma schema but not in the custom migration SQL):

```sql
CREATE TABLE IF NOT EXISTS "Post" (id SERIAL PRIMARY KEY, name TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS "Post_name_idx" ON "Post" (name);
```

### Testing

- `bun run test` — runs Vitest with PGlite (in-memory Postgres). **No running PostgreSQL needed for tests.**
- `bun run lint` — ESLint via `next lint`
- `bun run typecheck` — TypeScript strict check

### Non-obvious gotchas

- The `.env` file uses the default `DATABASE_URL=postgresql://postgres:password@localhost:5432/booking-system`. The `start-database.sh` script has interactive prompts — avoid running it in non-interactive mode; instead start the Docker container directly.
- `bun run db:generate` (`prisma migrate dev`) creates new migrations interactively; prefer `bun run db:migrate` for deploying existing migrations.
- The `postinstall` script runs `prisma generate` automatically on `bun install`.
