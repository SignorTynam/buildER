# Chen ER Diagram Studio (v4.5)

Editor web React + TypeScript per modellare diagrammi ER in stile Chen con canvas SVG, toolbar laterale, undo/redo, project file `.ersp`, export PNG/SVG e sincronizzazione ERS live.

## Novita 4.5

- Versione aggiornata a `4.5`.
- Sintassi ERS canonica `identifier(...)` per identificatori interni, composti, alternativi ed esterni/misti, con compatibilita in lettura per la sintassi legacy.
- Identificatori esterni/misti migliorati: supporto a piu chiavi alternative sulla stessa relazione e layout a corsie per evitare sovrapposizioni.
- Cardinalita ER con collision avoidance automatica rispetto ad attributi, nodi, marker e altre label.
- Attributi composti ridisegnati come capsule/ovali con sotto-attributi esterni collegati.
- Vista Logica: nomi colonna PK sottolineati e scelta manuale della candidate key durante `FIX ENTITIES`.
- Modal di scelta PK paginato con preview logica coerente, FK risultanti e alternative UNIQUE NOT NULL.

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
