import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // These are React Compiler-readiness rules bundled by default in
      // eslint-config-next's core-web-vitals set. This project does not
      // enable the React Compiler (no `reactCompiler` option in next.config.ts),
      // and the flagged patterns (fetch-on-mount in useEffect, a local mutable
      // accumulator inside a render-time .map()) are standard, correct React
      // code today. Downgraded to warnings so they stay visible if/when the
      // Compiler is adopted, without blocking production builds over
      // non-bugs.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
