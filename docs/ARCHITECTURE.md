# Architettura buildER

buildER è un editor web React + TypeScript per diagrammi ER in stile Chen. L'app è organizzata come applicazione single-page Vite, con logica di dominio centralizzata in moduli TypeScript testabili.

## Livelli principali

```txt
Browser
  ↓
React app shell
  ↓
Workspace ER / Translation / Logical
  ↓
Canvas SVG, pannelli, modali, toolbar
  ↓
Utility pure: parser, serializzazione, validazione, layout, export
  ↓
Tipi condivisi del dominio ER e modello logico
```

## Responsabilità dei moduli

### `src/main.tsx`

Bootstrap React, import degli stili globali e montaggio dell'app.

### `src/App.tsx`

Orchestratore principale: stato del documento, view mode, modali, comandi utente, sincronizzazione ERS, undo/redo e passaggio delle props ai workspace. È una parte critica: ogni refactor va fatto in modo incrementale e coperto da test.

### `src/canvas`

Rendering e interazione del diagramma ER su SVG. Qui devono rimanere le responsabilità strettamente legate a nodi, edge, selezione, pointer events, zoom/pan e geometria visuale del canvas.

### `src/components`

Componenti UI condivisi e componenti applicativi: header, pannelli, modali, loading screen, command menu, preview SQL Reverse, changelog e componenti visuali riutilizzabili.

### `src/inspector`

Pannelli e sezioni per modificare proprietà degli elementi ER, inclusi identificatori interni, esterni e misti.

### `src/toolbar`

Strumenti di inserimento, selezione e azioni rapide del canvas.

### `src/translation` e `src/logical`

Workspace dedicati alla trasformazione dal modello ER al modello logico e alla visualizzazione/gestione della traduzione.

### `src/features/sql-playground`

Feature verticale del Playground SQLite. I componenti React delegano stato e ciclo di vita a un manager osservabile per sessione; un Web Worker dedicato possiede il modulo WASM e tutte le istanze database. Il protocollo discriminato main thread/worker, la creazione atomica dello schema, l'introspezione e l'export restano separati dalla UI. SQLite viene caricato soltanto alla prima apertura del Playground e non entra nel bundle iniziale dell'editor.

`CodeEditorSurface` fornisce gutter, highlighting e selezione tramite un handle tipizzato riusabile. Altezza e stato collapsed dei risultati vivono esclusivamente nello stato temporaneo della sessione. SQL Explorer interroga `database_list`, `sqlite_schema` e le table-valued PRAGMA nel worker; confronta le versioni schema prima e dopo ogni script e aggiorna il tree soltanto quando la struttura cambia. I metadata, l'espansione del tree e il layout del pannello non entrano nella serializzazione `.ersp` e non influenzano Source Control.

La generazione dati segue un protocollo worker in due fasi. `plan-population`
normalizza i metadata SQLite reali e costruisce un piano puro, deterministico e
constraint-aware; il worker conserva le righe strutturate e restituisce soltanto
`planId`, riepilogo, warning e preview. `apply-population` ricontrolla firma schema
e row count, quindi applica lo stesso piano con prepared statement dentro
`BEGIN IMMEDIATE`, enforcement FK sempre attivo, deferred FK per le SCC cicliche,
`foreign_key_check` e rollback totale. Il main thread non importa SQLite WASM e
React orchestra soltanto configurazione, preview, conferma e feedback.

### `src/features/database-workspace`

Feature verticale per file SQLite importati. Validazione preliminare e nomi download sono pure utility; header/workspace/hook rendono la sessione importata; il wizard `reverse` adatta metadata SQLite reali a `SqlSchemaModel` e riusa la pipeline logica/ER. Worker e manager rimangono condivisi con il Playground, ma la source discriminata impedisce che il lifecycle progetto chiuda database importati indipendenti.

I byte originali restano solo nel worker e non sono serializzati. Apertura e restore sono atomici: una sessione viene pubblicata o sostituita solo dopo deserializzazione, controllo integrità e introspezione riusciti.

### `src/i18n`

Messaggi localizzati, hook e layer di traduzione. Le nuove stringhe UI non devono essere hardcoded dentro i componenti quando sono visibili all'utente.

### `src/types`

Contratti TypeScript condivisi. Le modifiche qui vanno considerate con attenzione perché impattano serializzazione, validazione e test.

### `src/utils`

Logica pura e testabile: diagrammi, ERS, parser SQL, layout automatici, routing edge, export, clipboard, versioning e trasformazioni logiche. Le funzioni nuove devono preferibilmente essere deterministiche e senza dipendenze dirette da React.

## Principi architetturali

1. **Dominio prima della UI**: la logica di validazione, parsing, layout e trasformazione deve stare in `src/utils`, non nei componenti.
2. **Tipi condivisi stabili**: `src/types` definisce il vocabolario dell'app; evitare duplicazioni locali di shape simili.
3. **Refactor incrementale**: non spostare grandi blocchi senza test di regressione.
4. **Compatibilità dei file progetto**: `.ersp`, ERS e versioning devono restare compatibili quando possibile.
5. **UI coerente**: ogni superficie deve rispettare la guida stile in `docs/CODEX_UI_STYLE_GUIDE.md`.
6. **Test sulle aree fragili**: parser SQL, layout attributi, edge/cardinalità, identificatori e traduzione logica richiedono test mirati.

## Flusso dati semplificato

```txt
Azione utente
  → comando React / handler App
  → update del documento ER o modello logico
  → validazione/sincronizzazione in utils
  → aggiornamento stato
  → rendering canvas/pannelli
  → eventuale serializzazione ERS o salvataggio .ersp
```

## Progetti multi-file

Dal formato progetto versione 6, `.ersp` rappresenta un intero progetto buildER: file tree, cartelle, file schema e stato Explorer. Lo schema aperto resta sincronizzato con lo stato workspace esistente di `App.tsx`, ma al salvataggio viene scritto dentro `files[activeFileId]`.

- `.ersp`: progetto completo multi-file.
- `.erschema`: singolo schema con diagramma ER, traduzione, logico, view state, workspace state e versioning opzionale.
- `.ers`: codice ERS testuale, invariato.

I vecchi `.ersp` single-schema e i diagrammi JSON legacy vengono convertiti in un progetto con root folder e un file schema iniziale.

## Aree ad alto rischio

| Area | Rischio | Mitigazione |
| --- | --- | --- |
| Layout attributi | Sovrapposizioni, distanza eccessiva, spostamenti non deterministici | Test su casi progressivi e reverse SQL |
| Connector e cardinalità | Edge deformabili o label sovrapposte | Test di routing e cardinality flow |
| ERS / `.ersp` | Rottura compatibilità progetto | Test parser/serializer/versioning |
| SQL Reverse | Entità/relazioni/attributi errati | Test parser, modello logico e diagramma |
| SQL Playground / Database Workspace | Worker orfani, file corrotti, schema parziale, confusione tra sessioni | Source discriminate, validazione a due livelli, sostituzione atomica, cleanup esplicito ed E2E WASM |
| i18n | Fallback italiani in EN/SQ | Test dizionari e chiavi mancanti |
