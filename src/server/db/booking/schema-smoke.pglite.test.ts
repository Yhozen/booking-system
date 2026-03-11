// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import {
  createProvider,
  createService,
} from "@/server/db/booking/test-helpers";
import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

it("creates core booking schema tables in public", async () => {
  const result = await db.query<{ tablename: string }>(
    `select tablename
     from pg_tables
     where schemaname = 'public'
       and tablename in (
         'users',
         'services',
         'weekly_availability_rules',
         'availability_windows',
         'availability_blocks',
         'bookings'
       )
     order by tablename`,
  );

  expect(result.rows.map((row) => row.tablename)).toEqual([
    "availability_blocks",
    "availability_windows",
    "bookings",
    "services",
    "users",
    "weekly_availability_rules",
  ]);
});

it("rejects booking rows with service owned by another provider", async () => {
  const providerAId = await createProvider(db, { displayName: "Provider A" });
  const providerBId = await createProvider(db, { displayName: "Provider B" });
  const serviceForProviderAId = await createService(db, providerAId);

  await expect(
    db.query(
      `insert into bookings (
         provider_user_id,
         service_id,
         status,
         slot,
         customer_name
       ) values (
          ${providerBId},
          ${serviceForProviderAId},
         'pending',
         tstzrange('2026-01-01 10:00:00+00', '2026-01-01 10:30:00+00', '[)'),
         'Alex Customer'
       )`,
    ),
  ).rejects.toThrow();
});

it("rejects weekly availability rule with non-zero minutes/seconds", async () => {
  const providerId = await createProvider(db, { displayName: "Provider C" });

  await expect(
    db.query(
      `insert into weekly_availability_rules (
         provider_user_id,
         service_id,
         weekday,
         start_local,
         end_local
       ) values (
          ${providerId},
         null,
         1,
         '09:15:00',
         '10:00:30'
       )`,
    ),
  ).rejects.toThrow();
});
