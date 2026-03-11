// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import { createProviderAndService } from "@/server/db/booking/test-helpers";
import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

it("rejects non-half-hour booking slots", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db);

  await expect(
    db.query(
      `insert into bookings (
         provider_user_id,
         service_id,
         status,
         slot,
         customer_name
       ) values (
         ${providerUserId},
         ${serviceId},
         'pending',
         tstzrange('2026-01-01 10:15:00+00', '2026-01-01 10:45:00+00', '[)'),
         'Alex Customer'
        )`,
    ),
  ).rejects.toThrow(/bookings_slot_valid/);
});

it("rejects non-canonical booking slot bounds", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db);

  await expect(
    db.query(
      `insert into bookings (
         provider_user_id,
         service_id,
         status,
         slot,
         customer_name
       ) values (
         ${providerUserId},
         ${serviceId},
         'pending',
         tstzrange('2026-01-01 10:00:00+00', '2026-01-01 10:30:00+00', '(]'),
         'Bounds Customer'
       )`,
    ),
  ).rejects.toThrow(/bookings_slot_valid/);
});

it("rejects non-canonical availability window slot bounds", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db);

  await expect(
    db.query(
      `insert into availability_windows (
         provider_user_id,
         service_id,
         slot,
         source
       ) values (
         ${providerUserId},
         ${serviceId},
         tstzrange('2026-01-01 10:00:00+00', '2026-01-01 10:30:00+00', '(]'),
         'manual'
       )`,
    ),
  ).rejects.toThrow(/availability_windows_slot_valid/);
});

it("rejects non-canonical availability block slot bounds", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db);

  await expect(
    db.query(
      `insert into availability_blocks (
         provider_user_id,
         service_id,
         slot,
         source
       ) values (
         ${providerUserId},
         ${serviceId},
         tstzrange('2026-01-01 10:00:00+00', '2026-01-01 10:30:00+00', '(]'),
         'manual'
       )`,
    ),
  ).rejects.toThrow(/availability_blocks_slot_valid/);
});

it("stores generated duration from booking slot", async () => {
  const { providerUserId, serviceId } = await createProviderAndService(db);

  const inserted = await db.query<{ id: number }>(
    `insert into bookings (
       provider_user_id,
       service_id,
       status,
       slot,
       customer_name
     ) values (
       ${providerUserId},
       ${serviceId},
       'pending',
       tstzrange('2026-01-01 10:00:00+00', '2026-01-01 10:30:00+00', '[)'),
       'Taylor Customer'
     )
     returning id`,
  );

  const booking = await db.query<{ duration: string }>(
    `select duration::text as duration
     from bookings
     where id = ${inserted.rows[0]!.id}`,
  );

  expect(booking.rows[0]!.duration).toBe("00:30:00");
});
