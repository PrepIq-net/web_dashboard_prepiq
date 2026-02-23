import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  // Minimal baseline config; project-specific rules can be layered in later.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
