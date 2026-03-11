// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import {
  createProviderAndService,
  createService,
} from "@/server/db/booking/test-helpers";
import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

const insertAvailabilityWindow = async (
  providerUserId: number,
  serviceId: number,
) => {
  await db.query(
    `insert into availability_windows (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       ${serviceId},
       tstzrange(
         date_trunc('hour', now()) + interval '2 day',
         date_trunc('hour', now()) + interval '2 day 2 hour',
         '[)'
       ),
       'manual'
     )`,
  );
};

it("enforces provider default_capacity for confirmed overlaps", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db, {
    defaultCapacity: 1,
  });

  await insertAvailabilityWindow(providerUserId, serviceId);

  await db.query(
    `select create_booking(
       ${providerUserId},
       ${serviceId},
       'Confirmed One',
       tstzrange(
         date_trunc('hour', now()) + interval '2 day',
         date_trunc('hour', now()) + interval '2 day 30 minute',
         '[)'
       ),
       'confirmed'
     )`,
  );

  await expect(
    db.query(
      `select create_booking(
         ${providerUserId},
         ${serviceId},
         'Confirmed Two',
         tstzrange(
           date_trunc('hour', now()) + interval '2 day',
           date_trunc('hour', now()) + interval '2 day 30 minute',
           '[)'
         ),
         'confirmed'
       )`,
    ),
  ).rejects.toThrow(/capacity/i);
});

it("pending does not consume capacity", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db, {
    defaultCapacity: 1,
  });

  await insertAvailabilityWindow(providerUserId, serviceId);

  await db.query(
    `select create_booking(
       ${providerUserId},
       ${serviceId},
       'Pending One',
       tstzrange(
         date_trunc('hour', now()) + interval '2 day',
         date_trunc('hour', now()) + interval '2 day 30 minute',
         '[)'
       ),
       'pending'
     )`,
  );

  const result = await db.query<{ booking_id: number }>(
    `select create_booking(
       ${providerUserId},
       ${serviceId},
       'Confirmed After Pending',
       tstzrange(
         date_trunc('hour', now()) + interval '2 day',
         date_trunc('hour', now()) + interval '2 day 30 minute',
         '[)'
       ),
       'confirmed'
     ) as booking_id`,
  );

  expect(result.rows[0]!.booking_id).toBeGreaterThan(0);
});

it("enforces service capacity_override independently", async () => {
  const { providerUserId, serviceId: serviceWithOverrideId } =
    await createProviderAndService(db, {
      defaultCapacity: 5,
      capacityOverride: 1,
    });

  const otherServiceId = await createService(db, providerUserId, {
    name: "Other Service",
  });

  await insertAvailabilityWindow(providerUserId, serviceWithOverrideId);
  await insertAvailabilityWindow(providerUserId, otherServiceId);

  await db.query(
    `select create_booking(
       ${providerUserId},
       ${otherServiceId},
       'Other Service Confirmed',
       tstzrange(
         date_trunc('hour', now()) + interval '2 day',
         date_trunc('hour', now()) + interval '2 day 30 minute',
         '[)'
       ),
       'confirmed'
     )`,
  );

  await db.query(
    `select create_booking(
       ${providerUserId},
       ${serviceWithOverrideId},
       'Override One',
       tstzrange(
         date_trunc('hour', now()) + interval '2 day',
         date_trunc('hour', now()) + interval '2 day 30 minute',
         '[)'
       ),
       'confirmed'
     )`,
  );

  await expect(
    db.query(
      `select create_booking(
         ${providerUserId},
         ${serviceWithOverrideId},
         'Override Two',
         tstzrange(
           date_trunc('hour', now()) + interval '2 day',
           date_trunc('hour', now()) + interval '2 day 30 minute',
           '[)'
         ),
         'confirmed'
       )`,
    ),
  ).rejects.toThrow(/capacity/i);
});
