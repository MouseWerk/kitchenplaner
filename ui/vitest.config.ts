import { defineConfig } from "vitest/config";

process.env.TZ = "Europe/Berlin";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    testTimeout: 20_000,
  },
});
