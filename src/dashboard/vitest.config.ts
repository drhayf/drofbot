import path from "node:path";
import { defineConfig } from "vitest/config";

const dashboardRoot = path.resolve(__dirname);

export default defineConfig({
  root: dashboardRoot,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: [path.resolve(__dirname, "src/__tests__/setup.ts")],
    globals: true,
  },
});
