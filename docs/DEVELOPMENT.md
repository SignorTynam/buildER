# Guida sviluppo buildER

Questa guida descrive il flusso minimo da seguire per modifiche pulite e verificabili.

## Requisiti

- Node.js 20 LTS consigliato.
- npm 10 o superiore consigliato.
- Git aggiornato.

## Setup locale

```bash
npm install
npm run dev
```

L'app viene avviata tramite Vite. La preview di produzione si prova con:

```bash
npm run build
npm run preview
```

## Comandi principali

```bash
npm run dev        # ambiente di sviluppo
npm run build      # typecheck TypeScript e build Vite
npm test           # test unitari e di integrazione configurati nel package
npm run test:e2e   # test end-to-end Playwright
```

## Branch e commit

Usa branch brevi in kebab-case:

```txt
feat/<nome-feature>
fix/<nome-bug>
refactor/<area>
docs/<argomento>
chore/<attivita>
```

Per i commit usa messaggi piccoli e leggibili, preferibilmente in stile Conventional Commits:

```txt
feat(canvas): add stable attribute placement
fix(edges): prevent relationship connector drag
chore(repo): ignore generated TypeScript build info
docs(readme): clarify development workflow
```

## Checklist prima di una PR

- [ ] La modifica è limitata a uno scope chiaro.
- [ ] `npm run build` passa localmente.
- [ ] `npm test` passa localmente.
- [ ] `npm run test:e2e` passa se la modifica tocca UI, layout, responsive o flussi utente.
- [ ] README, changelog o documentazione sono aggiornati quando necessario.
- [ ] Non sono stati committati file generati o cache locali.
- [ ] La PR contiene screenshot/GIF se modifica canvas, layout o UI.

## Regole per modifiche UI

La fonte di verità per lo stile visivo è `docs/CODEX_UI_STYLE_GUIDE.md`.

Prima di introdurre nuovi componenti o classi CSS, verifica se esistono già pattern condivisi come pannelli, card, tab, warning, stati vuoti, modali o token `--studio-*` / `--editor-*`.

## Regole per reverse engineering SQL e layout

Le modifiche a SQL Reverse, parser, layout automatici e attributi devono avere test di regressione. Le aree più sensibili sono:

- `src/utils/sqlReverseParser.ts`
- `src/utils/sqlReverseDiagram.ts`
- `src/utils/sqlReverseLayout.ts`
- `src/utils/sqlReverseAttributeLayout.ts`
- `src/utils/attributeLayout.ts`
- `src/utils/diagram.ts`
