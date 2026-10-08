import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: true,
    // Radix overlays render slowly under jsdom when CI runs ~37 workers at once; a test that
    // takes 100 ms locally has timed out at the 5 s default there.
    testTimeout: 20_000,
    // Playwright specs live in e2e/ and run separately (npm run e2e).
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test-setup.ts"],
      reporter: ["text-summary", "html"],
      // QD-405 floors: measured at introduction, minus ~2 points.
      thresholds: { statements: 73, branches: 79, functions: 70, lines: 74 },
    },
  },
});
