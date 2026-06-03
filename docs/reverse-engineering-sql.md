# Reverse Engineering SQL

## Scopo

La feature Reverse Engineering SQL importa uno schema SQL testuale e produce un modello intermedio tipizzato. Il flusso attuale copre anche la conversione verso modello logico e diagramma ER, ma il parser rimane volutamente leggero e senza dipendenze esterne.

## Come usarla

Aprire il pannello SQL Reverse Engineering, incollare uno schema con istruzioni `CREATE TABLE` e avviare l'importazione. Il risultato viene validato in tre passaggi: parsing SQL, modello logico e diagramma ER.

Per test o integrazioni di codice si possono usare direttamente:

```ts
import { parseSqlSchema } from "../src/utils/sqlReverseParser";
import { reverseSqlToLogicalModel } from "../src/utils/sqlReverseLogical";
import { reverseSqlToDiagram } from "../src/utils/sqlReverseDiagram";
```

## Costrutti supportati

- `CREATE TABLE` con identificatori semplici, doppi apici, backtick e parentesi quadre.
- Nomi tabella qualificati con schema.
- Colonne con tipi comuni, inclusi tipi parametrizzati come `VARCHAR(255)` e `NUMERIC(10, 2)`.
- `PRIMARY KEY` inline e table-level, anche composta.
- `FOREIGN KEY` inline e table-level, anche composta.
- `UNIQUE` inline e table-level, inclusi vincoli nominati.
- `CHECK` come metadato intermedio.
- `NOT NULL`, `NULL`, `DEFAULT`, `AUTO_INCREMENT` e identity semplici.
- Commenti SQL `-- ...` e `/* ... */`.

## Costrutti parzialmente supportati o segnalati come warning

- `CREATE INDEX`, `ALTER TABLE`, `CREATE VIEW`, `CREATE TRIGGER`, `INSERT`, `UPDATE`, `DELETE` e `DROP` vengono preservati come statement non supportati quando l'opzione lo consente.
- Opzioni di tabella specifiche del dialetto, per esempio `ENGINE=InnoDB`, possono produrre warning.
- Vincoli non riconosciuti vengono registrati come unsupported constraint.
- Riferimenti FK non risolti vengono segnalati.

## Regole di conversione ER

- Ogni tabella ordinaria diventa una entita.
- Le colonne visibili diventano attributi dell'entita o della relazione.
- Le primary key diventano identificatori interni; le primary key composte marcano i relativi attributi come identificatore composto.
- Le foreign key diventano relazioni binarie.
- FK `NOT NULL` produce cardinalita `(1,1)` sul lato sorgente; FK nullable produce `(0,1)`.
- FK unica produce cardinalita `(0,1)` sul lato target; altrimenti il target usa `(0,N)`.
- Tabelle associative con PK composta composta da almeno due FK possono diventare relazioni molti-a-molti.

## Limitazioni note

- Il parser non e un parser SQL completo e non mira a coprire tutta la grammatica dei singoli database.
- Indici, viste, trigger, DDL incrementale e DML non vengono convertiti in modello ER.
- Espressioni complesse in default o check vengono conservate come testo normalizzato, non valutate.
- Le regole di inferenza molti-a-molti sono intenzionalmente conservative.
- La conversione non risolve ancora strategie avanzate come inheritance relazionale, partizionamento, viste materializzate o constraint deferrable.
