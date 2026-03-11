// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

const createProviderAndService = async ({
  defaultCapacity = 1,
  capacityOverride,
}: {
  defaultCapacity?: number;
  capacityOverride?: number;
} = {}) => {
  const provider = await db.query<{ id: number }>(
    `insert into users (display_name, timezone, default_capacity, booking_horizon_days)
     values ('Provider', 'UTC', ${defaultCapacity}, 60)
     returning id`,
  );

  const capacityOverrideValue =
    capacityOverride === undefined ? "null" : `${capacityOverride}`;

  const service = await db.query<{ id: number }>(
    `insert into services (provider_user_id, name, duration_minutes, capacity_override)
     values (${provider.rows[0]!.id}, 'Consultation', 30, ${capacityOverrideValue})
     returning id`,
  );

  return {
    providerUserId: provider.rows[0]!.id,
    serviceId: service.rows[0]!.id,
  };
};

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
  const { providerUserId, serviceId } = await createProviderAndService({
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
  const { providerUserId, serviceId } = await createProviderAndService({
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
    await createProviderAndService({
      defaultCapacity: 5,
      capacityOverride: 1,
    });

  const otherService = await db.query<{ id: number }>(
    `insert into services (provider_user_id, name, duration_minutes)
     values (${providerUserId}, 'Other Service', 30)
     returning id`,
  );

  await insertAvailabilityWindow(providerUserId, serviceWithOverrideId);
  await insertAvailabilityWindow(providerUserId, otherService.rows[0]!.id);

  await db.query(
    `select create_booking(
       ${providerUserId},
       ${otherService.rows[0]!.id},
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
