// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

it("keeps bookings.slot as tstzrange", async () => {
  const result = await db.query<{ udt_name: string }>(`
    select udt_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'slot'
  `);

  expect(result.rows[0]).toMatchObject({
    udt_name: "tstzrange",
  });
});

it("keeps bookings.duration as generated interval", async () => {
  const result = await db.query<{ is_generated: string; udt_name: string }>(`
    select is_generated, udt_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'duration'
  `);

  expect(result.rows[0]).toMatchObject({
    is_generated: "ALWAYS",
    udt_name: "interval",
  });
});

it("keeps overlap exclusion constraints", async () => {
  const result = await db.query<{ conname: string }>(`
    select conname
    from pg_constraint
    where conname in ('availability_windows_no_overlap', 'availability_blocks_no_overlap')
    order by conname
  `);

  expect(result.rows.map((row) => row.conname)).toEqual([
    "availability_blocks_no_overlap",
    "availability_windows_no_overlap",
  ]);
});
