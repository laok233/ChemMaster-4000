# ⚗ ChemMaster 4000

![Test](https://github.com/laok233/ChemMaster-4000/actions/workflows/test.yml/badge.svg)

> [!Warning] 
> This application is VIBE CODED, i have no idea how it works lol 

Piattaforma di studio della chimica in **HTML puro**, senza installazione né build: fai doppio clic su `index.html` (il menu principale) e da lì apri ogni funzione.

Per ora l'unica funzione è la **tavola periodica** (`tavola.html`), che contiene flashcard, quiz ed esercizi di scrittura; altre funzioni arriveranno come nuove pagine collegate dal menu.

## Cosa contiene

| Sezione | Cosa fai |
|---|---|
| **Menu principale** | La home (`index.html`): griglia di tessere, una per funzione disponibile. Clicca una tessera e la funzione si apre nella stessa finestra; il link **🏠 Menu** nell'header di ogni funzione riporta alla home. |
| **Tavola** | 118 elementi cliccabili: numero atomico, massa, gruppo/periodo, configurazione elettronica, gusci, categoria (il pannello dettagli si aggiorna anche quando il padroneggio cambia da altri esercizi). Ricerca testuale (se la query è un simbolo si evidenziano i simboli, altrimenti i nomi) e filtri per categoria, raggiungibili anche da tastiera. La barretta sotto ogni cella mostra quanto la padroneggi. Il chip **🧬 Biorilevanti** evidenzia i 26 elementi biorilevanti oscurando tutti gli altri (si combina con ricerca e filtri, e “Mostra tutti” lo spegne); il pannello dettagli mostra il badge 🧬 accanto alla categoria quando l’elemento è biorilevante. |
| **Flashcard** | Ripetizione spaziata (mazzetti di Leitner, scadenze 0/1/3/7/21 giorni). 6 direzioni di domanda (nome↔simbolo↔numero atomico), 13 ambiti, giudizio *Non sapevo / Sapevo / Facile*; la percentuale del riepilogo è calcolata sulle carte effettivamente svolte. Scorciatoie: `Spazio`/`Invio` girano la carta, `1` `2` `3` giudicano. |
| **Quiz** | Risposta multipla con 4 opzioni (più “Non so”), 6 tipi di domanda, punteggio e serie. “Non so” conta come errore: va **subito** in “Ripassa gli errori”, azzera la serie e toglie punti di padroneggio. Ogni errore viene salvato **subito** in “Ripassa gli errori” e una risposta giusta lo toglie; la percentuale del riepilogo è calcolata sulle risposte effettivamente date. Scorciatoie: `1`–`4` rispondono, `5` = “Non so”, `Invio` va avanti. |
| **Scrivi la tavola** | **Tavola vuota**: clicchi una casella e scrivi il **simbolo** (il tooltip non svela la risposta; il nome completo riceve un richiamo senza penalità), con suggerimento e correzione immediata. **Sequenza**: scrivi i 118 simboli in ordine di numero atomico, con feedback e miglior posizione — anche qui il nome completo è ammesso come richiamo, senza penalità. |
| **Progressi** | Padroneggio medio, % per categoria, mazzetti (etichette derivate da `BOX_DAYS`, quindi sempre allineate alle scadenze, e barre proporzionali alle carte assegnate), storico quiz, azzeramento. |

Tutti i progressi sono salvati in `localStorage` e ripristinati al riavvio. Quando Web Locks è disponibile, le scritture sono serializzate tra le schede; il fallback verifica comunque il baseline e rifiuta snapshot obsoleti. In caso di storage non disponibile la app mostra un avviso e permette di esportare una copia JSON.

Accessibilità: la vista attiva è marcata con `aria-current` e riceve il focus; filtri, modalità e celle selezionate espongono il loro stato; il focus segue l’avanzamento di flashcard e quiz; i feedback che cambiano in corso d’opera sono regioni `aria-live="polite"`; le scorciatoie tastiera si attivano solo senza tasti modificatori e ogni controllo ha un nome accessibile.

## Struttura del progetto

```
index.html     menu principale (hub): griglia con una tessera per funzione
tavola.html    funzione «Tavola periodica» (ex index.html)
├── <style>   tema scuro, layout a griglia CSS della tavola (18 colonne + colonna periodi)
├── <body>    5 sezioni (una vista per modalità)
└── <script>
    ├── DATI          simboli, nomi italiani, masse, categorie, posizioni,
    │                 configurazioni elettronica (con le eccezioni note: Cr, Cu, Mo, Au…)
    │                 e BIO_SYMS/BIO_Z (i 26 elementi biorilevanti)
    ├── STATO         persistenza versionata in localStorage, protezione dai conflitti
    │                 multi-tab, avviso/esportazione se lo storage non è disponibile,
    │                 sanitizzazione dello stato corrotto (anche ai membri annidati),
    │                 scarto di booleani/chiavi non canoniche, caselle `solved` a soli
    │                 valori/elementi validi, `wrongZ` a soli Z reali, contatori
    │                 quiz/sequenza convertiti in numero e clamp 0..100
    ├── TAVOLA        griglia, ricerca, filtri, chip biorilevanti, pannello dettaglio (badge 🧬)
    ├── FLASHCARD     coda, mazzetti di Leitner, scadenze
    ├── QUIZ          generazione domande + distrattori
    ├── SCRIVI        validazione casella e sequenza
    └── PROGRESSI     statistiche
tests/
├── check-data.js   verifiche sui dati della tavola (nessuna dipendenza)
├── test-app.js          test funzionali sulla tavola, interazioni reali (jsdom)
├── test-menu.js         test del menu principale: struttura e link (jsdom)
└── test-storage-lock.js due tab concorrenti serializzate tramite Web Locks
├── eslint.config.mjs   lint (ESLint): script inline dentro gli HTML + test
├── .htmlvalidate.json  regole per la validazione HTML
└── package-lock.json   grafo delle dipendenze riproducibile per npm/CI
```

## Test

```bash
npm ci               # (o: bun install) serve solo per test, lint e validazione; l'app non ha dipendenze runtime
npm test             # (o: bun run test)  → lint + validazione HTML + i quattro test
npm run lint         # solo ESLint
npm run validate     # solo HTML validate
```

In CI (GitHub Actions, `.github/workflows/test.yml`) gli script girano a ogni **push e pull request su `master`**, con matrix **Node 22 e 24** (`npm ci --ignore-scripts` + `npm test`, usando il `package-lock.json` committed) e una job separata con **Bun 1.4.2** pinnato (`bun install --frozen-lockfile` + `bun run test`) per validare il `bun.lock`. Le Action sono referenziate per SHA; `npm test` include lint ESLint e validazione HTML. La badge qui sopra riflette l'ultimo run.

- **`tests/check-data.js`** — 118 simboli/nomi/masse allineati e univoci, posizioni senza collisioni,
  ogni elemento categorizzato (con la regola CSS `.cat-<id>` corrispondente nel foglio di stile),
  elenco biorilevante senza simboli fantasmi né duplicati (26 voci, `BIO_Z` coerente,
  i 6 bioelementi strutturali presenti, categoria e regola CSS per ciascuno),
  somma degli elettroni di configurazione = numero atomico per tutti gli 118,
  configurazioni tutte scritte **nello stesso ordine di Aufbau** (base ed eccezioni),
  gusci coerenti, eccezioni di configurazione reali, controlli incrociati noti (Ar>K, Co>Ni, Te>I…),
  e che i mazzetti derivino davvero da `BOX_DAYS` (`MAX_BOX`, niente clamp hardcoded sul 5° mazzo)
  con soglia di padroneggio unica (`MASTERY_THRESHOLD`).
- **`npm run validate`** — validazione HTML delle due pagine con `html-validate`.
- **`tests/test-app.js`** — 293 asserzioni su interazioni reali (clic, digitazione, scorciatoie tastiera
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
  pannello dettagli che segue i cambi di padroneggio, barre dei mazzi proporzionali alle carte
  assegnate (non alle 118 caselle),
  `Enter`/`Spazio`/`Shift` con il focus sui controlli, Invio ripetuto senza penalità multiple,
  box Leitner 0 distinto da “nuovo”, conflitti multi-tab rifiutati senza sovrascrivere,
  storage non disponibile con avviso/esportazione, schema versionato e sanitizia di chiavi ereditate/non canoniche,
  cella già risolta che non si segna in rosso dopo un errore e non viene penalizzata,
  suggerimento su casella già compilata, contatori e storico quiz fuori scala clamped
  (niente percentuali su domande negative, «Posizione 1000000000» o «Invalid Date»),
  `go()` con vista ignota che non lascia la pagina vuota, `aria-current`/`aria-pressed`/`aria-live`,
  focus su carta/domanda/riepiloghi e «Termina» già visibile nel quiz prima di rispondere).
- **`tests/test-storage-lock.js`** — 4 asserzioni: due finestre con storage condiviso e lock
  concorrenti; la seconda scrittura obsoleta viene rifiutata e non annulla la prima.
- **`tests/test-menu.js`** — menu principale: titolo/h1, sottotitolo piattaforma, una sola tessera
  («Tavola periodica» → `tavola.html`), e tutti i link `*.html` del menu puntano a file esistenti.

## Personalizzazione rapida

- Colori delle categorie: variabili `--alkali`, `--transition`, … in `:root` (in `CAT_DEF` il campo `v` le collega alle categorie).
- Elementi biorilevanti: la stringa `BIO_SYMS` in `DATI` (il conteggio nel chip 🧬 e il badge si aggiornano da soli).
- Durate dei mazzetti: `BOX_DAYS = [0, 1, 3, 7, 21]` (le etichette in *Progressi* e l'ultimo mazzo,
  `MAX_BOX = BOX_DAYS.length - 1`, si aggiornano da sole).
- Punti per il padroneggio: `addMastery(z, ±n)` nei vari motori (quiz +8/−6, flashcard +12/+20/−15, tavola vuota +12/−3, sequenza +10/−3).
- Soglia “padroneggiato”: `MASTERY_THRESHOLD = 70` (una sola definizione, usata da contatore in testa, ambiti flashcard/quiz e statistiche).
