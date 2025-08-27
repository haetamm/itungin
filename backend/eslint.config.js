// eslint.config.js
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 12,
      sourceType: "module",
      parser: typescriptParser,
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      prettier,
    },
    rules: {
      "prettier/prettier": [
        "error",
        {
          endOfLine: "lf",
          semi: true,
          trailingComma: "es5",
          singleQuote: true,
          printWidth: 80,
          tabWidth: 2,
        },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["error", "log", "warn"] }], // Tambah log, warn
      curly: "error",
      eqeqeq: "error",
      "no-throw-literal": "error",
    },
  },
  { ...prettierConfig },
  {
    languageOptions: {
      globals: {
        browser: true,
        es2021: true,
        node: true,
      },
    },
  },
];