# Booking Migration Strategy

This project keeps booking DDL in SQL because it relies on PostgreSQL features Prisma schema cannot fully express (`tstzrange`, generated `interval`, exclusion constraints, and SQL functions).

Workflow:

1. Keep application models in `prisma/schema.prisma` for type-safe querying where possible.
2. Add/modify SQL in `src/server/db/sql/booking_v1.sql`.
3. Mirror that SQL in a customized Prisma migration (`prisma/migrations/<timestamp>_booking_v1/migration.sql`).
4. Apply with Prisma migrate commands.

For future booking changes, use `prisma migrate dev --create-only`, then edit the generated SQL migration file to include unsupported database features before applying.
