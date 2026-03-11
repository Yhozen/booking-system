import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createPgliteForTest } from "@/test/pglite-prisma";

export const createBookingDbForTest = async () => {
  const db = await createPgliteForTest();
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
