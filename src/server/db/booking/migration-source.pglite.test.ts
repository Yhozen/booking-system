// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

it("loads create_booking function from prisma migration sql", async () => {
  const result = await db.query<{ count: number }>(`
    select count(*)::int as count
    from pg_proc
    where proname = 'create_booking'
  `);

  expect(result.rows[0]!.count).toBe(1);
});

it("loads materialize_availability_windows function from prisma migration sql", async () => {
  const result = await db.query<{ count: number }>(`
    select count(*)::int as count
    from pg_proc
    where proname = 'materialize_availability_windows'
  `);

  expect(result.rows[0]!.count).toBe(1);
});
