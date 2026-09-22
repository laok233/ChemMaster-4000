# ⚗ Tavola Periodica — impara a memoria

![Test](https://github.com/laok233/tavola-periodica/actions/workflows/test.yml/badge.svg)

> [!Warning] 
> This application is VIBE CODED, i have no idea how it works lol 

Web app in un **unico file HTML**, senza installazione né build: fai doppio clic su `index.html` e funziona.

## Cosa contiene

| Sezione | Cosa fai |
|---|---|
| **Tavola** | 118 elementi cliccabili: numero atomico, massa, gruppo/periodo, configurazione elettronica, gusci, categoria (il pannello dettagli si aggiorna anche quando il padroneggio cambia da altri esercizi). Ricerca testuale (se la query è un simbolo si evidenziano i simboli, altrimenti i nomi) e filtri per categoria, raggiungibili anche da tastiera. La barretta sotto ogni cella mostra quanto la padroneggi. Il chip **🧬 Biorilevanti** evidenzia i 26 elementi biorilevanti oscurando tutti gli altri (si combina con ricerca e filtri, e “Mostra tutti” lo spegne); il pannello dettagli mostra il badge 🧬 accanto alla categoria quando l’elemento è biorilevante. |
| **Flashcard** | Ripetizione spaziata (mazzetti di Leitner, scadenze 0/1/3/7/21 giorni). 6 direzioni di domanda (nome↔simbolo↔numero atomico), 13 ambiti, giudizio *Non sapevo / Sapevo / Facile*; la percentuale del riepilogo è calcolata sulle carte effettivamente svolte. Scorciatoie: `Spazio`/`Invio` girano la carta, `1` `2` `3` giudicano. |
| **Quiz** | Risposta multipla con 4 opzioni (più “Non so”), 6 tipi di domanda, punteggio e serie. “Non so” conta come errore: va **subito** in “Ripassa gli errori”, azzera la serie e toglie punti di padroneggio. Ogni errore viene salvato **subito** in “Ripassa gli errori” e una risposta giusta lo toglie; la percentuale del riepilogo è calcolata sulle risposte effettivamente date. Scorciatoie: `1`–`4` rispondono, `5` = “Non so”, `Invio` va avanti. |
| **Scrivi la tavola** | **Tavola vuota**: clicchi una casella e scrivi il **simbolo** (il tooltip non svela la risposta; il nome completo riceve un richiamo senza penalità), con suggerimento e correzione immediata. **Sequenza**: scrivi i 118 simboli in ordine di numero atomico, con feedback e miglior posizione — anche qui il nome completo è ammesso come richiamo, senza penalità. |
| **Progressi** | Padroneggio medio, % per categoria, mazzetti (etichette derivate da `BOX_DAYS`, quindi sempre allineate alle scadenze, e barre proporzionali alle carte assegnate), storico quiz, azzeramento. |

Tutti i progressi sono salvati in `localStorage` e ripristinati al riavvio.

## Struttura del progetto

```
index.html
├── <style>   tema scuro, layout a griglia CSS della tavola (18 colonne + colonna periodi)
├── <body>    5 sezioni (una vista per modalità)
└── <script>
    ├── DATI          simboli, nomi italiani, masse, categorie, posizioni,
    │                 configurazioni elettronica (con le eccezioni note: Cr, Cu, Mo, Au…)
    │                 e BIO_SYMS/BIO_Z (i 26 elementi biorilevanti)
    ├── STATO         persistenza in localStorage (con sanitizzazione dello stato
    │                 corrotto, anche ai membri annidati, scarto dei booleani,
    │                 caselle `solved` a soli valori/elementi validi, `wrongZ` a soli
    │                 Z reali, contatori quiz/sequenza convertiti in numero, e clamp
    │                 del padroneggio a 0..100) + "padroneggio" per elemento
    ├── TAVOLA        griglia, ricerca, filtri, chip biorilevanti, pannello dettagli (badge 🧬)
    ├── FLASHCARD     coda, mazzetti di Leitner, scadenze
    ├── QUIZ          generazione domande + distrattori
    ├── SCRIVI        validazione casella e sequenza
    └── PROGRESSI     statistiche
tests/
├── check-data.js   verifiche sui dati (nessuna dipendenza)
└── test-app.js     test funzionali su interazioni reali (jsdom)
```

## Test

```bash
npm install          # (o: bun install) serve solo per i test, l'app non ha dipendenze
npm test             # (o: bun run test)
```

In CI (GitHub Actions, `.github/workflows/test.yml`) i due script girano a ogni **push e pull request su `master`**, con matrix **Node 22 e 24** (`npm install` + `npm test`, visto che il repo non ha `package-lock.json`) e una job separata con **Bun** (`bun install --frozen-lockfile` + `bun run test`) per validare il `bun.lock` committed. La badge qui sopra riflette l'ultimo run.

- **`tests/check-data.js`** — 118 simboli/nomi/masse allineati e univoci, posizioni senza collisioni,
  ogni elemento categorizzato (con la regola CSS `.cat-<id>` corrispondente nel foglio di stile),
  elenco biorilevante senza simboli fantasmi né duplicati (26 voci, `BIO_Z` coerente,
  i 6 bioelementi strutturali presenti, categoria e regola CSS per ciascuno),
  somma degli elettroni di configurazione = numero atomico per tutti gli 118,
  configurazioni tutte scritte **nello stesso ordine di Aufbau** (base ed eccezioni),
  gusci coerenti, eccezioni di configurazione reali, controlli incrociati noti (Ar>K, Co>Ni, Te>I…).
- **`tests/test-app.js`** — 219 asserzioni su interazioni reali (clic, digitazione, scorciatoie tastiera
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
  `Enter`/`Spazio` con il focus su un bottone non intercettati dai gestori globali).

## Personalizzazione rapida

- Colori delle categorie: variabili `--alkali`, `--transition`, … in `:root` (in `CAT_DEF` il campo `v` le collega alle categorie).
- Elementi biorilevanti: la stringa `BIO_SYMS` in `DATI` (il conteggio nel chip 🧬 e il badge si aggiornano da soli).
- Durate dei mazzetti: `BOX_DAYS = [0, 1, 3, 7, 21]` (le etichette in *Progressi* si aggiornano da sole).
- Punti per il padroneggio: `addMastery(z, ±n)` nei vari motori (quiz +8/−6, flashcard +12/+20/−15, tavola vuota +12/−3, sequenza +10/−3).
- Soglia “padroneggiato”: `mastery(e.z) >= 70`.
