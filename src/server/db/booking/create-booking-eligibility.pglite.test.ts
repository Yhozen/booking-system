// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import { createProviderAndService } from "@/server/db/booking/test-helpers";
import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

it("rejects booking outside horizon", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db);

  await db.query(
    `insert into availability_windows (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       ${serviceId},
       tstzrange(
         date_trunc('hour', now()) + interval '61 day',
         date_trunc('hour', now()) + interval '61 day 30 minute',
         '[)'
       ),
       'manual'
     )`,
  );

  await expect(
    db.query(
      `select create_booking(
         ${providerUserId},
         ${serviceId},
         'Horizon Customer',
         tstzrange(
           date_trunc('hour', now()) + interval '61 day',
           date_trunc('hour', now()) + interval '61 day 30 minute',
           '[)'
         )
       )`,
    ),
  ).rejects.toThrow(/horizon/i);
});

it("rejects booking exactly at horizon boundary", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db);

  await expect(
    db.query(
      `select create_booking(
         ${providerUserId},
         ${serviceId},
         'Boundary Customer',
         tstzrange(
           now() + interval '60 day',
           now() + interval '60 day 30 minute',
           '[)'
         )
       )`,
    ),
  ).rejects.toThrow(/horizon/i);
});

it("rejects booking for inactive service", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db);

  await db.query(
    `update services set is_active = false where id = ${serviceId}`,
  );

  await db.query(
    `insert into availability_windows (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       ${serviceId},
       tstzrange(
         date_trunc('hour', now()) + interval '2 day',
         date_trunc('hour', now()) + interval '2 day 30 minute',
         '[)'
       ),
       'manual'
     )`,
  );

  await expect(
    db.query(
      `select create_booking(
         ${providerUserId},
         ${serviceId},
         'Inactive Customer',
         tstzrange(
           date_trunc('hour', now()) + interval '2 day',
           date_trunc('hour', now()) + interval '2 day 30 minute',
           '[)'
         )
       )`,
    ),
  ).rejects.toThrow(/service.*inactive|inactive.*service/i);
});

it("rejects booking when service does not belong to provider", async () => {
  const providerA = await createProviderAndService(db);
  const providerB = await createProviderAndService(db);

  await expect(
    db.query(
      `select create_booking(
         ${providerA.providerUserId},
         ${providerB.serviceId},
         'Mismatched Customer',
         tstzrange(
           date_trunc('hour', now()) + interval '2 day',
           date_trunc('hour', now()) + interval '2 day 30 minute',
           '[)'
         )
       )`,
    ),
  ).rejects.toThrow(/service.*provider|provider.*service/i);
});

it("rejects booking without covering availability window", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db);

  const otherService = await db.query<{ id: number }>(
    `insert into services (provider_user_id, name, duration_minutes)
     values (${providerUserId}, 'Different Service', 30)
     returning id`,
  );

  await db.query(
    `insert into availability_windows (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       ${otherService.rows[0]!.id},
       tstzrange(
         date_trunc('hour', now()) + interval '2 day',
         date_trunc('hour', now()) + interval '2 day 1 hour',
         '[)'
       ),
       'manual'
     )`,
  );

  await expect(
    db.query(
      `select create_booking(
         ${providerUserId},
         ${serviceId},
         'Window Customer',
         tstzrange(
           date_trunc('hour', now()) + interval '2 day',
           date_trunc('hour', now()) + interval '2 day 30 minute',
           '[)'
         )
       )`,
    ),
  ).rejects.toThrow(/availability window|cover/i);
});

it("rejects booking overlapping a relevant availability block", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db);

  await db.query(
    `insert into availability_windows (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       ${serviceId},
       tstzrange(
         date_trunc('hour', now()) + interval '3 day',
         date_trunc('hour', now()) + interval '3 day 1 hour',
         '[)'
       ),
       'manual'
     )`,
  );

  await db.query(
    `insert into availability_blocks (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       null,
       tstzrange(
         date_trunc('hour', now()) + interval '3 day',
         date_trunc('hour', now()) + interval '3 day 30 minute',
         '[)'
       ),
       'manual'
     )`,
  );

  await expect(
    db.query(
      `select create_booking(
         ${providerUserId},
         ${serviceId},
         'Blocked Customer',
         tstzrange(
           date_trunc('hour', now()) + interval '3 day',
           date_trunc('hour', now()) + interval '3 day 30 minute',
           '[)'
         )
       )`,
    ),
  ).rejects.toThrow(/availability block|blocked|overlap/i);
});

it("accepts valid booking and returns id", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db);

  await db.query(
    `insert into availability_windows (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       null,
       tstzrange(
         date_trunc('hour', now()) + interval '4 day',
         date_trunc('hour', now()) + interval '4 day 1 hour',
         '[)'
       ),
       'manual'
     )`,
  );

  const result = await db.query<{ booking_id: number }>(
    `select create_booking(
       ${providerUserId},
       ${serviceId},
       'Valid Customer',
       tstzrange(
         date_trunc('hour', now()) + interval '4 day',
         date_trunc('hour', now()) + interval '4 day 30 minute',
         '[)'
       )
     ) as booking_id`,
  );

  expect(result.rows[0]!.booking_id).toBeGreaterThan(0);

  const booking = await db.query<{ id: number; customer_name: string }>(
    `select id, customer_name
     from bookings
     where id = ${result.rows[0]!.booking_id}`,
  );

  expect(booking.rows).toHaveLength(1);
  expect(booking.rows[0]!.customer_name).toBe("Valid Customer");
});
