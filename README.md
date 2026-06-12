# Chen ER Diagram Studio (v4.6.2)

Editor web React + TypeScript per modellare diagrammi ER in stile Chen con canvas SVG, toolbar laterale, undo/redo, project file `.ersp`, export PNG/SVG e sincronizzazione ERS live.

## Novita 4.6.2

- Versione aggiornata a `4.6.2`, con metadati package, schermata Versione e changelog allineati.
- Il pannello Code ora aggiorna il diagramma senza riposizionare i nodi gia presenti quando si modifica il testo ERS.
- Aggiunta memoria layout durante le modifiche da codice: se un nodo sparisce temporaneamente mentre si digita e poi ricompare, mantiene la sua geometria precedente.
- Merge ERS piu robusto per ID, alias, attributi collegati alla propria entita e rename, con preservazione dei metadati degli edge.
- Connector entita-relazione resi stabili: il tracciato non e piu trascinabile manualmente, mentre le cardinalita restano editabili.
- Offset manuali legacy dei connector ignorati e ripuliti, cosi i salvataggi vecchi non deformano le linee.
- Aggiunti test di regressione per layout da pannello Code, memoria layout e routing stabile dei connector.

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
