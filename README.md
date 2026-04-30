# Chen ER Diagram Studio (v4.1)

Editor web React + TypeScript per modellare diagrammi ER in stile Chen con canvas SVG, toolbar laterale, undo/redo, project file `.ersp`, export PNG/SVG e sincronizzazione ERS live.

## Novita 4.1

- Versione aggiornata a `4.1`.
- Pannelli Review, Code e Notes ripuliti con empty state compatti e meno testo ridondante.
- Card di Traduzione e Schema logico rese piu leggibili: regola e descrizione breve, senza output e dettagli ingombranti.
- Toolbar canvas collassata migliorata: shortcut centrati, testo nascosto e nessuna invasione del canvas.
- Inspector e impostazioni shape nel pannello Canvas resi piu compatti e stabili su larghezze ridotte.
- Pannelli laterali Traduzione e Schema logico migliorati quando vengono nascosti: riapertura compatta senza pannello vuoto.

## Novita 4.0

- Versione aggiornata a `4.0`.
- Storico release preservato: i record precedenti restano nel changelog e nei metadata applicativi.
- Vista Logica ripristinata come workflow manuale e guidato, senza conversione completa automatica all'apertura della vista.
- Introdotto il nuovo `LogicalTranslationWorkspace` con step espliciti, gestione item pending e pannello conflitti/artefatti.
- Separazione delle responsabilita consolidata: gerarchie ISA e attributi composti restano nella Vista Traduzione, mentre la Vista Logica procede solo con decisioni di mapping manuali.
- Save/load e refresh del workspace logico riallineati: decisioni valide preservate e decisioni legacy incompatibili invalidate in modo sicuro.
- Test di regressione estesi per verificare workflow incrementale, compatibilita con stati precedenti e assenza di auto-conversione.

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
