// @vitest-environment node

import { afterAll, expect, it } from "vitest";

import {
  createProvider,
  createService,
} from "@/server/db/booking/test-helpers";
import { createBookingDbForTest } from "@/test/pglite-booking";

const { db, cleanup } = await createBookingDbForTest();

afterAll(cleanup);

it("rejects overlapping global blocks for same provider", async () => {
  const providerUserId = await createProvider(db, {
    displayName: "Provider A",
  });

  await db.query(
    `insert into availability_blocks (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       null,
       tstzrange('2026-03-20 13:00:00+00', '2026-03-20 14:00:00+00', '[)'),
       'manual'
     )`,
  );

  await expect(
    db.query(
      `insert into availability_blocks (provider_user_id, service_id, slot, source)
       values (
         ${providerUserId},
         null,
         tstzrange('2026-03-20 13:30:00+00', '2026-03-20 14:30:00+00', '[)'),
         'manual'
       )`,
    ),
  ).rejects.toThrow(/exclusion|overlap|availability_blocks_no_overlap/i);
});

it("allows overlap for different providers", async () => {
  const providerAId = await createProvider(db, { displayName: "Provider B1" });
  const providerBId = await createProvider(db, { displayName: "Provider B2" });

  await db.query(
    `insert into availability_blocks (provider_user_id, service_id, slot, source)
     values (
       ${providerAId},
       null,
       tstzrange('2026-03-21 10:00:00+00', '2026-03-21 11:00:00+00', '[)'),
       'manual'
     )`,
  );

  await expect(
    db.query(
      `insert into availability_blocks (provider_user_id, service_id, slot, source)
       values (
         ${providerBId},
         null,
         tstzrange('2026-03-21 10:30:00+00', '2026-03-21 11:30:00+00', '[)'),
         'manual'
       )`,
    ),
  ).resolves.toBeDefined();
});

it("rejects overlapping blocks for same provider and same service scope", async () => {
  const providerUserId = await createProvider(db, {
    displayName: "Provider B3",
  });
  const serviceId = await createService(db, providerUserId, {
    name: "Service D",
  });

  await db.query(
    `insert into availability_blocks (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       ${serviceId},
       tstzrange('2026-03-21 12:00:00+00', '2026-03-21 13:00:00+00', '[)'),
       'manual'
     )`,
  );

  await expect(
    db.query(
      `insert into availability_blocks (provider_user_id, service_id, slot, source)
       values (
         ${providerUserId},
         ${serviceId},
         tstzrange('2026-03-21 12:30:00+00', '2026-03-21 13:30:00+00', '[)'),
         'manual'
       )`,
    ),
  ).rejects.toThrow(/exclusion|overlap|availability_blocks_no_overlap/i);
});

it("allows overlapping blocks for same provider and different service scopes", async () => {
  const providerUserId = await createProvider(db, {
    displayName: "Provider B4",
  });
  const serviceAId = await createService(db, providerUserId, {
    name: "Service E",
  });
  const serviceBId = await createService(db, providerUserId, {
    name: "Service F",
  });

  await db.query(
    `insert into availability_blocks (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       ${serviceAId},
       tstzrange('2026-03-21 14:00:00+00', '2026-03-21 15:00:00+00', '[)'),
       'manual'
     )`,
  );

  await expect(
    db.query(
      `insert into availability_blocks (provider_user_id, service_id, slot, source)
       values (
         ${providerUserId},
         ${serviceBId},
         tstzrange('2026-03-21 14:30:00+00', '2026-03-21 15:30:00+00', '[)'),
         'manual'
       )`,
    ),
  ).resolves.toBeDefined();
});

it("allows overlap for same provider when service scopes differ", async () => {
  const providerUserId = await createProvider(db, {
    displayName: "Provider C",
  });
  const serviceAId = await createService(db, providerUserId, {
    name: "Service A",
  });
  const serviceBId = await createService(db, providerUserId, {
    name: "Service B",
  });

  await db.query(
    `insert into availability_windows (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       ${serviceAId},
       tstzrange('2026-03-22 09:00:00+00', '2026-03-22 10:00:00+00', '[)'),
       'manual'
     )`,
  );

  await expect(
    db.query(
      `insert into availability_windows (provider_user_id, service_id, slot, source)
       values (
         ${providerUserId},
         ${serviceBId},
         tstzrange('2026-03-22 09:30:00+00', '2026-03-22 10:30:00+00', '[)'),
         'manual'
       )`,
    ),
  ).resolves.toBeDefined();
});

it("rejects overlapping windows for same provider and same service scope", async () => {
  const providerUserId = await createProvider(db, {
    displayName: "Provider D",
  });
  const serviceId = await createService(db, providerUserId, {
    name: "Scoped Service",
  });

  await db.query(
    `insert into availability_windows (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       ${serviceId},
       tstzrange('2026-03-23 11:00:00+00', '2026-03-23 12:00:00+00', '[)'),
       'manual'
     )`,
  );

  await expect(
    db.query(
      `insert into availability_windows (provider_user_id, service_id, slot, source)
       values (
         ${providerUserId},
         ${serviceId},
         tstzrange('2026-03-23 11:30:00+00', '2026-03-23 12:30:00+00', '[)'),
         'manual'
       )`,
    ),
  ).rejects.toThrow(/exclusion|overlap|availability_windows_no_overlap/i);
});

it("allows overlap for same provider between global and service-scoped windows", async () => {
  const providerUserId = await createProvider(db, {
    displayName: "Provider E",
  });
  const serviceId = await createService(db, providerUserId, {
    name: "Service C",
  });

  await db.query(
    `insert into availability_windows (provider_user_id, service_id, slot, source)
     values (
       ${providerUserId},
       null,
       tstzrange('2026-03-24 08:00:00+00', '2026-03-24 09:00:00+00', '[)'),
       'manual'
     )`,
  );

  await expect(
    db.query(
      `insert into availability_windows (provider_user_id, service_id, slot, source)
       values (
         ${providerUserId},
         ${serviceId},
         tstzrange('2026-03-24 08:30:00+00', '2026-03-24 09:30:00+00', '[)'),
         'manual'
       )`,
    ),
  ).resolves.toBeDefined();
});
