// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tsEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // 1. Base config (ESLint + TypeScript + React)
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        // Tambah global jika perlu (contoh: Node.js, Browser)
        console: "readonly",
        process: "readonly",
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "@typescript-eslint": tsEslint,
      prettier,
    },
    settings: {
      react: {
        version: "detect", // Otomatis detect React 19
      },
    },
    rules: {
      // React
      "react/react-in-jsx-scope": "off", // React 19 tidak butuh import React
      "react/prop-types": "off", // Pakai TypeScript

      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // TypeScript
      "@typescript-eslint/no-unused-vars": "error",
      "no-unused-vars": "off", // Matikan base, pakai TS

      // Prettier
      "prettier/prettier": [
        "error",
        {
          semi: true,
          singleQuote: true,
          tabWidth: 2,
          trailingComma: "es5",
          printWidth: 80,
          endOfLine: "lf",
        },
      ],

      // Tambahan
      "no-console": "warn",
    },
  },

  // 2. Matikan aturan yang konflik dengan Prettier
  prettierConfig,
];