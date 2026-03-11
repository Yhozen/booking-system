import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { cube } from "@electric-sql/pglite/contrib/cube";
import { earthdistance } from "@electric-sql/pglite/contrib/earthdistance";

import { PrismaClient } from "@/server/db";
import { PrismaPGlite } from "pglite-prisma-adapter";

const execFileAsync = promisify(execFile);

let schemaSqlPromise: Promise<string> | undefined;

export const getPgliteCompatibleSchemaSql = async (): Promise<string> => {
  schemaSqlPromise ??= (async () => {
    const prismaBin = resolve(
      process.cwd(),
      "node_modules",
      ".bin",
      process.platform === "win32" ? "prisma.cmd" : "prisma",
    );

    const { stdout } = await execFileAsync(
      prismaBin,
      [
        "migrate",
        "diff",
        "--from-empty",
        "--to-schema-datamodel",
        resolve(process.cwd(), "prisma", "schema.prisma"),
        "--script",
      ],
      {
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    return stdout;
  })();

  return schemaSqlPromise;
};

export const createRawPgliteForTest = async () => {
  const db = new PGlite({
    dataDir: "memory://",
    extensions: { btree_gist, cube, earthdistance },
  });

  return db;
};

export const createPgliteForTest = async () => {
  const db = await createRawPgliteForTest();

  await db.exec(await getPgliteCompatibleSchemaSql());

  return db;
};

export const createPglitePrismaForTest = async () => {
  const db = await createPgliteForTest();

  const adapter = new PrismaPGlite(db);
  const prisma = new PrismaClient({ adapter });

  return {
    db,
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      await db.close();
    },
  };
};
