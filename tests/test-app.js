// Orchestratore dei test funzionali della app (jsdom).
// Ogni area condivide lo stesso harness e la stessa istanza per preservare
// l'ordine degli esercizi che costruiscono lo stato persistito.
const { createTestApp } = require("./helpers/app-harness");

async function main() {
  const context = await createTestApp();
  const suites = [
    require("./app/table"),
    require("./app/flashcards"),
    require("./app/quiz"),
    require("./app/writing"),
    require("./app/progress"),
    require("./app/persistence"),
    require("./app/navigation")
  ];
  for (const run of suites) await run(context);

  const { pass, fail, failures } = context.results();
  console.log("\n================ RISULTATO ================");
  console.log("PASS: " + pass + "   FAIL: " + fail);
  if (failures.length) {
    console.log("\nFallimenti:");
    failures.forEach(failure => console.log("  x " + failure));
  }
  process.exit(fail ? 1 : 0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
