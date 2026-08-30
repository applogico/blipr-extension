import { defineConfig } from "vitest/config";

// Pure logic runs in node; a file opts into jsdom with a
// `@vitest-environment jsdom` docblock when it needs a real DOM.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
