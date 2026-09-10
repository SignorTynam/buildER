# Struttura del repository buildER

Questo documento definisce dove collocare codice, documentazione e controlli
operativi. Le istruzioni dettagliate per gli agenti sono indicizzate da
[`docs/agents/INDEX.md`](agents/INDEX.md).

## Albero principale

```text
buildER/
  .github/                 Template Issue/PR e workflow
  config/                  Policy machine-readable del repository
  docs/                    Documentazione tecnica e operativa
    agents/                Regole canoniche condivise Codex/Claude
  scripts/                 Release tooling e validatori repository
  src/                     Applicazione React + TypeScript
  test/                    Test unitari e di integrazione
  tests/e2e/               Test end-to-end Playwright
  AGENTS.md                Entrypoint automatico Codex
  CLAUDE.md                Entrypoint automatico Claude Code
  package.json             Script npm e dipendenze
  playwright.config.ts     Configurazione E2E
  tsconfig*.json           Configurazione TypeScript
  vite.config.ts           Configurazione Vite
```

## Regole di posizionamento

| Area | Dove va | Cosa contiene |
| --- | --- | --- |
| UI condivisa | `src/components` | Header, modali, pannelli e componenti riutilizzabili |
| Explorer progetto | `src/components/project` | File tree e azioni progetto multi-file |
| Canvas ER | `src/canvas` | Rendering SVG, nodi, edge e interazioni |
| Inspector | `src/inspector` | Editing di entità, attributi e relazioni |
| Toolbar | `src/toolbar` | Strumenti e controlli del canvas |
| Traduzione | `src/translation`, `src/logical` | Trasformazioni concettuali, logiche e relazionali |
| Feature verticali | `src/features` | UI, orchestrazione e adapter isolati |
| Internazionalizzazione | `src/i18n` | Provider, hook e dizionari `it`, `en`, `sq` |
| Tipi condivisi | `src/types` | Tipi TypeScript di dominio e DTO interni |
| Logica pura | `src/utils` | Parser, serializzazione, layout, validazione, export |
| Catalogo release | `src/releases` | Definizioni e localizzazione delle release |
| Design token | `src/styles/tokens.css` | Fonte canonica di token visuali |
| Livello movimento | `src/styles/motion.css` | Entrate, transizioni di stato e contratto `prefers-reduced-motion` |
| Istruzioni agent | `docs/agents` | Indice e regole specialistiche condivise |
| Policy eseguibile | `config/repository-policy.json` | Branch, commit, viewport, lingue e SemVer |
| Script policy | `scripts/check-*.ts` | Validazione locale e CI |

## Formati progetto

`src/utils/projectFile.ts` gestisce `.ersp` come progetto multi-file e le
migrazioni legacy. `src/utils/projectSchemaFile.ts` gestisce `.erschema` per un
singolo schema. `src/utils/ers.ts` gestisce il sorgente `.ers`. Questi formati
sono API interne stabili e richiedono test di compatibilità e round-trip.

## Regole operative

1. Non committare `dist/`, coverage, report Playwright, risultati test,
   `*.tsbuildinfo`, log o file temporanei.
2. Tenere la logica di dominio fuori dai componenti quando può vivere in
   `src/utils`.
3. Riutilizzare token e pattern condivisi prima di aggiungere CSS locale.
4. Ogni feature o correzione deve avere una verifica proporzionata.
5. Non creare entrypoint agent annidati o policy concorrenti senza aggiornare
   l'indice e la policy machine-readable.
6. `src/App.tsx` resta un orchestratore ad alto rischio: le estrazioni devono
   essere progressive e coperte da test.
