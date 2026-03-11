// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

it("returns weekly calendar rows by overlap query", async () => {
  const provider = await db.query<{ id: number }>(
    `insert into users (display_name, timezone, default_capacity)
     values ('Calendar Provider', 'UTC', 1)
     returning id`,
  );

  const providerUserId = provider.rows[0]!.id;

  const service = await db.query<{ id: number }>(
    `insert into services (provider_user_id, name, duration_minutes)
     values (${providerUserId}, 'Calendar Service', 30)
     returning id`,
  );

  const serviceId = service.rows[0]!.id;

  await db.query(
    `insert into bookings (provider_user_id, service_id, status, slot, customer_name)
     values
       (${providerUserId}, ${serviceId}, 'confirmed', tstzrange('2026-03-16 09:00+00', '2026-03-16 09:30+00', '[)'), 'Week Start'),
       (${providerUserId}, ${serviceId}, 'confirmed', tstzrange('2026-03-22 23:30+00', '2026-03-23 00:00+00', '[)'), 'Week End Boundary'),
       (${providerUserId}, ${serviceId}, 'confirmed', tstzrange('2026-03-23 00:00+00', '2026-03-23 00:30+00', '[)'), 'Outside Week')`,
  );

  const otherProvider = await db.query<{ id: number }>(
    `insert into users (display_name, timezone, default_capacity)
     values ('Other Provider', 'UTC', 1)
     returning id`,
  );

  const otherService = await db.query<{ id: number }>(
    `insert into services (provider_user_id, name, duration_minutes)
     values (${otherProvider.rows[0]!.id}, 'Other Service', 30)
     returning id`,
  );

  await db.query(
    `insert into bookings (provider_user_id, service_id, status, slot, customer_name)
     values (
       ${otherProvider.rows[0]!.id},
       ${otherService.rows[0]!.id},
       'confirmed',
       tstzrange('2026-03-18 10:00+00', '2026-03-18 10:30+00', '[)'),
       'Other Provider Booking'
     )`,
  );

  const result = await db.query<{ id: number; customer_name: string }>(
    `select id, customer_name
     from bookings
     where provider_user_id = ${providerUserId}
       and slot && tstzrange('2026-03-16 00:00+00', '2026-03-23 00:00+00', '[)')`,
  );

  expect(result.rows).toHaveLength(2);
  expect(result.rows.map((row) => row.customer_name).sort()).toEqual([
    "Week End Boundary",
    "Week Start",
  ]);
});
