# Chen ER Diagram Studio (v4.5.2)

Editor web React + TypeScript per modellare diagrammi ER in stile Chen con canvas SVG, toolbar laterale, undo/redo, project file `.ersp`, export PNG/SVG e sincronizzazione ERS live.

## Novita 4.5.2

- Versione aggiornata a `4.5.2`.
- Export PNG e SVG dalla toolbar e dal workspace di traduzione logica.
- Generazione SQL con supporto ai dialetti.
- Generalizzazioni migliorate: gruppi rifattorizzati con styling coerente, gerarchie compatibili/bloccanti, label discriminator aggiornate, normalizzazione nomi export e validazione identificatori.
- Canvas logico: view mode dedicato, completamento step basato su item aperti e trasformazione con contesto ER filtrato e visibilita migliorata.

## Requisiti

- Node.js 18+ consigliato
- npm 9+ (o package manager compatibile)

## Avvio locale

```bash
npm install
npm run dev
```

## Build produzione

```bash
npm run build
npm run preview
```

## Funzionalita principali

- Entita, entita deboli dedicate, relazioni, attributi, attributi composti con sotto-attributi, testo libero e gerarchie ISA.
- Drag-and-drop, snap to grid, zoom, pan, selezione multipla, duplicazione e allineamento.
- Undo/redo e validazioni per attributi, relazioni e link di ereditarieta con vincoli disjoint/overlap e total/partial.
- Modalita modifica e sola lettura.
- Salvataggio/caricamento progetto `.ersp`, export PNG/SVG e sorgente ERS con sincronizzazione live.
