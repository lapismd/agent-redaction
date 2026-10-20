import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "scripts/architecture.test.mjs",
      "scripts/native-boundaries.test.mjs",
    ],
  },
});
