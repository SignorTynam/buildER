# SQL Playground locale

## Obiettivo

SQL Playground trasforma il modello logico dello schema attivo in un database SQLite reale, eseguito interamente nel browser. L'utente può lanciare query e script, leggere result set e riepiloghi DML, verificare i vincoli e scaricare il database come file `.sqlite` senza backend o credenziali.

## Flusso

```txt
Schema attivo
  → generateLogicalSql({ dialect: "sqlite", quoteIdentifiers: true })
  → checksum deterministico
  → creazione atomica nel worker
  → query e risultati
  → export dei byte SQLite
```

Il Playground si apre dal pulsante `Prova SQL` della vista SQL logica, dal
comando `Apri SQL Playground` o dall'azione `Apri nel Playground` disponibile
nella toolbar di un file `.sql`. La tab tecnica usa la shell esistente, è
chiudibile e non viene serializzata nel progetto.

### File `.sql` del workspace

I file `.sql` usano `CodeEditorSurface` direttamente sul contenuto canonico del
file: gutter, highlighting, selezione, focus, stato dirty e salvataggio non
introducono una seconda bozza locale. L'azione contestuale trasferisce il
contenuto in memoria corrente, incluse le modifiche non ancora salvate, in una
sessione Playground dedicata.

Se il file contiene `CREATE TABLE`, la pipeline Reverse esistente converte le
tabelle e i vincoli in SQL SQLite e il database viene creato direttamente da
quel DDL. `CREATE DATABASE`, `USE` e `ATTACH ... AS` servono a ricavare il nome
ma vengono esclusi dallo schema eseguito perché non sono istruzioni valide per
il database SQLite in memoria. Per un file di sole query resta attiva la
risoluzione deterministica dello schema ER: sessione Playground attiva, ultimo
schema valido, quindi unico schema del progetto. Se non esiste un contesto
univoco, l'operazione resta sul file sorgente e chiede di aprire esplicitamente
lo schema; non viene mai scelto il primo elemento di un oggetto.

La query viene salvata nel `SqlPlaygroundManager` prima di aprire la tab. In
questo modo resta disponibile anche quando il Playground è temporaneamente
bloccato da un modello logico mancante o non aggiornato. L'azione contestuale
ricrea subito il database SQLite dal DDL del file oppure, per file di query,
dallo schema logico risolto. Mantiene `execute: false`, quindi il contenuto del
file resta pronto nell'editor senza essere eseguito automaticamente. Il nome
viene letto da `CREATE DATABASE`,
`USE`, `ATTACH ... AS` o da un oggetto qualificato; se il SQL non dichiara un
database, viene richiesto all'utente. Richiamare l'azione riusa la stessa tab
tecnica ma crea nuovamente il database, eliminando i dati temporanei precedenti.

## Architettura

- `SqlPlaygroundWorkspace` e i componenti affini rendono command bar, editor condiviso, splitter, stati, errori e risultati.
- `useSqlPlayground` collega il rendering allo stato temporaneo della sessione.
- `SqlPlaygroundManager` crea il worker solo al primo utilizzo, instrada richieste tipizzate, conserva sessioni separate e pubblica eventi con unsubscribe esplicito.
- `sqlPlaygroundProtocol.ts` definisce richieste e risposte discriminate senza payload `any`.
- `sqlite.worker.ts` inizializza SQLite, possiede i database, prepara/finalizza gli statement, misura le versioni schema, esegue l'introspezione, esporta i byte e chiude le risorse.
- `SqlExplorerPanel`, `SqlExplorerTree` e `useSqlExplorer` presentano metadata reali senza eseguire SQLite nel main thread.
- `sqlExplorerIntrospection.ts` concentra query parametrizzate, quoting degli identificatori e cleanup degli statement.
- `src/utils/sqlPlayground.ts` contiene checksum, formattazione valori, limiti e download testabili senza React.

## Worker e SQLite WASM

La dipendenza runtime è `@sqlite.org/sqlite-wasm`, distribuzione ufficiale SQLite. Il modulo OO1 viene inizializzato dentro un Web Worker di tipo module. `sqlite3.wasm` è importato come asset Vite (`?url`), quindi worker e WASM ricevono nomi hashed e rispettano il base path della build.

Non sono richiesti `SharedArrayBuffer`, isolamento cross-origin, OPFS o header server speciali. I database generati usano `:memory:`; i file importati vengono deserializzati in memoria in sessioni separate dal Database Workspace.

## Creazione e ricreazione

Prima dello schema il worker esegue `PRAGMA foreign_keys = ON`. La creazione è atomica: lo schema viene applicato a una nuova istanza temporanea; il database precedente viene sostituito soltanto se tutte le istruzioni riescono. In caso di errore l'istanza temporanea viene chiusa e quella precedente rimane disponibile.

La sessione conserva il checksum dello schema usato. Se il SQL generato cambia, l'interfaccia mostra `Database da aggiornare` senza cancellare i dati. Se sono state eseguite modifiche, la ricreazione richiede conferma.

## Sessioni e privacy

Le sessioni generate usano `projectId:schemaFileId`; quelle importate usano `imported:<uuid>`. Query, risultati e database non si sovrascrivono. Chiudere o sostituire il progetto dispone solo le sessioni generate interessate; il worker termina quando viene disposto esplicitamente.

Tutto resta locale al browser. Dati e query non vengono inviati a servizi esterni, inclusi GitHub o servizi analytics, e non vengono aggiunti al file `.ersp`. Un reload perde la sessione salvo export manuale.

## Query e risultati

`Ctrl+Invio` o `Cmd+Invio` esegue la selezione, se presente, altrimenti l'intero editor. Gli script vengono letti con `sqlite3_complete`, non con uno split sui punti e virgola. Ogni statement viene finalizzato anche in caso di errore.

I result set rimangono separati e sono limitati a 500 righe visualizzate. `NULL`, stringhe vuote e BLOB hanno rappresentazioni distinte; i valori lunghi conservano il valore completo nel titolo accessibile. INSERT, UPDATE, DELETE e DDL mostrano modifiche, ultimo row id quando disponibile e durata approssimativa.

L'editor riusa `CodeEditorSurface`: numeri di riga, scroll sincronizzato, Tab, auto-pairing e highlighting SQL restano condivisi con gli altri editor. Il comando `Esegui` della command bar e `Ctrl/Cmd+Invio` chiamano la stessa funzione selezione-o-documento.

Il pannello Risultati usa uno splitter orizzontale con pointer capture e controllo da tastiera (`ArrowUp/ArrowDown`, con Shift per passi maggiori). Può essere chiuso lasciando una barra di riapertura; altezza e stato collapsed sopravvivono alla chiusura della tab nella sessione corrente, ma non vengono serializzati. Le tabelle mantengono semantica HTML e aggiungono row header numerati da 1.

## Generazione dati deterministica

L'azione **Genera dati** è disponibile nella command bar soltanto per una
sessione `generated-schema` con database pronto e schema aggiornato. La V1 usa
due parametri temporanei, non serializzati nel progetto:

- **Righe per tabella**, da 1 a 100, con valore iniziale 20;
- **Seed**, intero unsigned a 32 bit, con valore iniziale 42.

A parità di schema SQLite reale, seed e numero di righe, il planner produce lo
stesso ordine, gli stessi valori, lo stesso `planId` e la stessa anteprima SQL.
Il generatore non usa `Math.random()` né dati esterni: deriva sottoseed stabili
da tabella, colonna, riga e scopo, e crea soltanto valori fittizi (le email
usano `example.test`).

### Planner e vincoli

Il worker legge `main` con la stessa introspezione di SQL Explorer, esclude
view, tabelle virtuali, oggetti `sqlite_*` e database attached, quindi passa i
metadata a un planner TypeScript puro. La normalizzazione ordina esplicitamente
tabelle, colonne, PK, indici, FK e componenti delle FK composite. Le FK con
target omesso vengono risolte contro la PK parent ordinata, attraverso la stessa
utility pura usata dal reverse metadata adapter. Una FK composita è valida
soltanto se le sue colonne target coincidono con l'intera PRIMARY KEY o con
un'intera UNIQUE del parent: il confronto avviene sull'insieme completo, perché
SQL consente di elencare le colonne della chiave parent in un ordine diverso da
quello dichiarato. Un sottoinsieme, un sovrainsieme o una colonna non chiave
restano rifiutati; l'accoppiamento child→parent resta quello dei mappings e non
viene mai riordinato.

Il piano pre-genera i pool di PK e UNIQUE referenziabili, assegna tuple FK
complete provenienti dalla stessa riga parent e usa enumerazione mixed-radix
per combinazioni molti-a-molti. La risoluzione dei valori FK segue lo stesso
ordine topologico degli INSERT, quindi un parent è sempre completo prima dei
suoi figli: con identificatori esterni/misti annidati una componente della
chiave del parent è a sua volta una colonna FK, e copiarla in anticipo
produrrebbe tuple che il parent sovrascrive. FK univoche non riutilizzano la
stessa tuple.
Self-reference e componenti cicliche vengono riconosciute con SCC
deterministiche; per i cicli il batch abilita `defer_foreign_keys` senza mai
disabilitare `foreign_keys`. Le affinity seguono le regole SQLite per INTEGER,
TEXT, BLOB, REAL e NUMERIC, con euristiche leggibili per nomi, email, date,
datetime, boolean, importi, JSON e BLOB.

Le colonne generated/hidden non entrano negli INSERT. Un default non coinvolto
in PK, UNIQUE o FK viene omesso e lasciato a SQLite. Tabelle senza PK restano
senza PK e possono essere popolate. Un indice UNIQUE partial o a espressione,
una chiave generated non calcolabile o una FK irrisolvibile blocca il piano con
un errore esplicito. CHECK e trigger non vengono disabilitati o interpretati:
SQLite resta l'autorità finale e un loro rifiuto provoca rollback.

### Preview, apply e sicurezza dei dati

La pianificazione restituisce al main thread soltanto riepilogo, warning,
anteprima e `planId`; le righe strutturate restano nella cache del worker.
L'anteprima quota sempre gli identificatori, esegue escaping delle stringhe e
mostra correttamente `NULL`, numeri e literal BLOB. È una rappresentazione
didattica del piano, non viene riparsata durante l'apply.

L'apply usa gli stessi valori tramite prepared statement (`prepare`, `bind`,
`step`, `reset`, `finalize`) in un unico batch:

```text
PRAGMA foreign_keys = ON
  → BEGIN IMMEDIATE
  → ricontrollo schema e row count
  → PRAGMA defer_foreign_keys = ON (solo per cicli)
  → INSERT del piano
  → PRAGMA foreign_key_check
  → COMMIT oppure ROLLBACK
```

Il piano conserva firma schema e conteggi iniziali. Un DDL rende stale la firma;
un DML tra preview e apply viene rilevato dai conteggi anche se la firma schema
non cambia. Nuova pianificazione, query mutativa, recreate/reset, chiusura della
sessione e dispose invalidano il piano. Dopo il successo i risultati precedenti
vengono rimossi e `hasUserDataChanges` diventa `true`, senza modificare editor,
file `.ersp`, `.erschema` o `.ers`.

La V1 non esegue append o merge. Se una tabella contiene dati, il dialog mostra
una conferma integrata (nessuna modal annidata): **Annulla** preserva il database;
**Ricrea database e genera dati** riusa la ricreazione atomica esistente e poi
pianifica/applica il nuovo dataset. L'export successivo include i dati generati.

### Scope e limiti V1

Restano esclusi popolamento di database importati, quantità per singola tabella,
selezione parziale, data grid/CRUD, parser generale di CHECK, UNIQUE partial o a
espressione, OPFS, backend, AI, servizi cloud e dataset esterni. Il dialog usa
scroll interno e preview SQL separatamente scrollabile sui viewport desktop,
tablet e mobile; label, errori associati, focus trap/return, Escape e live region
derivano dai componenti UI condivisi.

## SQL Explorer

L'attività `SQL Explorer`, immediatamente prima di Export, rappresenta il database effettivo della sessione. Mostra `main` e database collegati con `ATTACH`, tabelle, colonne, viste, indici, trigger e foreign key; gli oggetti `sqlite_*` restano nascosti. Tipi, posizione PK, nullability, default, unique e azioni referenziali derivano dalle PRAGMA SQLite, non dal modello logico.

Il worker espone `inspect-schema` e legge `PRAGMA database_list`, `<database>.sqlite_schema`, `pragma_table_info`, `pragma_foreign_key_list`, `pragma_index_list` e `pragma_index_info`. Gli argomenti supportati sono bindati e i nomi database sono quotati da un helper dedicato. Prima e dopo ogni script viene confrontata una firma delle `schema_version` di tutti i database: il manager emette `schema-changed` soltanto quando la struttura cambia. Il tree conserva selezione ed espansioni ancora valide durante il refresh e supporta il pattern ARIA tree con roving tabindex.

SQL Explorer gestisce assenza di progetto/schema/sessione/database, loading, errore e retry. Aprirlo o ridimensionare/nascondere i risultati non ricrea il database, non chiude il Playground e non modifica il dirty state.

Quando sono presenti più sessioni, un selettore distingue database generati e importati. Le azioni sugli oggetti possono aprire/eseguire SELECT nella sessione corretta, mostrare la definizione, copiare il nome o avviare il reverse da metadata.

## Export `.sqlite`

Il manager richiede al worker i byte serializzati, crea un Blob `application/vnd.sqlite3`, avvia il download con un nome derivato dallo schema e revoca sempre l'Object URL. L'export non modifica il dirty state del progetto.

## GitHub Pages

Per verificare la pubblicazione sotto repository path:

```bash
npm run build -- --base=/buildER/
```

In `dist` devono essere presenti il worker e il file `.wasm`; i riferimenti devono iniziare con `/buildER/assets/` e non devono contenere URL CDN. SQLite resta fuori dal chunk principale e viene richiesto solo aprendo il Playground.

## Test

- `test/sql-playground.test.ts`: checksum, valori, limiti, errori, export, risoluzione deterministica dello schema e SQL SQLite reale.
- `test/sql-data-population.test.ts`: affinity, PRNG, SCC, PK/UNIQUE/FK, cicli, generated/default, preview, stale protection, rollback e equivalenza su SQLite WASM reale.
- `test/sql-playground-components.test.tsx`: command bar, editor condiviso, risultati, row header e collapsed state.
- `test/sql-explorer.test.ts`: introspezione SQLite reale, database collegati, metadata e firme schema.
- `test/sql-explorer-components.test.tsx`: empty state, splitter e tree ARIA.
- `tests/e2e/sql-playground.spec.ts`: worker/WASM reale, splitter, collapse, SQL Explorer, refresh DDL, responsive e Axe.
- Il percorso E2E di population copre configurazione 20/42, preview, apply, COUNT/JOIN, determinismo, conferma recreate, export, cinque viewport e Axe sul dialog.
- `tests/e2e/sql-file-workflow.spec.ts`: file SQL dedicato, passaggio senza esecuzione, riuso sessione, ambiguità schema, Reverse contestuale, stati pannello e viewport stretti.

## Troubleshooting

- **Errore di inizializzazione:** verificare nella build la presenza di `sqlite3-*.wasm` e del chunk worker.
- **Errore nello schema:** controllare il dettaglio SQLite e l'indice dell'istruzione; il database precedente non viene distrutto.
- **Database da aggiornare:** ricreare esplicitamente dopo aver esportato eventuali dati utili.
- **Query con troppe righe:** il database esegue la query, ma la UI mostra solo le prime 500 righe per proteggere il browser.
- **Database non vuoto:** annullare per conservare i dati o confermare la ricreazione; la V1 non aggiunge righe a dataset esistenti.
- **Piano o schema stale:** chiudere l'errore e generare una nuova anteprima dopo la modifica DML/DDL.
- **Vincolo non supportato:** controllare i dettagli per UNIQUE partial/a espressione, chiavi generated o target FK irrisolti; lo schema non viene modificato.
- **CHECK o trigger rifiutato:** l'intero batch viene annullato; adeguare lo schema o inserire manualmente dati compatibili.

## Limiti deliberati

L'import `.sqlite` è gestito dal Database Workspace documentato separatamente e non espone **Genera dati**. Restano fuori scope backend, cloud sync, OPFS obbligatorio, collaborazione, AI, explain plan grafico e persistenza automatica.
