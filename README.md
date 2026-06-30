<p align="center">
  <img src="src/image/buildER%20no%20background.png" alt="buildER logo" width="520" />
</p>

# buildER (v6.3)

Editor web React + TypeScript per modellare diagrammi ER in stile Chen con canvas SVG, toolbar laterale, undo/redo, project file `.ersp`, export PNG/SVG/JPEG e sincronizzazione ERS live.

## Stato del progetto

buildER è la nuova evoluzione di ER Studio. La versione 6.2 è un major update dedicato a versioning locale dei progetti, confronto visuale tra snapshot, restore protetto, export piu completo e UI piu coerente.

## Novità principali in buildER 6.2

- Versioning locale dei progetti `.ersp` con cronologia commit, snapshot completi, HEAD e stato working copy.
- Nuovo pannello Versioni progetto con commit inline, suggerimenti di messaggio, stato clean/dirty e badge HEAD.
- Diff strutturato tra versioni per schema ER, layout, modello logico, codice ERS e stato workspace.
- Restore protetto delle versioni con backup automatico dello stato corrente prima del ripristino.
- Confronto visuale full-screen tra snapshot con due workspace affiancati in sola lettura.
- Evidenziazioni visuali per elementi aggiunti, rimossi, modificati e cambiamenti di layout nelle viste ER e logica.
- Gestione dei casi in cui una snapshot non contiene ancora vista Traduzione o schema logico salvati.
- Export dello schema relazionale con azioni dedicate di copia e download nella vista logica.
- Menu export flottante con formati PNG, JPEG, SVG, ERS, progetto e schema relazionale.
- Rendering dello schema relazionale migliorato per lettura, export e integrazione con il dock tecnico.
- Export e stampa piu coerenti tra viste ER e logiche, con formati aggiuntivi e stili dedicati.
- Border radius standardizzato su modali, pannelli, toolbar e card per una UI piu uniforme.

## Funzionalità principali

- Modellazione ER in stile Chen: entità, entità deboli, relazioni, attributi, attributi composti, testo libero e gerarchie ISA.
- Canvas SVG con drag-and-drop, snap to grid, zoom, pan, selezione multipla, duplicazione e allineamento.
- Undo/redo, validazioni, cardinalità, vincoli ISA e controlli sugli identificatori.
- Salvataggio/caricamento progetto `.ersp`.
- Export PNG/SVG/JPEG con crop stretto del contenuto e sfondi coerenti per raster e vettoriale.
- Sorgente ERS con sincronizzazione live.
- Reverse engineering SQL con preview logica e preview ER.
- UI responsive per desktop, tablet e telefono.
- Localizzazione in italiano, inglese e albanese.

## Requisiti

- Node.js 20 LTS consigliato.
- npm 10 o superiore consigliato.
- Git.

## Avvio locale

```bash
npm install
npm run dev
```

## Build e test

```bash
npm run build
npm test
npm run test:e2e
npm run preview
```

## Struttura del repository

```txt
buildER/
  docs/                    Documentazione tecnica e guide operative
  src/                     Codice sorgente React + TypeScript
  test/                    Test unitari e di integrazione
  tests/e2e/               Test end-to-end Playwright
  index.html               Entry HTML Vite
  package.json             Script npm e dipendenze
  playwright.config.ts     Configurazione Playwright
  tsconfig*.json           Configurazione TypeScript
  vite.config.ts           Configurazione Vite
```

Per la struttura dettagliata vedere `docs/REPOSITORY_STRUCTURE.md`.

## Documentazione utile

- `docs/ARCHITECTURE.md` — panoramica tecnica dei moduli e del flusso dati.
- `docs/DEVELOPMENT.md` — setup, branch, commit, checklist PR e regole operative.
- `docs/REPOSITORY_STRUCTURE.md` — dove mettere nuove feature, test, utility e documentazione.
- `docs/CODEX_UI_STYLE_GUIDE.md` — guida stile UI da seguire per Cursor/Codex e refactor grafici.
- `docs/reverse-engineering-sql.md` — note tecniche sul reverse engineering SQL.
- `docs/sql-reverse-attribute-layout.md` — note sul layout attributi da reverse SQL.

## Regole di repository hygiene

- Non committare output generati: `dist/`, `coverage/`, `playwright-report/`, `*.tsbuildinfo`.
- Tenere la logica di dominio in `src/utils` e i tipi condivisi in `src/types`.
- Evitare CSS locale duplicato quando esistono token o componenti condivisi.
- Aggiornare test e documentazione quando una modifica tocca parser, layout, serializzazione, UI o flussi utente.
- Aprire branch piccoli e focalizzati partendo da `main`.
