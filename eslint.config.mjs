import js from "@eslint/js";
import html from "eslint-plugin-html";
import globals from "globals";

// I file dell'app sono script classici separati (nessun build step): vengono
// analizzati direttamente; i test sono CommonJS avviati da Bun.
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
    files: ["data.js", "storage.js", "app.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.browser },
    },
    // I tre script condividono le dichiarazioni globali lessicali: i riferimenti
    // cross-file sono intenzionali, quindi i controlli che non hanno un contesto
    // globale vengono lasciati ai test e al runtime.
    rules: { ...rules, "no-undef": "off", "no-unused-vars": "off" },
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
