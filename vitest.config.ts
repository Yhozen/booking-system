import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    clearMocks: true,
    globalSetup: ["./src/test/global-setup.ts"],
    include: ["src/**/*.test.ts"],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
