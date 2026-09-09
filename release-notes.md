# buildER v7.4.0

_2026-09-09_

buildER 7.4 aggiunge una terza strategia per gli attributi multivalore con cardinalità piccola e finita: li espande in attributi scalari sulla stessa entità, senza crearne di nuove. Migliora inoltre la fedeltà degli export raster e rende toolbar, overlay e controlli compatti più affidabili.

## Highlights

- **Espandi nell’entità** — Gli attributi semplici multivalore con massimo numerico fino a 10 diventano attributi scalari sulla stessa entità, conservando il minimo della cardinalità originale.
- **Controlli sempre raggiungibili** — La toolbar si dispone su riga mantenendo ogni comando accessibile, gli overlay flottanti non coprono più il contenuto e il selettore di vista compatto recupera etichette e target touch.
- **Export e stili coerenti** — I PNG conservano la trasparenza, i JPEG ricevono il fondo e le linee sotto le etichette di cardinalità vengono mascherate; font e select seguono un sistema visivo unico.

## Added

- Aggiunta la strategia di traduzione Espandi nell’entità per gli attributi semplici multivalore posseduti da un’entità: con massimo numerico finito fino a 10 genera un attributo scalare per ogni valore ammesso, è consigliata fino a 5, non crea nuove entità e preserva il minimo della cardinalità originale.

## Changed

- Unificata l’interfaccia delle cardinalità, esposti i bound normalizzati come utility condivisa, allineate alla type scale le dimensioni dei font fuori scala e adottata una skin comune per tutti i select.

## Fixed

- Corretti gli export raster con trasparenza PNG, fondo JPEG e mascheramento delle linee sotto le etichette di cardinalità, gli overlay flottanti sopra il contenuto, i tooltip inattivi che occupavano spazio nel layout e le etichette con i target touch del selettore di vista compatto.
