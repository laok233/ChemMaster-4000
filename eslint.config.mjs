import js from "@eslint/js";
import html from "eslint-plugin-html";
import globals from "globals";

// L'app vive in <script> dentro gli HTML (nessun build step): eslint-plugin-html
// estrae e stima quegli script, mentre i test sono CommonJS avviati da Bun.
const rules = {
  ...js.configs.recommended.rules,
  // save() e load() hanno catch vuoti di proposito: un localStorage inaccessibile
  // non deve mai far crashare la pagina
  "no-empty": ["error", { allowEmptyCatch: true }],
  // gli handler generici leggono e.target senza usarlo sempre
  "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }],
};

export default [
  { ignores: ["node_modules/**"] },

  { files: ["**/*.html"], plugins: { html } },
  {
    files: ["**/*.html"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.browser },
    },
    rules,
  },

  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules,
  },
];
