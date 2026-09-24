# ⚗ ChemMaster 4000

![Test](https://github.com/laok233/ChemMaster-4000/actions/workflows/test.yml/badge.svg)

> [!Warning] 
> This application is VIBE CODED, i have no idea how it works lol 

Piattaforma di studio della chimica in **HTML puro**, senza installazione né build: fai doppio clic su `index.html` (il menu principale) e da lì apri ogni funzione.

Le funzioni disponibili sono la **tavola periodica** (`pages/tavola.html`), con flashcard, quiz ed esercizi di scrittura, e la **nomenclatura chimica** (`pages/nomenclatura.html`), una guida interattiva con esempi inorganici, organici e nomi tradizionali, completata da un quiz basato sui suoi esempi.

## Cosa contiene

| Sezione | Cosa fai |
|---|---|
| **Menu principale** | La home (`index.html`): griglia di tessere, una per funzione disponibile. Clicca una tessera e la funzione si apre nella stessa finestra; il link **🏠 Menu** nell'header di ogni funzione riporta alla home. |
| **Tavola** | 118 elementi cliccabili: numero atomico, peso atomico (numero di massa per gli elementi radioattivi), gruppo/periodo, configurazione elettronica, gusci, categoria (il pannello dettagli si aggiorna anche quando il padroneggio cambia da altri esercizi). Ricerca testuale (se la query è un simbolo si evidenziano i simboli, altrimenti i nomi) e filtri per categoria, raggiungibili anche da tastiera. La barretta sotto ogni cella mostra quanto la padroneggi. Il chip **🧬 Biorilevanti** evidenzia i 26 elementi biorilevanti oscurando tutti gli altri (si combina con ricerca e filtri, e “Mostra tutti” lo spegne); il pannello dettagli mostra il badge 🧬 accanto alla categoria quando l’elemento è biorilevante. |
| **Nomenclatura** | La barra superiore alterna le schede **Guida** e **Quiz**. La guida offre ricerca, filtri per area e schede espandibili con regole, procedure, formule ed esempi; il quiz propone 5, 10 o 15 domande casuali su ambito misto, inorganico, organico o nomi tradizionali, con correzione immediata, spiegazione e riepilogo degli errori. |
| **Flashcard** | Ripetizione spaziata (mazzetti di Leitner, scadenze 0/1/3/7/21 giorni). 6 direzioni di domanda (nome↔simbolo↔numero atomico), 13 ambiti, giudizio *Non sapevo / Sapevo / Facile*; la percentuale del riepilogo è calcolata sulle carte effettivamente svolte. Scorciatoie: `Spazio`/`Invio` girano la carta, `1` `2` `3` giudicano. |
| **Quiz** | Risposta multipla con 4 opzioni (più “Non so”), 6 tipi di domanda, punteggio e serie. “Non so” conta come errore: va **subito** in “Ripassa gli errori”, azzera la serie e toglie punti di padroneggio. Ogni errore viene salvato **subito** in “Ripassa gli errori” e una risposta giusta lo toglie; la percentuale del riepilogo è calcolata sulle risposte effettivamente date. Scorciatoie: `1`–`4` rispondono, `5` = “Non so”, `Invio` va avanti. |
| **Scrivi la tavola** | **Tavola vuota**: clicchi una casella e scrivi il **simbolo** (il tooltip non svela la risposta; il nome completo riceve un richiamo senza penalità), con suggerimento e correzione immediata. **Sequenza**: scrivi i 118 simboli in ordine di numero atomico, con feedback e miglior posizione — anche qui il nome completo è ammesso come richiamo, senza penalità. |
| **Progressi** | Padroneggio medio, % per categoria, mazzetti (etichette derivate da `BOX_DAYS`, quindi sempre allineate alle scadenze, e barre proporzionali alle carte assegnate), storico quiz, importazione/esportazione JSON e azzeramento. |

Tutti i progressi sono salvati principalmente in IndexedDB e ripristinati al riavvio; il vecchio `localStorage` viene migrato con CAS e resta il fallback quando IndexedDB non è disponibile o non completa l'inizializzazione entro 5 secondi. Una lettura remota che termina durante una sessione aperta non può applicare lo snapshot e cancellarla. Le scritture IndexedDB usano una transazione atomica di confronto-and-scrittura, timeout operativi e `BroadcastChannel` per sincronizzare le schede; nel fallback localStorage, quando Web Locks è disponibile, le scritture multi-tab sono serializzate. Se IndexedDB e localStorage contengono copie diverse, l’app blocca la scrittura automatica e chiede una scelta esplicita. Le richieste di salvataggio già incluse nello snapshot precedente vengono compatte, mentre una modifica avvenuta durante una transazione non viene considerata salvata finché non viene persistita. Reset e import espliciti ricaricano il baseline corrente prima del CAS, così non falliscono silenziosamente dopo un conflitto. Una copia JSON può essere esportata e reimportata dall'avviso di errore o dalla sezione **Progressi**. Lo stato importato attraversa la stessa sanitizzazione dei dati salvati, i payload locali sono limitati a 1 MB e le versioni non supportate vengono rifiutate.

Accessibilità: tutte le pagine espongono un skip link come primo controllo accessibile per saltare header e navigazione; la vista attiva è marcata con `aria-current` e riceve il focus, anche nelle schede Guida/Quiz della nomenclatura. Filtri, modalità e celle selezionate espongono il loro stato; il focus segue l’avanzamento di flashcard e quiz; i feedback che cambiano in corso d’opera e il numero di elementi filtrati sono regioni `aria-live="polite"`; le barre di avanzamento espongono il valore tramite `role="progressbar"`; le scorciatoie tastiera sono dichiarate con `aria-keyshortcuts` e si attivano solo senza tasti modificatori; ogni controllo ha un nome accessibile e `prefers-reduced-motion` disattiva sia animazioni sia trasformazioni immediate dell’hover. La guida di nomenclatura usa controlli nativi, schede `<details>` e un indice navigabile; il quiz mantiene il focus tra domanda, risposta e riepilogo, dichiara le scorciatoie `1`–`5` e annuncia correzione e avanzamento. Su viewport stretti la tavola scorre dentro il proprio contenitore senza allargare la pagina.

### Supporto browser

Essendo un’app HTML senza build, il codice usa le API standard dei browser evergreen (`replaceChildren`, `normalize`, `globalThis`, `queueMicrotask` e Web Locks quando disponibile) senza polyfill. La CI copre Chromium; per ambienti legacy è consigliato un browser aggiornato. Il fallback `localStorage` mantiene la compatibilità, ma la serializzazione multi-tab è garantita solo quando Web Locks è disponibile: senza lock, usare una singola scheda per evitare scritture concorrenti.

## Struttura del progetto

```
index.html                 menu principale (hub), unico file HTML alla radice
assets/
└── css/
    └── style.css           tema e layout condivisi da tutte le pagine
pages/
├── tavola.html             tavola periodica e relative viste
└── nomenclatura.html       guida e quiz della nomenclatura
scripts/
├── table/
│   ├── data.js                 simboli, masse, categorie e configurazioni elettroniche
│   ├── storage-backend.js      repository IndexedDB atomico e BroadcastChannel
│   ├── storage.js              persistenza, migrazione e sanitizzazione dello stato
│   ├── app-core.js             helper DOM, navigazione e avanzamento globale
│   ├── app-table.js            griglia, dettagli, ricerca, filtri e biorilevanti
│   ├── app-flashcards.js       Leitner, giudizi e scorciatoie
│   ├── app-quiz.js             domande, risposte e ripasso errori
│   ├── app-writing.js          tavola vuota e sequenza
│   ├── app-progress.js         statistiche, barre e azzeramento
│   └── app-init.js             bootstrap e gestione degli eventi iniziali
└── nomenclature/
    ├── data.js                 contenuti, esempi e tabelle delle regole
    └── app.js                  navigazione Guida/Quiz, rendering e motore quiz
tests/
├── check-data.js               verifiche sui dati della tavola
├── check-nomenclature-data.js  schema, alias, fasi e scope dei dati di nomenclatura
├── fixtures/                   riferimento IUPAC indipendente per le 118 masse
├── helpers/                    harness JSDOM e ordine canonico degli script
├── app/                        test funzionali per area della tavola
├── test-app.js                 orchestratore dei test funzionali sulla tavola
├── test-browser.js             smoke test Chromium e audit WCAG con axe-core
├── test-menu.js                struttura e link del menu (jsdom)
├── test-nomenclature.js        guida e quiz della nomenclatura (jsdom)
├── test-storage-indexeddb.js   migrazione e confronto-and-scrittura IndexedDB
└── test-storage-lock.js        due tab concorrenti serializzate tramite Web Locks
package.json                    script di sviluppo, lint e test
eslint.config.mjs               contratto ESLint per moduli classici e test
.htmlvalidate.json              regole per la validazione HTML
bun.lock                        grafo delle dipendenze riproducibile per Bun/CI
.github/workflows/test.yml      pipeline CI
```

## Test

```bash
bun install --frozen-lockfile   # serve solo per test, lint e validazione; l'app non ha dipendenze runtime
bunx playwright install chromium # una volta, per i test browser (con --with-deps in CI)
bun run test                    # lint + HTML + JSDOM + IndexedDB/fallback + Chromium/axe
bun run test:unit               # dati + test JSDOM, senza browser
bun run test:storage            # concorrenza IndexedDB e fallback localStorage
bun run lint                    # solo ESLint
bun run validate                # solo HTML validate
bun run test:browser            # solo smoke test Chromium e audit axe-core
bun run test:nomenclature        # solo test JSDOM della guida di nomenclatura
```

In CI (GitHub Actions, `.github/workflows/test.yml`) gli script girano a ogni **push e pull request su `master`** con **Bun 1.4.2** pinnato (`bun install --frozen-lockfile`, installazione Chromium e `bun run test`): non viene avviato alcun processo Node per la suite. Le Action sono referenziate per SHA; `bun run test` include lint ESLint, validazione HTML, test JSDOM, test IndexedDB/fallback e smoke test Chromium con axe-core. La badge qui sopra riflette l'ultimo run.

- **`tests/check-data.js`** — 118 simboli/nomi/masse allineati e univoci, confronto completo
  con il riferimento IUPAC abbrigiato 2024 (comprese le revisioni Gd/Lu/Zr e i numeri di massa
  degli isotopi radioattivi), posizioni senza collisioni,
  ogni elemento categorizzato (con la regola CSS `.cat-<id>` corrispondente nel foglio di stile),
  elenco biorilevante senza simboli fantasmi né duplicati (26 voci, `BIO_Z` coerente,
  i 6 bioelementi strutturali presenti, categoria e regola CSS per ciascuno),
  somma degli elettroni di configurazione = numero atomico per tutti gli 118,
  configurazioni tutte scritte **nello stesso ordine di Aufbau** (base ed eccezioni),
  gusci coerenti, eccezioni di configurazione reali, controlli incrociati noti (Ar>K, Co>Ni, Te>I…),
  e che i mazzetti derivino davvero da `BOX_DAYS` (`MAX_BOX`, niente clamp hardcoded sul 5° mazzo)
  con soglia di padroneggio unica (`MASTERY_THRESHOLD`).
- **`tests/check-nomenclature-data.js`** — schema delle 17 schede, tabelle allineate, filtri derivati,
  quattro scope con pool canonici, alias e fasi degli esempi; il controllo blocca anche regressioni
  come `HCl`/`HCl(aq)` e acido etanoico/acetico.
- **`bun run validate`** — validazione HTML delle tre pagine con `html-validate`.
- **`tests/test-app.js`** — 362 asserzioni su interazioni reali (clic, digitazione, scorciatoie tastiera
  — incluse quelle **con tasti modificatori**, che non devono rispondere al posto nostro —,
  ricerca/filtri, evidenziazione biorilevanti (chip on/off, 26 accese/92 oscurate, priorità
  su ricerca e filtri di categoria, spento da “Mostra tutti”) e badge 🧬 nel pannello dettagli,
  legenda accessibile da tastiera, quiz con l’opzione “Non so” e ripasso errori, scrittura della tavola (segnaposto
  57–71/89–103 presenti anche nella tavola vuota), sequenza (input conservato durante il toggle
  dell’indizio-nome, svuotato solo a risposta, e nessun nome del prossimo elemento nel feedback
  d’errore), salvataggio/ripristino,
  stato corrotto in `localStorage` — inclusi padroneggio fuori scala clamped a 0..100, valori booleani scartati,
  contatori quiz salvati come stringhe numeriche convertiti in numero e `wrongZ` con Z fantasma scartato —,
  membri `null` anche
  annidati, chiavi fantasma nei mazzetti, azzeramento con quiz aperto (e messaggio + input ripuliti),
  `wrongZ` con duplicati/non numerici/booleani, percentuale flashcard calcolata sulle carte svolte,
  pannello dettagli che segue i cambi di padroneggio e distingue peso atomico e numero di massa,
  barre di categoria e mazzi proporzionali alle carte assegnate (non alle 118 caselle), con valori accessibili,
  `Enter`/`Spazio`/`Shift` con il focus sui controlli, Invio ripetuto senza penalità multiple,
  box Leitner 0 distinto da “nuovo”, conflitti multi-tab rifiutati senza sovrascrivere,
  sessioni avviate mentre una lettura remota o un reload è in volo senza perdita della coda,
  eventi `sessionStorage` ignorati senza provocare falsi conflitti,
  storage non disponibile con avviso/import/export, import valido o malformato, payload oltre 1 MB rifiutato e versioni future rifiutate,
  campi sconosciuti scartati e storico quiz coerente tra risposte, punteggio, errori e data,
  cella già risolta che non si segna in rosso dopo un errore e non viene penalizzata,
  suggerimento su casella già compilata, contatori e storico quiz fuori scala clamped
  (niente percentuali su domande negative, «Posizione 1000000000» o «Invalid Date»),
  `go()` con vista ignota che non lascia la pagina vuota, `aria-current`/`aria-pressed`/`aria-live`,
  navigazione senza animazione con `prefers-reduced-motion`, pannello dettagli non sticky su mobile,
  focus su carta/domanda/riepiloghi e «Termina» già visibile nel quiz prima di rispondere).
- **`tests/test-browser.js`** — 46 asserzioni: Chromium headless sul menu, sui nuovi percorsi delle pagine, sulla guida e sul quiz di nomenclatura e su tutte le viste della
  tavola, skip link e focus dell’indice, tabelle orizzontali a 320 px, nessun errore JavaScript,
  zero violazioni axe-core per i criteri WCAG 2.x A/AA applicabili, hover neutro con motion ridotto e avvio `file://` di tavola e nomenclatura senza server.
- **`tests/test-storage-indexeddb.js`** — 21 asserzioni: migrazione atomica da localStorage, conservazione dei payload oversized,
  caricamento condiviso del database, rifiuto di una seconda scrittura con baseline obsoleto,
  serializzazione dei salvataggi rapidi, rifiuto dei record falsi corrotti, timeout del bootstrap
  e delle operazioni successive, chiusura di un database aperto tardivamente e riconciliazione esplicita tra copie divergenti.
- **`tests/test-storage-lock.js`** — 22 asserzioni: due finestre con storage condiviso e lock
  concorrenti; la seconda scrittura obsoleta viene rifiutata e non annulla la prima; un reset
  invalida anche i salvataggi già in coda prima di scrivere lo stato vuoto; una modifica effettuata
  durante una transazione resta `dirty` finché non viene salvata; import esplicito dopo conflitto
  e reload con annuncio remoto vengono gestiti senza perdere lo snapshot; il reset della sola griglia
  non sovrascrive il mastery remoto; due richieste già incluse nello snapshot precedente producono
  una sola scrittura.
- **`tests/test-menu.js`** — 18 asserzioni: menu principale, titolo/h1, sottotitolo piattaforma, due tessere
  («Tavola periodica» → `pages/tavola.html` e «Nomenclatura» → `pages/nomenclatura.html`), e tutti i link `*.html` del menu puntano a file esistenti.
- **`tests/test-nomenclature.js`** — 94 asserzioni: struttura della pagina, 17 schede, nomi tradizionali
  inorganici e organici, ricerca normalizzata AND su regole/note/esempi/area (incluse formule come `N2O4` per `N₂O₄`),
  filtri tradizionali/inorganica/organica, indice sincronizzato, tabelle accessibili e focalizzabili, oltre alla navigazione
  Guida/Quiz e al quiz: ambiti, sali ternari, alias canonici, fasi, alternative, scorciatoie, risposta corretta/errata, “Non so”, riepilogo parziale
  ed errori da ripassare.

## Personalizzazione rapida

- Colori delle categorie: variabili `--alkali`, `--transition`, … in `assets/css/style.css` (in `CAT_DEF` il campo `v` le collega alle categorie).
- Elementi biorilevanti: la stringa `BIO_SYMS` in `scripts/table/data.js` (il conteggio nel chip 🧬 e il badge si aggiornano da soli).
- Durate dei mazzetti: `BOX_DAYS = [0, 1, 3, 7, 21]` in `scripts/table/storage.js` (le etichette in *Progressi* e l'ultimo mazzo,
  `MAX_BOX = BOX_DAYS.length - 1`, si aggiornano da sole).
- Punti per il padroneggio: `addMastery(z, ±n)` nei vari motori (quiz +8/−6, flashcard +12/+20/−15, tavola vuota +12/−3, sequenza +10/−3).
- Soglia “padroneggiato”: `MASTERY_THRESHOLD = 70` (una sola definizione, usata da contatore in testa, ambiti flashcard/quiz e statistiche).
