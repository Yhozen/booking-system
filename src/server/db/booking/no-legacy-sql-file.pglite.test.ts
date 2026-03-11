// @vitest-environment node

import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, it } from "vitest";

it("keeps booking DDL only in prisma migrations", async () => {
  const legacyPath = resolve(process.cwd(), "src/server/db/sql/booking_v1.sql");
  await expect(access(legacyPath, constants.F_OK)).rejects.toThrow();
});
