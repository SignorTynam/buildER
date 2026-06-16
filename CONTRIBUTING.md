# Contributing Guide

Grazie per voler contribuire a buildER.
Questo documento descrive il flusso consigliato per contribuire in modo chiaro e consistente.

## Prerequisiti

- Node.js 20 LTS o superiore
- npm 10 o superiore
- Git

## Setup Locale

1. Clona il repository.
2. Installa le dipendenze:

```bash
npm install
```

3. Avvia l'app in sviluppo:

```bash
npm run dev
```

4. Verifica la build prima di aprire una PR:

```bash
npm run build
```

5. (Opzionale) Avvia la preview della build:

```bash
npm run preview
```

## Branch Naming

Crea sempre i branch partendo da `main` aggiornata.
Usa nomi in kebab-case con prefisso per tipo:

- `feat/<breve-descrizione>`
- `fix/<breve-descrizione>`
- `chore/<breve-descrizione>`
- `docs/<breve-descrizione>`
- `refactor/<breve-descrizione>`

Esempi:

- `feat/add-logical-inspector-shortcuts`
- `fix/edge-selection-hitbox`

## Commit Message

Preferisci commit piccoli e atomici.
Formato consigliato (Conventional Commits):

- `feat(canvas): add snap-to-grid for nodes`
- `fix(inspector): preserve nullability on save`
- `docs(readme): clarify setup steps`

## Pull Request

Ogni PR dovrebbe:

1. Avere uno scope limitato (una modifica coerente).
2. Includere una descrizione chiara del problema e della soluzione.
3. Includere screenshot o GIF se modifica UI/UX.
4. Indicare eventuali breaking changes.
5. Passare la build locale (`npm run build`).
6. Aggiornare documentazione se necessario.

Checklist rapida PR:

- [ ] Branch aggiornato con `main`
- [ ] Codice review-ready
- [ ] Nessun warning/error bloccante in build
- [ ] Documentazione aggiornata

## Standard Di Codice

- Usa TypeScript in modo esplicito (evita `any` se non necessario).
- Mantieni componenti React piccoli e focalizzati.
- Sposta logica condivisa in `src/utils` o `src/hooks`.
- Mantieni nomi chiari per file, funzioni e tipi.
- Evita modifiche non correlate nella stessa PR.
- Preserva lo stile esistente del progetto.

## Struttura Del Progetto (Riferimento Rapido)

Per la struttura completa vedere `docs/REPOSITORY_STRUCTURE.md`.

- `src/components`: componenti UI
- `src/canvas`: rendering e interazioni canvas
- `src/inspector`: pannelli di ispezione
- `src/logical`: viste/logica del modello logico
- `src/utils`: funzioni di supporto e serializzazione
- `src/types`: tipi TypeScript condivisi

## Sicurezza

Per segnalazioni di sicurezza, segui le indicazioni in `SECURITY.md`.
Non aprire issue pubbliche per vulnerabilita sensibili.
