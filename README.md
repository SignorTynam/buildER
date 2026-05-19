# Chen ER Diagram Studio (v4.3)

Editor web React + TypeScript per modellare diagrammi ER in stile Chen con canvas SVG, toolbar laterale, undo/redo, project file `.ersp`, export PNG/SVG e sincronizzazione ERS live.

## Novita 4.3

- Versione aggiornata a `4.3`.
- Ruoli per associazioni ad anello: gestione da toolbar e validazioni per ruoli distinti.
- Avvisi per relazioni n-arie con cardinalita massima 1.
- Traduzione generalizzazioni: collapse-up con attributo Type e substitution con relazioni IS.
- Identificatori esterni: layout importati/misti piu stabile, grouping path e marker locali coerenti.
- Geometria connector migliorata per collegamenti multipli/loop e label role separate.
- ERS e file progetto: persistenza dei ruoli sui connector ricorsivi.

## Novita 4.2

- Versione aggiornata a `4.2`.
- Nuovo sistema modale Studio per menu comandi, scorciatoie, changelog e schermata informazioni.
- Vista Translation/Restructuring rifinita in stile designER: toolbar compatta, titolo `RESTRUCTURING`, Notes, selezioni rosse coerenti e generalizzazioni piu leggibili.
- Vista SQL/Schema aggiornata in stile designER: titolo `SCHEMA`, Show separato, toolbar normale/modifica, tabelle relazionali pulite, PK/FK sottolineate e frecce tra tabelle.
- Rimosso il pannello legacy `Tipo SQL colonna`; il comando Type ora usa un menu compatto dalla toolbar schema.
- Persistenza dello schema logico corretta: rename, ordine colonne e tipi SQL restano salvati anche tornando alla vista ER.
- Generalizzazioni ISA migliorate con gruppi dedicati, cleanup, serializzazione coerente, validazioni e layout triangolo/bus piu stabile.
- Canvas e toolbar rifiniti con placement preview, cardinalita, azioni contestuali e meno UI ridondante.
- Vista Logica estesa con bulk fix, gestione stage Translation/Schema, layout schema piu leggibile e highlighting SQL per entita/relazioni.
- Test di regressione estesi su ERS, generalizzazioni, workflow logico, schema SQL e salvataggio progetto.

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
