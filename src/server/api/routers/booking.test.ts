// @vitest-environment node

import "dotenv/config";

import { afterAll, expect, it } from "vitest";

import { createCaller } from "@/server/api/root";
import { createBookingPrismaForTest } from "@/test/pglite-booking";

const { db, prisma, cleanup } = await createBookingPrismaForTest();

afterAll(cleanup);

const createProviderAndService = async () => {
  const provider = await db.query<{ id: number }>(
    `insert into users (display_name, timezone, default_capacity)
     values ('Router Provider', 'UTC', 1)
     returning id`,
  );

  const service = await db.query<{ id: number }>(
    `insert into services (provider_user_id, name, duration_minutes)
     values (${provider.rows[0]!.id}, 'Router Service', 30)
     returning id`,
  );

  return {
    providerUserId: provider.rows[0]!.id,
    serviceId: service.rows[0]!.id,
  };
};

it("creates booking via booking router", async () => {
  const { providerUserId, serviceId } = await createProviderAndService();

  await db.query(
    `insert into availability_windows (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       ${serviceId},
       tstzrange('2026-03-21 10:00:00+00', '2026-03-21 11:00:00+00', '[)'),
       'manual'
     )`,
  );

  const caller = createCaller({
    db: prisma,
    headers: new Headers(),
  });

  const result = await caller.booking.create({
    providerUserId,
    serviceId,
    customerName: "Router Customer",
    slotStart: "2026-03-21T10:00:00.000Z",
    slotEnd: "2026-03-21T10:30:00.000Z",
    status: "pending",
  });

  expect(result.bookingId).toBeGreaterThan(0);
});

it("materializes windows via booking router", async () => {
  const { providerUserId } = await createProviderAndService();

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

  const caller = createCaller({
    db: prisma,
    headers: new Headers(),
  });

  const result = await caller.booking.materializeAvailabilityWindows({
    startDate: "2026-03-16T00:00:00.000Z",
    endDate: "2026-03-18T00:00:00.000Z",
  });

  expect(result.ok).toBe(true);
});

it("returns week bookings via booking router overlap query", async () => {
  const { providerUserId, serviceId } = await createProviderAndService();

  await db.query(
    `insert into bookings (provider_user_id, service_id, status, slot, customer_name)
     values
       (${providerUserId}, ${serviceId}, 'confirmed', tstzrange('2026-03-16 09:00+00', '2026-03-16 09:30+00', '[)'), 'Week Start'),
       (${providerUserId}, ${serviceId}, 'pending', tstzrange('2026-03-22 23:30+00', '2026-03-23 00:00+00', '[)'), 'Week End Boundary'),
       (${providerUserId}, ${serviceId}, 'confirmed', tstzrange('2026-03-23 00:00+00', '2026-03-23 00:30+00', '[)'), 'Outside Week')`,
  );

  const caller = createCaller({
    db: prisma,
    headers: new Headers(),
  });

  const result = await caller.booking.getWeek({
    startDate: "2026-03-16T00:00:00.000Z",
    endDate: "2026-03-23T00:00:00.000Z",
  });

  const names = result.map((row) => row.customerName);

  expect(names).toEqual(
    expect.arrayContaining(["Week Start", "Week End Boundary"]),
  );
  expect(names).not.toContain("Outside Week");
});

it("returns provider/service options for booking form", async () => {
  const { providerUserId, serviceId } = await createProviderAndService();

  const caller = createCaller({
    db: prisma,
    headers: new Headers(),
  });

  const result = await caller.booking.getFormOptions();
  const provider = result.find((row) => row.providerUserId === providerUserId);

  expect(provider).toBeDefined();
  expect(provider?.services.some((service) => service.serviceId === serviceId)).toBe(
    true,
  );
});

it("creates booking from UI flow and auto-adds availability", async () => {
  const { providerUserId, serviceId } = await createProviderAndService();

  const caller = createCaller({
    db: prisma,
    headers: new Headers(),
  });

  const created = await caller.booking.createFromUi({
    providerUserId,
    serviceId,
    customerName: "UI Flow Customer",
    slotStart: "2026-03-20T10:30:00.000Z",
    status: "confirmed",
    ensureAvailabilityWindow: true,
  });

  expect(created.bookingId).toBeGreaterThan(0);
  expect(created.slotEnd).toBe("2026-03-20T11:00:00.000Z");

  const bookingRows = await db.query<{ customer_name: string }>(
    `select customer_name
     from bookings
     where id = ${created.bookingId}`,
  );
  expect(bookingRows.rows[0]?.customer_name).toBe("UI Flow Customer");
});
