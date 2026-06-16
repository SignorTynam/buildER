# buildER (v5.1)

Editor web React + TypeScript per modellare diagrammi ER in stile Chen con canvas SVG, toolbar laterale, undo/redo, project file `.ersp`, export PNG/SVG e sincronizzazione ERS live.

## Fix 5.1

buildER 5.1 e un fix della 5.0: completa l'esperienza di avvio, allinea meglio la localizzazione e aggiorna gli asset dell'app senza introdurre un cambio di generazione.

- Versione aggiornata a `5.1`, con package, lockfile, metadati applicativi, changelog e README allineati.
- Aggiunta schermata di caricamento iniziale con logo buildER, messaggio localizzato e suggerimento.
- La loading screen rispetta la lingua salvata prima che l'editor sia pronto.
- Aggiunti asset brand completi: logo, varianti logo, favicon, Apple touch icon e web app manifest.
- Aggiornato il favicon usato da `index.html`.
- Rimosso il tutorial legacy della modalita Code.
- Localizzazione estesa per header, command menu, keyboard shortcuts, toolbar, modali, pannelli tecnici e SQL Reverse.
- Aggiunte chiavi i18n per errori strutturati, messaggi di connessione, canvas e scelta PK logica.
- Aggiunti test end-to-end per loading screen e cambio lingua IT/EN/SQ.
- Aggiunti template GitHub per issue/PR e Code of Conduct.

## Novita 5.0

buildER 5 e un upgrade maggiore rispetto alla 4.6.2. Non e una release di soli fix: introduce il nuovo nome dell'app e aggiorna esperienza responsive, UI, SQL Reverse, toolbox, modali, icone e gestione degli identificatori misti/esterni.

- Versione aggiornata a `5.0`, con package, lockfile, metadati applicativi, changelog e README allineati.
- Il programma cambia nome: da ER Studio a buildER.
- Strategia responsive completa per desktop largo, desktop stretto/tablet landscape, tablet portrait e telefono.
- Header mobile, quick actions, toolbox ER e HUD viewport riorganizzati per evitare collisioni e overflow.
- Toolbox ER riallineato allo stile delle viste Translation e Logical, con rail compatta e comandi contestuali mostrati solo quando servono.
- Quick actions ER unificate in Code, Reverse, Errors e Notes; Diagnostics e stato diagnostica sono integrati nel pannello Errors.
- Sistema icone centralizzato con `lucide-react` e `StudioIcon`, incluse icone custom per gli elementi ER.
- Menu comandi trasformato in command palette moderna con ricerca, categorie, icone, shortcut chip e layout mobile.
- Keyboard Shortcuts trasformato in shortcuts sheet moderna con ricerca, filtri e kbd chip compatti.
- SQL Reverse modal, preview logica, preview ER, footer azioni ed Errors modal modernizzati e resi coerenti con lo stile Studio.
- HUD viewport `Adatta`, `Centra` e `Reset` sempre visibile, moderno e non sovrapposto ai bottoni nelle preview.
- Identificatori esterni/misti aggiornati: lo stesso attributo locale puo partecipare a piu identificatori misti alternativi della stessa entita.
- Parsing/serializzazione ERS e traduzione logica preservano identificatori misti distinti anche se condividono un attributo locale.
- Aggiunti e aggiornati test di regressione per identificatori esterni, SQL Reverse, ERS, layout canvas e workflow logico.

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
