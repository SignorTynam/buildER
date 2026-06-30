# Struttura del repository buildER

Questo documento definisce come mantenere ordinato il repository e dove collocare le nuove modifiche.

## Albero principale

```txt
buildER/
  .github/                 Template issue e pull request
  docs/                    Documentazione tecnica e guide per Codex/Cursor
  src/                     Codice sorgente dell'applicazione React + TypeScript
  test/                    Test unitari e di integrazione su logica, parser e layout
  tests/e2e/               Test end-to-end Playwright
  index.html               Entry HTML Vite
  package.json             Script npm e dipendenze
  playwright.config.ts     Configurazione E2E
  tsconfig*.json           Configurazione TypeScript
  vite.config.ts           Configurazione Vite
```

## Regole di posizionamento

| Area | Dove va | Cosa contiene |
| --- | --- | --- |
| UI condivisa | `src/components` | Header, modali, pannelli, componenti riutilizzabili |
| Explorer progetto | `src/components/project` | File Explorer, tree item e azioni progetto multi-file |
| Canvas ER | `src/canvas` | Rendering SVG, nodi, edge e interazioni del diagramma |
| Inspector | `src/inspector` | Sezioni di editing per entità, attributi e relazioni |
| Toolbar | `src/toolbar` | Strumenti e controlli del canvas |
| Traduzione logica | `src/logical`, `src/translation` | Workspace e flussi di trasformazione |
| Internazionalizzazione | `src/i18n` | Provider, hook, dizionari e chiavi testuali |
| Tipi condivisi | `src/types` | Tipi TypeScript di dominio e DTO interni |
| Logica pura | `src/utils` | Parser, serializzazione, layout, validazione, export |
| Asset | `src/image` | Logo, favicon e immagini statiche dell'app |
| Documentazione | `docs` | Architettura, stile UI, reverse engineering SQL, note operative |

## Regole operative

1. Non committare output generati: `dist/`, `coverage/`, `playwright-report/`, `*.tsbuildinfo`.
2. Non introdurre logica di dominio dentro componenti React quando può stare in `src/utils`.
3. Non aggiungere CSS locale isolato se esiste già un pattern o token condiviso.
4. Ogni nuova feature deve avere almeno una verifica: test unitario, test di integrazione, test E2E o checklist manuale documentata nella PR.
5. I file di compatibilità progetto `.ersp` e le funzioni di parsing/serializzazione vanno trattati come API interne stabili.

## Formati progetto

`src/utils/projectFile.ts` gestisce `.ersp` come progetto multi-file dalla versione 6. `src/utils/projectSchemaFile.ts` gestisce `.erschema` per esportare/importare un singolo schema. `src/utils/projectExplorer.ts` contiene la logica pura per file tree, nomi, cartelle, rename, delete e fallback dello schema attivo. Il formato `.ers` resta il sorgente testuale ERS esistente.

## Debito tecnico da gestire con calma

`src/App.tsx` resta il principale orchestratore dell'app. Per evitare refactor rischiosi, non va spezzato in modo massivo senza test. Le future estrazioni devono essere progressive, per esempio:

- stato e comandi del canvas in hook dedicati;
- gestione modali in hook dedicati;
- azioni di import/export in moduli separati;
- coordinamento delle viste in un layer `workspace`.
