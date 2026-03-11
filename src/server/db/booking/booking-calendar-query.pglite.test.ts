// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import {
  createProvider,
  createService,
} from "@/server/db/booking/test-helpers";
import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

it("returns weekly calendar rows by overlap query", async () => {
  const providerUserId = await createProvider(db, {
    displayName: "Calendar Provider",
  });
  const serviceId = await createService(db, providerUserId, {
    name: "Calendar Service",
  });

  await db.query(
    `insert into bookings (provider_user_id, service_id, status, slot, customer_name)
     values
       (${providerUserId}, ${serviceId}, 'confirmed', tstzrange('2026-03-16 09:00+00', '2026-03-16 09:30+00', '[)'), 'Week Start'),
       (${providerUserId}, ${serviceId}, 'confirmed', tstzrange('2026-03-22 23:30+00', '2026-03-23 00:00+00', '[)'), 'Week End Boundary'),
       (${providerUserId}, ${serviceId}, 'confirmed', tstzrange('2026-03-23 00:00+00', '2026-03-23 00:30+00', '[)'), 'Outside Week')`,
  );

  const otherProviderId = await createProvider(db, {
    displayName: "Other Provider",
  });
  const otherServiceId = await createService(db, otherProviderId, {
    name: "Other Service",
  });

  await db.query(
    `insert into bookings (provider_user_id, service_id, status, slot, customer_name)
     values (
        ${otherProviderId},
        ${otherServiceId},
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
