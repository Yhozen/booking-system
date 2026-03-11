import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PrismaClient } from "../../generated/prisma";
import { createRawPgliteForTest } from "@/test/pglite-prisma";
import { PrismaPGlite } from "pglite-prisma-adapter";

export const createBookingDbForTest = async () => {
  const db = await createRawPgliteForTest();
  const sql = await readFile(
    resolve(process.cwd(), "src/server/db/sql/booking_v1.sql"),
    "utf8",
  );

  await db.exec(sql);

  return {
    db,
    cleanup: async () => {
      await db.close();
    },
  };
};

export const createBookingPrismaForTest = async () => {
  const { db } = await createBookingDbForTest();

  const adapter = new PrismaPGlite(db);
  const prisma = new PrismaClient({ adapter: adapter as never });

  return {
    db,
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      await db.close();
    },
  };
};
