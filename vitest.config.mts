import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  css: { postcss: {} },
  test: { include: ["src/**/*.test.ts"] },
});
