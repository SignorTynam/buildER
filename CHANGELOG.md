# Changelog

Tutte le modifiche importanti del progetto saranno documentate in questo file.

Il formato segue le linee guida di Keep a Changelog e la versione del progetto segue Semantic Versioning.

## [Unreleased]

### Added
- Inserire qui nuove funzionalita non ancora rilasciate.

### Changed
- Inserire qui modifiche a funzionalita esistenti.

### Fixed
- Inserire qui bug fix.

## [4.1.0] - 2026-04-30

### Changed
- Versione applicativa aggiornata alla release 4.1 in `src/utils/appMeta.ts`.
- Versione del progetto allineata a 4.1 in `package.json` e `package-lock.json`.
- README aggiornato alla nuova versione 4.1 con una nuova sezione novita, preservando la sezione 4.0.
- Aggiunta una nuova voce 4.1 nel changelog senza rimuovere le release precedenti.
- Pannelli Review, Code e Notes ripuliti con empty state compatti e meno testo ridondante.
- Card di Traduzione e Schema logico rese piu leggibili: regola e descrizione breve, senza output e dettagli ingombranti.
- Toolbar canvas collassata migliorata: shortcut centrati, testo nascosto e nessuna invasione del canvas.
- Inspector e impostazioni shape nel pannello Canvas resi piu compatti e stabili su larghezze ridotte.
- Pannelli laterali Traduzione e Schema logico migliorati quando vengono nascosti: riapertura compatta senza pannello vuoto.

## [4.0.0] - 2026-04-26

### Changed
- Versione applicativa aggiornata alla release 4.0 in `src/utils/appMeta.ts`.
- Versione del progetto allineata a 4.0 in `package.json` e `package-lock.json`.
- README aggiornato alla nuova versione 4.0 e alla relativa sezione novita.
- Aggiunta una nuova voce 4.0 nel changelog senza rimuovere le release precedenti.
- Preservato lo storico completo delle release 3.9 e precedenti.

## [3.9.0] - 2026-04-20

### Added
- Introdotto il nuovo `LogicalTranslationWorkspace` per la Vista Logica, con workflow guidato a step, gestione item pending e pannello conflitti/artefatti.
- Aggiunti test di regressione dedicati al workflow logico manuale (apertura senza auto-conversione, aggiornamenti incrementali e gestione decisioni legacy).

### Changed
- Versione applicativa aggiornata alla release 3.9 su package, lockfile, metadata applicativi e documentazione.
- Ripristinata la Vista Logica come fase manuale e incrementale dopo la Vista Traduzione: la costruzione del modello logico avviene solo tramite decisioni utente.
- Consolidata la separazione di responsabilita tra viste: gerarchie ISA e attributi composti restano nella Vista Traduzione; la Vista Logica non espone piu lo step generalizzazioni.
- Riallineata la gestione di refresh/salvataggio/caricamento del workspace logico per mantenere decisioni coerenti e invalidare in sicurezza quelle incompatibili.

### Fixed
- L'apertura della Vista Logica non innesca piu una conversione logica completa automatica.
- Ridotti i rischi di inconsistenza su progetti legacy con decisioni di generalizzazione non piu valide nel nuovo scope logico.

## [3.8.0] - 2026-04-16

### Added
- Introdotto il formato progetto `.ersp` con salvataggio e ripristino di diagramma ER, vista logica, viewport, selezioni e metadati del workspace.
- Aggiunto supporto di import compatibile per i vecchi backup JSON versione 2, che vengono migrati nel formato progetto corrente.
- Introdotta l'internazionalizzazione dell'app con provider dedicato e cataloghi in italiano, inglese e albanese.

### Changed
- Versione applicativa aggiornata alla release 3.8 su package, metadata applicativi e documentazione.
- Serializzazione e parsing ERS allineati alla regola `ID = nome`: lo schema testuale usa il nome corrente delle shape e non piu id legacy casuali.
- La vista Logica adotta ora un rendering classico ispirato a designER: tabelle rettangolari monocromatiche, header centrati, chiavi primarie sottolineate e collegamenti FK ortogonali sobri.
- Aggiornati i contenuti di onboarding e tutorial per riflettere il nuovo comportamento dei file progetto e del codice ERS.

### Fixed
- La rinomina delle shape sincronizza correttamente id e riferimenti dipendenti, evitando incoerenze tra canvas e schema ER esportato.
- L'apertura di file progetto invalidi o con `kind` errato restituisce un errore strutturato invece di produrre uno stato ambiguo nel workspace.

## [3.7.0] - 2026-04-15

### Added
- Nuova struttura CSS Grid flessibile che allinea lo spazio e l'estetica della vista Logico al sistema a 5 colonne della vista ER (Toolbar, Resizer, Main, Resizer, Inspector), rimuovendo i vecchi wrapper isolati.

### Changed
- Etichette dei menu a tendina Inspector per le associazioni ISA ("Vincolo ISA" e "Copertura ISA") tradotte in italiano per una maggiore congruenza linguistica.
- Rifinito il rendering dei badge ISA con colori piu tenui e testo piu leggibile, per migliorare l'estetica e la chiarezza visiva.
- Nuovo aggiornamento della vista Logica alla release 3.7, con miglioramenti significativi all'usabilita, alla flessibilita del layout e alla coerenza visiva dei diagrammi logici.

### Fixed
- Risolto bug sul componente `LogicalTransformationCanvas` che imponeva al browser l'altezza standard intrinseca degli SVG (150px) ignorando lo spazio verticale libero della UI.

## [3.6.0] - 2026-04-14

### Added
- Aggiunta interazione diretta sul backbone degli identificatori interni composti con drag del gruppo membro come unita logica.

### Changed
- Rendering identificatori interni composti rifattorizzato in geometria ortogonale: backbone comune e rami lineari.
- Eliminato il routing curvo del backbone composito.
- Posizione del backbone calcolata automaticamente in base al lato entita, bounding box e distribuzione attributi membri.
- Distribuzione dei rami resa deterministica con spaziatura minima per evitare sovrapposizioni e incroci inutili.
- Recompute del layout composito stabilizzato durante move entita/attributi, aggiunta o rimozione membri e reload.

### Fixed
- Rimossi i collegamenti diagonali duplicati dei membri composti sopprimendo gli edge diretti attributo-entita quando e attivo il gruppo composito.
- Introdotti stem ortogonali entita-backbone per mantenere una lettura unica e pulita della struttura.

## [3.5.0] - 2026-04-14

### Added
- Aggiunto `security.md` con una prima policy per la segnalazione responsabile delle vulnerabilita.
- Aggiunto `LICENSE` con licenza MIT per definire i diritti d'uso del codice.
- Aggiunto `CONTRIBUTING.md` con linee guida su setup locale, naming branch, PR e standard di codice.
- Aggiunto il tracciamento del changelog tramite `CHANGELOG.md`.
- Aggiunta in `src/types/diagram.ts` la tipizzazione `EntityRelationshipParticipation` e il campo opzionale `relationshipParticipations` sugli entity node.
- Aggiunto in `src/types/diagram.ts` il campo opzionale `cardinality` sugli attribute node.
- Aggiunte in `src/utils/cardinality.ts` utility per normalizzazione e risoluzione della cardinalita di connector e attribute edge.

### Changed
- In `src/types/diagram.ts` i connector edge usano ora `participationId` invece del campo testuale `cardinality`.
- In `src/types/diagram.ts` la cardinalita degli attribute edge non e piu salvata direttamente sull'edge ma risolta dal nodo attributo.
- In `src/utils/cardinality.ts` la lettura della cardinalita e stata centralizzata tramite `getEdgeCardinalityValue` e `getEdgeCardinalityLabel`.
- In `src/inspector/InspectorPanel.tsx` rimossa la card "Impostazioni associazione": la rinomina resta disponibile tramite azioni rapide.

### Fixed
- Nessuna correzione registrata in questa release.

## [3.4.0] - 2026-04-14

### Added
- Creato il file CHANGELOG.md per tracciare le modifiche per release.
