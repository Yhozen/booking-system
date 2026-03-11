# Booking Migration Strategy

Prisma migrations are the single source of truth for booking DDL.

Booking relies on PostgreSQL features Prisma schema cannot fully express (`tstzrange`, generated `interval`, exclusion constraints, and SQL functions), so those parts are authored directly in `migration.sql` files.

Workflow:

1. Keep booking models in `prisma/schema.prisma` and use `Unsupported("tstzrange")` / `Unsupported("interval")` for unsupported field types.
2. Create a migration with `prisma migrate dev --create-only`.
3. Edit the generated `prisma/migrations/<timestamp>_*/migration.sql` to include unsupported PostgreSQL features.
4. Apply with Prisma migrate commands.

Tests in `src/server/db/booking` load booking DDL from Prisma migrations to avoid drift between migrations and test schema setup.
