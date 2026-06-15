# SQL Reverse Attribute Layout

## Problema risolto

Durante il reverse engineering SQL verso diagramma ER, il layout finale degli attributi poteva risultare "esploso": attributi molto lontani dall'entità o dalla relazione proprietaria, linee di collegamento lunghe, distribuzione irregolare e scarsa leggibilità.

La causa principale era un doppio layout conflittuale:

1. `convertLogicalModelToDiagram` posizionava inizialmente gli attributi in modo compatto con `distributeAttributesAroundHost`.
2. `layoutSqlReverseDiagram` ricalcolava poi gli attributi con una logica basata su gap ampi (`attributeGapX` / `attributeGapY`) e anelli multipli, spingendo gli attributi lontano per evitare collisioni.

## Idea dell'algoritmo

Il modulo `src/utils/sqlReverseAttributeLayout.ts` implementa un layout dedicato al reverse engineering SQL. Per ogni owner (entità o relazione):

1. Raccoglie gli attributi collegati tramite edge `attribute`.
2. Li ordina in modo deterministico: PK/identifier prima, poi label e id.
3. Genera slot candidati intorno all'owner su quattro lati (`top`, `right`, `bottom`, `left`) con corone (`ring`) vicine.
4. Valuta ogni slot con uno scoring che privilegia compattezza e bilanciamento.
5. Sceglie la combinazione migliore con backtracking (fino a 10 attributi) o beam search deterministica (oltre 10 attributi).

## Candidate slots

Ogni slot candidato ha:

- `side`: lato dell'owner
- `ring`: distanza dal perimetro (0 = più vicino)
- `offset`: spostamento lungo il lato (ordine 0, -1, 1, -2, 2, ...)
- `marker`: punto di aggancio dell'attributo

I marker usano gap compatti (`markerGap` ~ 52 px, `ringGap` ~ 48 px) e spacing basato sulle dimensioni reali di label e nodi. Le coordinate finali passano da `placeAttributeMarker` e `snapValue`.

## Scoring

Punteggio più basso = slot migliore. Penalità principali:

- collisione con owner, entità, relazioni o attributi già piazzati: rigetto
- distanza dal perimetro owner oltre la fascia ideale
- `ring` > 0
- offset laterale elevato
- squilibrio tra i lati (penalità finale sulla combinazione)

Tie-breaker deterministico: side, ring, offsetIndex, offset.

## Garanzie

- **Determinismo**: stesso SQL produce le stesse coordinate; nessun random.
- **Compattezza**: distanza ideale dal perimetro owner circa 48–120 px; corone aggiuntive solo se necessario.
- **Collision avoidance**: bounds reali (marker + label) tramite `buildAttributeLayoutBounds`.
- **Contesto globale**: gli slot considerano entità, relazioni e attributi già piazzati nel diagramma.

## Limiti e fallback

- In scenari molto densi o con label molto lunghe, alcuni attributi possono usare `ring` > 0 o distanze maggiori, ma l'algoritmo evita tentacoli estremi quando esistono slot liberi vicini.
- Se beam search o backtracking non trovano combinazioni valide, un fallback greedy sceglie i migliori slot singoli disponibili.
- Il layout manuale/incrementale dell'editor non è modificato: `attributeLayout.ts` resta usato per aggiunta manuale; il nuovo modulo interviene solo nel flusso `layoutSqlReverseDiagram`.
