// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import { createPgliteBookingDb } from "@/server/services/booking/booking-db";
import { BookingService } from "@/server/services/booking/booking-service";
import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

const createProviderAndService = async () => {
  const provider = await db.query<{ id: number }>(
    `insert into users (display_name, timezone, default_capacity)
     values ('Service Test Provider', 'UTC', 1)
     returning id`,
  );

  const service = await db.query<{ id: number }>(
    `insert into services (provider_user_id, name, duration_minutes)
     values (${provider.rows[0]!.id}, 'Service Test', 30)
     returning id`,
  );

  return {
    providerUserId: provider.rows[0]!.id,
    serviceId: service.rows[0]!.id,
  };
};

it("creates a booking through the service", async () => {
  const { providerUserId, serviceId } = await createProviderAndService();
  const bookingService = new BookingService(createPgliteBookingDb(db));

  const slotStart = new Date("2026-03-20T10:00:00.000Z");
  const slotEnd = new Date("2026-03-20T10:30:00.000Z");

  await db.query(
    `insert into availability_windows (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       ${serviceId},
       tstzrange('2026-03-20 10:00:00+00', '2026-03-20 11:00:00+00', '[)'),
       'manual'
     )`,
  );

  const bookingId = await bookingService.createBooking({
    providerUserId,
    serviceId,
    customerName: "Service Customer",
    slotStart,
    slotEnd,
    status: "pending",
  });

  expect(bookingId).toBeGreaterThan(0);
});

it("materializes windows through the service", async () => {
  const { providerUserId } = await createProviderAndService();
  const bookingService = new BookingService(createPgliteBookingDb(db));

  await db.query(
    `insert into weekly_availability_rules (
       provider_user_id,
       service_id,
       weekday,
       start_local,
       end_local
     ) values (
       ${providerUserId},
       null,
       1,
       '09:00:00',
       '09:30:00'
     )`,
  );

  await bookingService.materializeAvailabilityWindows({
    startDate: new Date("2026-03-16T00:00:00.000Z"),
    endDate: new Date("2026-03-18T00:00:00.000Z"),
  });

  const generated = await db.query<{ count: number }>(
    `select count(*)::int as count
     from availability_windows
     where provider_user_id = ${providerUserId}
       and source = 'generated'`,
  );

  expect(generated.rows[0]!.count).toBeGreaterThan(0);
});
