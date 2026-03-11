// @vitest-environment node

import { expect, it } from "vitest";

import {
  findLatestBookingMigrationSqlPath,
  readLatestBookingMigrationSql,
} from "@/test/prisma-booking-migration";

it("finds booking migration sql in prisma migrations", async () => {
  const migrationPath = await findLatestBookingMigrationSqlPath();
  expect(migrationPath).toMatch(/prisma\/migrations\/.+\/migration\.sql$/);
});

it("reads booking migration sql containing booking artifacts", async () => {
  const sql = await readLatestBookingMigrationSql();

  expect(sql).toContain("create table if not exists bookings");
  expect(sql).toContain("create or replace function create_booking");
  expect(sql).toContain(
    "create or replace function materialize_availability_windows",
  );
});
