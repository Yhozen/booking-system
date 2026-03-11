// @vitest-environment node

import { afterAll, describe, expect, it } from "vitest";

import { createPglitePrismaForTest } from "@/test/pglite-prisma";

const { prisma, cleanup } = await createPglitePrismaForTest();

afterAll(async () => {
  await cleanup();
});

describe("post model with pglite", () => {
  it("creates and finds a post", async () => {
    const created = await prisma.post.create({
      data: { name: "hello vitest" },
    });

    const found = await prisma.post.findUnique({
      where: { id: created.id },
    });

    expect(found).toMatchObject({
      id: created.id,
      name: "hello vitest",
    });
  });
});
