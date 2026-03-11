// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

it("loads required postgres extensions", async () => {
  const result = await db.query<{ extname: string }>(
    `select extname from pg_extension where extname in ('btree_gist','cube','earthdistance') order by extname`,
  );

  expect(result.rows.map((r) => r.extname)).toEqual([
    "btree_gist",
    "cube",
    "earthdistance",
  ]);
});
