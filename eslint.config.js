import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Type-aware rules are the point: this extension's async runs in a service
// worker Chrome can kill mid-flight, so a floating promise is a lost blip.
export default tseslint.config(
  js.configs.recommended,
  {
    // Outside the TS project, so no type information to lint against.
    files: ["**/*.mjs", "**/*.js", "vitest.config.ts"],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  {
    files: ["src/**/*.ts"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      globals: { chrome: "readonly", browser: "readonly" },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      // Numbers in templates are counts, minutes and HTTP statuses, never a bug.
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      complexity: ["error", 8],
      "max-depth": ["error", 3],
      "max-lines-per-function": ["error", { max: 35, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // A vitest `describe` is a suite, not a function, so its length says nothing.
    files: ["src/**/*.test.ts"],
    rules: { "max-lines-per-function": "off" },
  },
  {
    ignores: ["dist/", "node_modules/"],
  },
);
