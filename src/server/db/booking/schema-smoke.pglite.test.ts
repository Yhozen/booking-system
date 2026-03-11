// @vitest-environment node

import { afterAll, expect, it } from "vitest";

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
  const providerA = await db.query<{ id: number }>(
    `insert into users (display_name, timezone, default_capacity)
     values ('Provider A', 'UTC', 1)
     returning id`,
  );
  const providerB = await db.query<{ id: number }>(
    `insert into users (display_name, timezone, default_capacity)
     values ('Provider B', 'UTC', 1)
     returning id`,
  );

  const serviceForProviderA = await db.query<{ id: number }>(
    `insert into services (provider_user_id, name, duration_minutes)
     values (${providerA.rows[0]!.id}, 'Consultation', 30)
     returning id`,
  );

  await expect(
    db.query(
      `insert into bookings (
         provider_user_id,
         service_id,
         status,
         slot,
         customer_name
       ) values (
         ${providerB.rows[0]!.id},
         ${serviceForProviderA.rows[0]!.id},
         'pending',
         tstzrange('2026-01-01 10:00:00+00', '2026-01-01 10:30:00+00', '[)'),
         'Alex Customer'
       )`,
    ),
  ).rejects.toThrow();
});

it("rejects weekly availability rule with non-zero minutes/seconds", async () => {
  const provider = await db.query<{ id: number }>(
    `insert into users (display_name, timezone, default_capacity)
     values ('Provider C', 'UTC', 1)
     returning id`,
  );

  await expect(
    db.query(
      `insert into weekly_availability_rules (
         provider_user_id,
         service_id,
         weekday,
         start_local,
         end_local
       ) values (
         ${provider.rows[0]!.id},
         null,
         1,
         '09:15:00',
         '10:00:30'
       )`,
    ),
  ).rejects.toThrow();
});
