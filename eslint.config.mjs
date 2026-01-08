import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  eslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
        project: "./tsconfig.json",
      },
      globals: {
        console: "readonly",
        process: "readonly",
        document: "readonly",
        setTimeout: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "obsidianmd": obsidianmd,
    },
    rules: {
      // TypeScript rules
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-undef": "off",
      "prefer-const": "error",
      "no-var": "error",

      // Obsidian recommended rules
      ...obsidianmd.configs.recommended,
    },
  },
  {
    files: ["manifest.json"],
    plugins: {
      "obsidianmd": obsidianmd,
    },
    rules: {
      "obsidianmd/validate-manifest": "error",
    },
  },
];
