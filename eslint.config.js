import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Mirrors blipr-web's config. The react half does not apply here; what is
// extension-specific are the browser globals, the dist ignore, and a
// complexity ceiling this repo holds itself to.
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: { chrome: "readonly", browser: "readonly" },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      complexity: ["error", 8],
    },
  },
  {
    // Node scripts run directly, not bundled.
    files: ["**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
  {
    ignores: ["dist/", "node_modules/"],
  },
);
