import js from "@eslint/js";
import globals from "globals";

// I file dell'app sono script classici separati (nessun build step): vengono
// analizzati direttamente; i test sono CommonJS avviati da Bun.

// Contratto esplicito degli script classici. La lista rende gli incroci
// fra i moduli applicativi visibili a ESLint, invece di disattivare no-undef
// per tutto il codice dell'applicazione.
const sharedGlobalNames = [
  // data.js
  "SYMBOLS", "NAMES", "MASSES", "CAT_DEF", "CAT_LABEL", "posOf", "CFG_EXC", "AUFBAU",
  "baseConfig", "shellsOf", "prettyCfg", "catOf", "ELEMENTS", "BY_Z", "BIO_SYMS", "BIO_Z",
  // scripts/nomenclature/data.js
  "NOMENCLATURE_FILTERS", "NOMENCLATURE_CARDS",
  // storage-backend.js
  "createProgressStore",
  // storage.js
  "STORE_KEY", "STATE_VERSION", "DAY", "BOX_DAYS", "defaultState", "isObj", "isNum", "uint",
  "isElementKey", "elementMap", "sanitizeState", "state", "storageBackend", "progressStore", "storageReady",
  "storageBaseline", "storageBaselineKnown", "storageDirty", "storageConflict", "storageLoadIssue", "storageWriteBlocked",
  "storageSavePending", "storageEpoch", "storageReadEpoch", "appReady", "pendingStorageEvent",
  "decodeStoredState", "applyLoadedState", "readActiveState", "initializeStorage", "showStorageWarning", "hideStorageWarning",
  "showStorageLoadIssue", "storageWriteError", "saveNow", "saveWithLock", "enqueueSave", "save", "saveReplacement", "exportProgress",
  "applyImportedState", "importProgress", "hasPendingTransientState", "resetTransientUI",
  "renderPersistedState", "reloadFromDisk", "openImportDialog", "handleProgressEvent", "handleStorageEvent", "mastery",
  "addMastery", "MASTERY_THRESHOLD", "masteredCount", "avgMastery",
  // app-core.js
  "makeElement", "go", "updateHead",
  // app-table.js
  "activeCats", "placeholderTimer", "bioOn", "cellChildren", "setCellA11y", "buildGrid", "applyFilter", "setBio",
  "renderLegend", "detailZ", "renderDetail", "refreshCellMastery",
  // app-flashcards.js
  "DIRS", "fieldValue", "fieldLabel", "scopeOptions", "MAX_BOX", "boxOf", "dueNow", "scopePool", "shuffle",
  "cards", "cardScopesBuilt", "refreshCardScopes", "updateCardInfo", "startCards", "setCardA11y", "showCard",
  "flipCard", "gradeCard", "finishCards", "resetCardsUI",
  // app-quiz.js
  "questionFieldLabel", "QTYPES", "buildQuizTypes", "quizScopeBuilt", "refreshQuizScopes", "quiz", "NON_SO",
  "makeQuestion", "startQuiz", "renderQuestion", "answerQuiz", "nextQuestion", "finishQuiz",
  // app-writing.js
  "wSel", "writeGridBound", "initWriteGrid", "wMsg", "updateWFilled", "clearCellSelection", "checkCell",
  "seq", "seqRender", "seqCheck",
  // app-progress.js
  "renderStats",
  // app-init.js
  "appReadyPromise"
];
const sharedGlobals = Object.fromEntries(sharedGlobalNames.map(name => [name, "writable"]));

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

  {
    files: ["scripts/table/*.js", "scripts/nomenclature/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.browser, ...sharedGlobals },
    },
    // I riferimenti cross-file sono dichiarati nel contratto sharedGlobals;
    // no-unused-vars resta disattivato perché le dichiarazioni top-level sono
    // consumate dagli altri script, non dal file che le esporta.
    rules: {
      ...rules,
      "no-undef": "error",
      "no-unused-vars": "off",
      "no-redeclare": ["error", { builtinGlobals: false }]
    },
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
