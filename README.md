# Booking System

This project is a full-stack booking system built with Next.js, tRPC, Prisma, and PostgreSQL.
It focuses on reliable scheduling rules, capacity-aware booking, and a clean service layer that can run against Prisma.

## High-Level Architecture

- **Web app:** Next.js App Router application.
- **API layer:** tRPC routers under `src/server/api`.
- **Domain services:** booking logic in `src/server/services/booking`.
- **Data layer:** Prisma models and custom SQL migrations for advanced PostgreSQL features.
- **Testing:** Vitest suite with PGlite for fast local database tests.

## Booking Domain Highlights

- Time-slot booking with provider/service constraints.
- Capacity-aware booking creation (confirmed bookings consume capacity).
- Availability window materialization from recurring rules and manual overrides.
- PostgreSQL-first design using range types and SQL functions where Prisma schema support is limited.

## Project Layout (Key Areas)

- `prisma/` - Prisma schema and migrations.
- `src/server/db/` - SQL files and DB-focused tests.
- `src/server/services/booking/` - booking service + DB adapter abstractions.
- `src/server/api/routers/` - tRPC routers (including booking endpoints).
- `src/test/` - shared test helpers for PGlite/Prisma setup.

## Common Commands

- `bun run dev` - start the app locally.
- `bun run test` - run test suite.
- `bun run lint` - lint codebase.
- `bun run typecheck` - run TypeScript checks.
- `bun run db:generate` - create/update Prisma migrations in development.

## Notes

Some booking features rely on PostgreSQL capabilities that are not fully expressible in Prisma schema alone.
Prisma migrations are the source of truth for those SQL features, and booking DB tests validate those migration-level invariants.
