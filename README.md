<p align="center">
  <img src="src/image/buildER%20no%20background.png" alt="buildER logo" width="520" />
</p>

# buildER (v5.1)

Editor web React + TypeScript per modellare diagrammi ER in stile Chen con canvas SVG, toolbar laterale, undo/redo, project file `.ersp`, export PNG/SVG e sincronizzazione ERS live.

## Stato del progetto

buildER è la nuova evoluzione di ER Studio. La versione 5.x consolida rebrand, responsive/mobile, UI moderna, SQL Reverse e gestione più robusta degli identificatori interni, esterni e misti.

## Funzionalità principali

- Modellazione ER in stile Chen: entità, entità deboli, relazioni, attributi, attributi composti, testo libero e gerarchie ISA.
- Canvas SVG con drag-and-drop, snap to grid, zoom, pan, selezione multipla, duplicazione e allineamento.
- Undo/redo, validazioni, cardinalità, vincoli ISA e controlli sugli identificatori.
- Salvataggio/caricamento progetto `.ersp`.
- Export PNG/SVG.
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
