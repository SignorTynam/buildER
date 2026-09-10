# buildER v7.5.0

_2026-09-10_

buildER 7.5 porta dati deterministici, multivalori dipendenti e un workspace più fluido.

## Highlights

- **Dati pronti per le query** — Genera righe ripetibili dallo schema SQLite e applicale in una transazione sicura per i vincoli.
- **Workspace più pulito** — Rimuove contesto duplicato e controlli Note per chiarire il file e il workspace attivi.
- **Multivalori dipendenti** — Crea un'entità dipendente che importa l'identificatore scelto del proprietario.

## Added

- Generazione deterministica di dati nel SQL Playground con seed, quantità, anteprima, controlli e rollback atomico.
- Nuova strategia Dipendente: l'entità multivalore usa il proprio valore e l'identificatore scelto del proprietario.

## Changed

- Cornice dell'editor semplificata senza controlli duplicati e pannello Note autonomo.
- Animazioni centralizzate con copertura prefers-reduced-motion completa.

## Fixed

- Corretta la generazione dati con identificatori composti annidati e chiavi esterne composite in ordine diverso.
- Corretti l'anello chiaro dell'attività attiva, gli indicatori delle righe dell'Explorer, lo sfondo dei menu di riga e il bordo della tab attiva nell'editor.
