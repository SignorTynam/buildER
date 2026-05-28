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

## [4.5] - 2026-05-28

### Added
- Sintassi ERS canonica `identifier(...)` per identificatori interni semplici, composti, alternativi ed esterni/misti.
- Compatibilita in lettura con la sintassi ERS legacy `(id)`, `(external)` ed `external` sulle relazioni.
- Modal paginato per scegliere manualmente la PK quando `FIX ENTITIES` trova entita con piu candidate key.
- Preview logica della scelta PK con tabelle, badge PK/FK/NN/U, FK risultanti e alternative UNIQUE NOT NULL.
- Collision avoidance per le label delle cardinalita nel canvas ER.
- Test di regressione per sintassi ERS, identificatori esterni, label edge, candidate key logiche e preview PK.

### Changed
- Versione applicativa aggiornata alla release 4.5 in `src/utils/appMeta.ts`.
- Versione del progetto allineata a 4.5 in `package.json` e `package-lock.json`.
- README aggiornato alla nuova versione 4.5 con riepilogo delle modifiche dalla 4.4.
- Identificatori esterni/misti serializzati in ERS come `identifier(attrLocale, RELAZIONE)`, con inferenza automatica delle parti importate.
- Validazione degli identificatori esterni aggiornata per permettere piu identificatori misti alternativi sulla stessa entita anche quando riusano la stessa relazione importata con attributi locali diversi.
- Layout degli identificatori esterni/misti migliorato con corsie progressive per frame, marker e percorsi.
- Attributi composti ridisegnati nel canvas ER come capsule/ovali con testo centrato e sotto-attributi esterni.
- Vista Logica aggiornata per sottolineare solo il nome delle colonne PK, senza coinvolgere badge, tipo SQL o intera riga.

## [4.4] - 2026-05-26

### Added
- Badge per le keyword PK/FK/NN/U nelle colonne della Vista Logica con colori dedicati.

### Changed
- Versione applicativa aggiornata alla release 4.4 in `src/utils/appMeta.ts`.
- Versione del progetto allineata a 4.4 in `package.json` e `package-lock.json`.
- README aggiornato alla nuova versione 4.4 con riepilogo delle modifiche dalla 4.3.1.
- Rimossa la sottolineatura delle PK: le chiavi ora sono rese come badge distinti.
- Layout e calcolo larghezze della tabella logica aggiornati per integrare i badge senza sovrapposizioni.

## [4.3.1] - 2026-05-21

### Added
- Toggle Diagnostica nel canvas per mostrare o nascondere gli indicatori di warning/error senza disattivare la validazione.
- Stato `showDiagnostics` salvato nella sessione locale, cosi la preferenza viene ripristinata con il workspace.
- Cornice dedicata per gli identificatori esterni sull'entita, con marker distinti per parti importate e attributi locali.
- Tooltip sui marker delle parti importate con attributi importati e relativa entita sorgente.
- Test di regressione per routing degli identificatori esterni, validazione dei path e attributi composti annidati.

### Changed
- Versione applicativa aggiornata alla release 4.3.1 in `src/utils/appMeta.ts`.
- Versione del progetto allineata a 4.3.1 in `package.json` e `package-lock.json`.
- README aggiornato alla nuova versione 4.3.1 con riepilogo delle modifiche dalla 4.3.
- Rendering degli identificatori esterni spostato da doppio rettangolo interno a cornice esterna dedicata; il doppio rettangolo resta riservato alle entita deboli.
- Routing della cornice identificatore esterno reso piu stabile con percorsi aperti, preferenza per i lati marcati, deduplica delle proiezioni e gestione compatta dei marker sullo stesso lato.
- Marker degli identificatori esterni ancorati al punto in cui collegamenti importati o attributi locali incontrano la cornice dell'entita.
- Aggiunti stili per toggle diagnostica, cornice identificatore esterno e mascheramento dei segmenti di collegamento interni alla cornice.

### Fixed
- Bloccata la creazione di attributi composti annidati: gli attributi figli di un composto non possono diventare composti tramite toolbar, nuovo collegamento, creazione sotto-attributo o modifica multipla.
- La finestra Errori segnala quando gli indicatori canvas sono nascosti, mantenendo visibile lo stato della validazione.
- Corretti i casi in cui il percorso degli identificatori esterni percorreva lati non necessari o produceva una chiusura visiva eccessiva.

## [4.3.0] - 2026-05-19

### Added
- Ruoli per associazioni ad anello con gestione da toolbar e validazioni di unicita.
- Warning per relazioni n-arie con cardinalita massima 1.
- Traduzione generalizzazioni con regola substitution che crea relazioni IS.

### Changed
- Traduzione generalizzazioni collapse-up: attributo Type, import attributi opzionali dalle figlie e gestione identificatori.
- Identificatori esterni: layout importati/misti piu stabile, grouping path e marker locali coerenti, azione di rimozione da toolbar.
- Geometria connector aggiornata per collegamenti multipli/loop e label role separate; persistenza dei ruoli in ERS e file progetto.
- Versione applicativa aggiornata alla release 4.3 in `src/utils/appMeta.ts`.
- Versione del progetto allineata a 4.3 in `package.json` e `package-lock.json`.
- README aggiornato alla nuova versione 4.3 con riepilogo sintetico della release.

## [4.2.0] - 2026-05-11

### Added
- Nuovo sistema modale Studio per menu comandi, scorciatoie tastiera, changelog e informazioni applicative.
- Supporto piu completo ai gruppi di generalizzazione ISA, con cleanup da UI, serializzazione coerente e test ERS dedicati.
- Validazioni aggiuntive per sottotipi ISA senza attributi e supertypes ISA senza relazioni.
- Vista Logica estesa con bulk fix, gestione esplicita degli stage Translation/Schema e pannelli piu coerenti.
- Vista SQL/Schema finale con rendering relazionale in stile designER: tabelle, colonne, PK/FK sottolineate e frecce tra tabelle.
- Toolbar Schema in doppia modalita: normale (`Undo`, `Redo`, `Reset`, `Fix Entities`, `Design`, `Done`, `Export`, `Save`) e modifica (`Unique`, `Type`, `Move`, `Rename`).
- Menu Type compatto con tipi SQL disponibili senza pannello legacy invasivo.

### Changed
- Versione applicativa aggiornata alla release 4.2 in `src/utils/appMeta.ts`.
- Versione del progetto allineata a 4.2 in `package.json` e `package-lock.json`.
- README aggiornato alla nuova versione 4.2 con riepilogo delle modifiche dalla 4.1.
- Toolbar e canvas rifiniti con placement preview, gestione cardinalita, azioni contestuali e stato UI piu pulito.
- Vista Translation/Restructuring riallineata allo stile designER: toolbar compatta, titolo `RESTRUCTURING`, Notes, selezioni rosse coerenti e generalizzazioni piu leggibili.
- Vista SQL/Schema riallineata allo stile designER: titolo `SCHEMA`, comando `Show` separato, tabelle pulite, frecce FK e controlli zoom minimali.
- Layout e geometria ISA migliorati con triangolo, gap, bus e label piu stabili.
- Evidenziazione SQL migliorata per token di entita e relazioni.

### Fixed
- Rimosso dalla vista SQL il pannello legacy `Tipo SQL colonna`; il comando `Type` usa solo il menu compatto della toolbar.
- Corretto il salvataggio dello schema logico quando si torna alla vista ER: rename, ordine colonne e metadati SQL manuali vengono preservati durante refresh/riallineamento.
- Migliorata la gestione di rimozione entita/sottotipi nelle gerarchie ISA per evitare riferimenti residui.
- Rafforzati i test di regressione per ERS, generalizzazioni, workflow logico manuale, SQL/schema e persistenza progetto.

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
