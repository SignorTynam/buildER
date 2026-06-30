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

## [6.2] - 2026-06-30

### Added
- Major update b: aggiunta nuova entry `impact: "major"` nel changelog applicativo e nell'annuncio versione.
- Aggiunto versioning locale dei progetti `.ersp` con cronologia commit, snapshot completi, HEAD e stato working copy.
- Aggiunto pannello Versioni progetto con creazione commit inline, messaggi suggeriti, stato clean/dirty e badge HEAD.
- Aggiunto diff strutturato tra versioni per schema ER, layout, modello logico, codice ERS e stato workspace.
- Aggiunto ripristino protetto delle versioni con backup automatico dello stato corrente prima del restore.
- Aggiunto confronto visuale full-screen tra due snapshot con workspace affiancati in sola lettura.
- Aggiunte evidenziazioni visuali per elementi aggiunti, rimossi, modificati e variazioni di layout nelle viste ER e logica.
- Aggiunto export dello schema relazionale, con azioni dedicate di copia/download nella vista logica.
- Aggiunto menu export flottante con formati PNG, JPEG, SVG, ERS, progetto e schema relazionale.

### Changed
- Versione applicativa aggiornata a buildER 6.2 in `package.json`, `package-lock.json`, `src/utils/appMeta.ts`, README, changelog e changelog localizzato.
- Il formato progetto `.ersp` ora conserva anche cronologia versioni, snapshot, impostazioni di versioning e stato del workspace.
- La UI di confronto versioni sostituisce la vecchia modal con un ambiente di comparazione full-screen piu leggibile.
- Rendering e stile dello schema relazionale migliorati per lettura, export e integrazione con il dock tecnico.
- Export e stampa hanno stili piu coerenti, formati aggiuntivi e comportamento piu uniforme tra viste ER e logiche.
- Standardizzato il border radius dei componenti UI per rendere modali, pannelli, toolbar e card piu coerenti.

### Fixed
- Corretto il ripristino delle versioni per evitare perdita dello stato corrente grazie al backup automatico.
- Corretto il confronto visuale quando una snapshot non contiene vista Traduzione o schema logico salvati.
- Corretto il rendering dei cambiamenti di layout e degli elementi focalizzati durante il confronto tra versioni.
- Corrette regressioni di export, comandi non applicabili e compatibilita dei vecchi file progetto senza versioning.

## [6.1] - 2026-06-26

### Added
- Major upgrade buildER 6.1: aggiunta nuova entry `impact: "major"` nel changelog applicativo e nell'annuncio versione.
- Aggiunta serializzazione ERS degli attributi collegati alle relazioni nel Code panel.
- Aggiunto supporto agli attributi composti e multivalore collegati alle relazioni con sintassi uniforme rispetto agli attributi delle entità.
- Aggiunto round-trip ERS per preservare attributi di relazione, marker `(multi)` e sotto-attributi.
- Aggiunto layout attributi perimetrale con priorità sinistra per entità, relazioni e attributi composti.
- Aggiunto sistema toast visibile basato su `useWorkspaceNotices`, con stack, dismiss, deduplica e toni success/warning/error/info.
- Aggiunta copertura i18n completa in italiano, inglese e albanese per Inspector, identificatori, dialog ISA, intro, about, changelog e pagine statiche.

### Changed
- Versione applicativa aggiornata a buildER 6.1 in `package.json`, `package-lock.json`, `src/utils/appMeta.ts`, README e changelog.
- Il layout automatico degli attributi non usa più la vecchia distribuzione bilanciata top/right/bottom/left.
- L'aggiunta incrementale di attributi non riposiziona più gli attributi già presenti.
- Reverse SQL e sotto-attributi usano la stessa strategia perimetrale del canvas principale.
- Toolbar, toolbox ed export menu nascondono i comandi non applicabili invece di mostrarli come disabled.
- Le notifiche toast sono limitate a operazioni non valide e download, evitando notifiche generiche troppo frequenti.
- Il changelog runtime ora usa la nuova entry localizzata `changelog.entries.v6_1` e mantiene `6.0` come storico.
- README aggiornato alla nuova versione 6.1 con riepilogo delle modifiche successive alla 6.0.

### Fixed
- Corretto il Code panel quando una relazione contiene attributi semplici, multivalore o composti.
- Corretto il caso in cui il parser/serializer ERS perdeva attributi di relazione nel round-trip.
- Corretto il layout che poteva creare colonne verticali troppo lunghe di attributi sul lato sinistro.
- Corretto il comportamento in cui modifiche effettuate direttamente nel workspace non venivano sincronizzate nel Code panel.
- Corretto il rendering di separator vuoti nella toolbar quando un gruppo conteneva solo comandi non applicabili.
- Corretto il rischio di fallback italiani nel changelog localizzato inglese/albanese.

## [6.0] - 2026-06-25

### Added
- Major update buildER 6: aggiunto modal grande di aggiornamento tramite nuova release `impact: "major"` in `src/utils/appMeta.ts`.
- Aggiunto Fix Unique/Shared per attributi semplici multivalore diretti con cardinalita `(0,N)` e `(1,N)`.
- Aggiunta trasformazione ER Unique: nuova entita attributo, relazione `HAS_<ATTRIBUTO>`, cardinalita originale sul lato owner e `(1,1)` sul lato nuova entita.
- Aggiunta trasformazione ER Shared: nuova entita attributo, relazione `HAS_<ATTRIBUTO>`, cardinalita originale sul lato owner e `(1,N)` sul lato nuova entita.
- Aggiunta traduzione logica corretta dei Fix Unique/Shared per attributi semplici multivalore gia trasformati.
- Aggiunta traduzione logica standard per attributi composti multivalore con tabella dedicata, FK owner, leaf attributes e PK composta.
- Aggiunto supporto alle PK composte dell'entita owner nella traduzione dei multivalori semplici risolti e dei composti multivalore.
- Aggiunti controlli espliciti per owner senza PK, composti multivalore senza sotto-attributi e multivalori annidati non supportati.
- Aggiunta copertura test per Fix Unique/Shared, FK logiche, attributi composti multivalore, Split, geometria della vista Traduzione e versioning major.

### Changed
- Versione applicativa aggiornata a buildER 6 con `package.json`, `package-lock.json`, `src/utils/appMeta.ts`, README e changelog allineati come major upgrade.
- Gli attributi composti restano esclusi dal Fix Unique/Shared degli attributi semplici multivalore.
- Split sugli attributi composti multivalore ora preserva la cardinalita del root composto sul nuovo attributo semplice generato.
- Gli attributi generati da Split restano semplici e non ricevono il simbolo grafico di multivalore quando la vista ER non lo usa per quel caso.
- Unique e Shared dopo Split usano la cardinalita preservata dal nuovo attributo generato.
- La vista Traduzione ora usa le stesse regole grafiche della vista ER per entita, relazioni, attributi e shape generati automaticamente.
- Le entita generate con label lunga mantengono altezza ER standard e larghezza adattiva.
- Le relazioni generate con label lunga, come `HAS_<ATTRIBUTO>`, usano dimensioni calcolate dagli helper ER.
- I nodi sintetici della Logical Transformation View preservano le proprieta ER del nodo sorgente e sovrascrivono solo label, posizione e dimensioni.

### Fixed
- Corretto il caso Unique in cui la tabella della nuova entita attributo veniva generata senza FK verso l'entita proprietaria.
- Corretto il caso Shared in cui la tabella associativa `HAS_<ATTRIBUTO>` conteneva solo la FK verso la nuova entita attributo e perdeva la FK verso l'owner.
- Corretto il rischio di tabelle logiche incomplete quando l'entita owner non ha una PK utilizzabile.
- Corretto il caso in cui i sotto-attributi leaf di un composto multivalore venivano persi o non inclusi correttamente nella PK della tabella dedicata.
- Corretto lo Split di composto multivalore che generava un attributo semplice senza cardinalita.
- Corrette dimensioni hard-coded o incoerenti degli shape ER generati nella vista Traduzione.

## [5.4] - 2026-06-25

### Added
- Aggiunta funzionalità di rename per i target di traduzione (tabelle e colonne) nel `LogicalTranslationWorkspace`, con supporto i18n in italiano, inglese e albanese.
- Hook `useHistory` potenziato: supporto a numero massimo di voci configurabile, clonazione custom e check di uguaglianza; undo/redo rispetta il limite massimo configurato.
- Aggiunti stili CSS dedicati per le label delle cardinalità senza sfondo rettangolare (`src/index.css`).
- Export SVG esteso con modalità `normal` e `print`: rimozione degli elementi di validazione (halo warning/error su nodi e archi) prima dell'export.
- Export SVG preserva i fill dei marker degli identificatori semplici (`attribute-identifier` class) in modalità stampa.
- Estesa la copertura test per: sessione workspace (pannelli tecnici), rename traduzione, history, layout attributi, export SVG, cardinalità, resize nodi, toolbar comandi e code drawer.

### Changed
- Versione applicativa aggiornata a buildER 5.4 con `package.json`, `package-lock.json`, `src/utils/appMeta.ts`, README e changelog allineati come update fix.
- Rimossa l'interazione legacy di drag-edge da `DiagramCanvas`: codice semplificato e test aggiornati.
- Altezza degli attributi multivalore corretta da 44 a 34 px per coerenza di layout; normalizzazione automatica applicata ai file progetto legacy.
- Label delle cardinalità ridisegnate senza sfondo rettangolare: rimosso il rettangolo di sfondo da `DiagramEdge`, aggiornati stili e test.
- Logica di resize dei nodi rifattorizzata per entità e relazioni: il centro viene preservato durante la rinomina anche per relazioni a rombo.
- Comando subattributo nella toolbar reso sempre visibile per gli attributi semplici; logica di visibilità semplificata e test aggiornati.
- Layout degli attributi rifattorizzato per supportare sia entità che relazioni come host, con posizionamento e distribuzione migliorati.
- Code panel rifattorizzato come drawer sovrapposto al canvas: il canvas mantiene dimensioni complete quando il drawer è aperto.
- Rimossa la classe legacy del technical workspace shell; logica di layout aggiornata per evitare la riapertura automatica del pannello tecnico.
- CSS `editor-refactor.css` aggiornato per supportare il nuovo layout drawer del pannello codice.
- Gestione sessione workspace aggiornata per i pannelli tecnici (code, notes, review): ripristino corretto dello stato dalla sessione salvata.
- Corretta la descrizione del `notesPanel` nelle traduzioni italiana, inglese e albanese per maggiore chiarezza.

### Fixed
- Corretti i casi in cui l'altezza degli attributi multivalore nei file esistenti non corrispondeva al nuovo valore compatto.
- Corretto il resize delle relazioni a rombo che non preservava il centro durante la rinomina.

## [5.3] - 2026-06-21

### Added
- Aggiunto selettore lingua direttamente nell'AppHeader: menu a tendina con italiano, inglese e albanese, gestione stato locale e accessibilità da tastiera.
- Aggiunti stili CSS dedicati al menu lingua nell'header (`src/styles/panels.css`).
- Introdotto il modulo `src/features/workspace/workspaceSession.ts` per la serializzazione e il ripristino della sessione workspace.
- Introdotti gli hook `useWorkspaceLayoutState`, `useWorkspaceNotices` e `useAppDialogs` per separare le responsabilità di `App.tsx`.
- Aggiunti test per selettore lingua AppHeader, sessione workspace (serializzazione, ripristino, compatibilità versioni precedenti e gestione dati invalidi), vista diagramma `'er'` e nuove chiavi i18n.

### Changed
- Versione applicativa aggiornata a buildER 5.3 con `package.json`, `package-lock.json`, `src/utils/appMeta.ts`, README e changelog allineati come update fix.
- Aggiornati i messaggi i18n di `en.ts`, `it.ts` e `sq.ts` con le chiavi necessarie al selettore lingua e ai nuovi componenti localizzati.
- Localizzati DiagramCanvas, BottomStatusBar, ChangelogModal, ErWorkspaceSidebar, TechnicalDockPanel e VersionAnnouncement: tutte le stringhe hardcoded sono state sostituite con funzioni di traduzione.
- Refactoring di `App.tsx`: dimensioni ridotte significativamente tramite integrazione dei nuovi hook e rimozione delle logiche di session/layout inline.
- Aggiornata la configurazione TypeScript (`tsconfig.app.json` e `tsconfig.node.json`) per usare `bundler` come strategia di risoluzione dei moduli.
- Aggiornato il workflow CI (`deploy-pages.yml`) per installare le dipendenze di sviluppo durante il build GitHub Pages.

### Fixed
- Rimossa la funzione `onCreateExternalIdentifier` da `DiagramCanvas`, `SqlReverseErPreview` e `TranslationWorkspace`: la logica obsoleta è stata eliminata e i relativi messaggi di guidance ripuliti.
- Corretta la funzione `sanitizeDiagramView` in `src/utils/projectFile.ts` per accettare `'er'` come valore valido della vista diagramma nei file `.ersp`.

## [5.2] - 2026-06-19

### Added
- Aggiunto export JPEG con sfondo bianco, MIME `image/jpeg`, estensione `.jpeg` e qualita alta per l'output raster.
- Aggiunto il comando `JPEG` nella UI di export per toolbar, command menu e workspace logico.
- Aggiunto il toggle `Mostra FK` / `Nascondi FK` nella toolbar della vista Schema Logica.
- Aggiunti chip SVG leggibili per le label FK, con badge `FK`, testo multilinea e stati selezionato/highlight coerenti.
- Aggiunto layout intelligente per le label FK con reserved boxes, candidate positions e scoring deterministico.
- Aggiunti test dedicati a export immagine, wrapping FK, collision avoidance, fallback deterministico e layer FK separati.

### Changed
- Versione applicativa aggiornata a buildER 5.2 con `package.json`, `package-lock.json`, `src/utils/appMeta.ts`, README e changelog allineati come update fix.
- Export PNG e SVG aggiornati per usare bounding box reale dello schema, padding minimo anti-clipping e crop indipendente da pan/zoom.
- Export PNG reso sempre trasparente, senza fill bianco o grigio del canvas.
- Export SVG reso trasparente e standalone, con font dell'app e stili calcolati essenziali copiati nel file serializzato.
- Export ER e Logica aggiornati per escludere sfondi/canvas e non esportare rettangoli infiniti o spazio del viewport.
- Vista Schema Logica aggiornata per mostrare le label FK permanenti solo quando il nuovo toggle e attivo, mantenendo il comportamento contestuale quando e spento.
- Label FK lunghe mandate su 2/3 righe prima di applicare ellissi controllata, con testo completo mantenuto nel `title`.
- Linee FK e label FK separate in layer diversi: le linee restano sotto le tabelle, le label restano sopra e cliccabili.
- `Adatta`, `Centra`, `Reset` ed export includono i bounds reali delle label FK visibili.
- Stili CSS dei chip FK rifiniti per leggibilita, export e assenza di rettangoli neri.

### Fixed
- Corretto l'export Logica che poteva generare rettangoli neri o stili mancanti fuori dall'app.
- Corretto l'eccesso di spazio vuoto negli export PNG/SVG quando lo schema era piccolo rispetto al viewport.
- Corretto il comportamento del PNG che prima poteva avere sfondo bianco invece di trasparente.
- Corrette sovrapposizioni delle label FK con tabelle e altre label nelle viste dense.
- Corretto il click sui chip FK: seleziona la foreign key corretta senza bloccare selezione, highlight o click sulle linee.
- Corretto il footer del modal Notes: i pulsanti `Cancel` e `Save` ora hanno stile coerente, focus visibile e dimensioni da pulsanti reali.

## [5.1] - 2026-06-16

### Added
- Aggiunta schermata di caricamento iniziale con logo buildER, messaggio localizzato, suggerimento e delay configurabile per i test.
- Aggiunti asset brand completi: logo buildER, varianti senza sfondo/senza testo, favicon SVG/ICO/PNG, Apple touch icon e web app manifest.
- Aggiunta configurazione Playwright per test end-to-end su Chromium con dev server Vite automatico.
- Aggiunti test E2E per loading screen e cambio lingua dell'app chrome tra italiano, inglese e albanese.
- Aggiunti template GitHub per bug report, feature request, pull request e configurazione issue template.
- Aggiunto il Code of Conduct del repository.

### Changed
- Versione applicativa aggiornata a buildER 5.1 con `package.json`, `package-lock.json`, `src/utils/appMeta.ts`, README e changelog allineati.
- Integrata la loading screen nel flusso principale dell'app, evitando che l'editor compaia prima che il workspace sia pronto.
- Aggiornato `index.html` per usare il nuovo favicon dell'app.
- Estesa la localizzazione di header, command menu, keyboard shortcuts e app chrome in italiano, inglese e albanese.
- Localizzati testi, aria-label, tooltip e stati di Toolbar, NotesPanel, CodePanel, CardinalityModal, SQL Reverse e Logical Translation workspace.
- Aggiornati i dizionari `it`, `en` e `sq` e aggiunto un layer di integrazione per nuove sezioni localizzate.
- Rifiniti layout CSS di pannelli, loading screen, header e componenti collegati alle viste localizzate.

### Fixed
- Rimosso il tutorial legacy della modalita Code, ormai sostituito dai flussi moderni dell'app.
- Aggiunte chiavi i18n per errori strutturati, messaggi di connessione, SQL Reverse, canvas e modal di scelta PK logica.
- Rimosse diverse classificazioni basate su pattern testuali italiani nei messaggi dell'app, sostituendole con percorsi espliciti e localizzabili.
- Estesi i test i18n unitari per coprire le nuove chiavi e garantire che inglese e albanese non ricadano su fallback italiani.

## [5.0] - 2026-06-15

### Added
- buildER 5 introduce una release maggiore dedicata a rebrand, responsive/mobile, UI moderna, SQL Reverse e coerenza complessiva dell'editor.
- Aggiunta una strategia responsive completa per desktop largo, desktop stretto/tablet landscape, tablet portrait e telefono.
- Introdotto un sistema icone centralizzato basato su `lucide-react` e `StudioIcon`, con icone custom per gli elementi ER specifici.
- Aggiunta una command palette moderna per il Menu comandi, con ricerca, categorie, icone, shortcut chip, stati active/disabled e layout mobile dedicato.
- Aggiunta una shortcuts sheet moderna per Keyboard Shortcuts, con ricerca, filtri categoria, righe sottili e kbd chip compatti.
- Aggiunto supporto funzionale al riuso dello stesso attributo locale in piu identificatori esterni/misti alternativi della stessa entita.

### Changed
- Il programma cambia nome: da ER Studio a buildER.
- Versione applicativa aggiornata a buildER 5.0 con `package.json`, `package-lock.json`, `src/utils/appMeta.ts`, README e changelog allineati.
- Stabilizzati app shell, workspace, canvas e pannelli con viewport dinamici, safe area mobile, min-height coerenti e prevenzione dell'overflow orizzontale globale.
- Riorganizzata la vista ER mobile: HUD viewport sopra, quick actions al centro e toolbox come barra piu bassa, senza collisioni tra controlli.
- Header mobile compattato su una sola riga con brand, nome progetto e pulsanti help/menu.
- Quick actions ER unificate in Code, Reverse, Errors e Notes; Diagnostics e stato diagnostica sono stati spostati dentro Errors.
- HUD viewport modernizzato con icone e controlli Adatta, Centra e Reset sempre visibili, compatti e touch-friendly.
- Toolbox ER riallineato allo stile delle viste Translation e Logical: rail compatta, separatori sottili, niente titoli di sezione e comandi contestuali mostrati solo quando utili.
- Preview SQL Reverse logica ed ER riallineate allo stile delle viste reali, con sfondi coerenti, footer azioni riservato e HUD non sovrapposto ad Avanti/Done.
- Modal SQL Reverse, pannello Errors, quick actions e footer azioni modernizzati con superfici, bordi, spacing e icone coerenti.
- Normalizzazione degli identificatori esterni aggiornata: non esiste piu un blocco globale sugli attributi locali gia usati da un altro identificatore esterno.
- Traduzione logica e serializzazione ERS preservano identificatori misti distinti che condividono lo stesso attributo locale.

### Fixed
- Rimossa la duplicazione di opzioni nel toolbox ER mobile, incluse duplicazioni semantiche di Attribute, Delete e Connect.
- Corretti overlay e collisioni tra quick actions, toolbox e HUD viewport su mobile e desktop.
- Corretta la sovrapposizione dell'HUD viewport con i bottoni finali nelle preview SQL Reverse.
- Rimosso il layer laterale con colore incoerente nelle preview SQL Reverse.
- Corretti layout fragili di CodePanel, NotesPanel, modali e pannelli laterali su mobile.
- Corretti stili legacy residui in toolbar, modali, Errors, SQL Reverse e menu contestuali.
- Aggiunti e aggiornati test di regressione per identificatori esterni condivisi, SQL Reverse, parsing/serializzazione ERS, layout canvas e workflow logico.

## [4.6.2] - 2026-06-12

### Changed
- Versione applicativa aggiornata a ER Studio 4.6.2 con `package.json`, `package-lock.json`, metadati UI e changelog allineati.
- Il pannello Code conserva posizione e dimensioni dei nodi gia presenti quando il testo ERS viene modificato.
- Il merge ERS usa una memoria layout per evitare che nodi rimossi temporaneamente durante la digitazione vengano riposizionati quando ricompaiono.
- Matching ERS piu robusto per ID, alias, attributi collegati al relativo host e rename, con preservazione dei metadati degli edge.

### Fixed
- I connector entita-relazione non possono piu essere deformati trascinando manualmente il tracciato; le cardinalita restano editabili senza spostare il link.
- Gli offset manuali legacy dei connector vengono ignorati e ripuliti per impedire geometrie instabili nei salvataggi esistenti.
- Aggiunti test di regressione per stabilita del layout da Code panel, memoria layout e routing dei connector.

## [4.5.2] - 2026-06-03

### Added
- Export PNG e SVG dalla toolbar e dal Logical Translation workspace.
- Generazione SQL con supporto ai dialetti.

### Changed
- Versione applicativa aggiornata alla release 4.5.2 in `src/utils/appMeta.ts`.
- Versione del progetto allineata a 4.5.2 in `package.json` e `package-lock.json`.
- README aggiornato alla nuova versione 4.5.2 con riepilogo delle modifiche dalla 4.5.1.
- Gestione generalizzazioni rifattorizzata con gruppi/styling aggiornati, normalizzazione dei nomi export e validazione degli identificatori.
- Traduzione generalizzazioni migliorata con risoluzione delle gerarchie compatibili, gestione delle gerarchie bloccanti e label discriminator aggiornate.
- Canvas logico: determinazione del view mode dedicata e completamento step basato sul conteggio degli item aperti.
- Modalita trasformazione logica aggiornata con filtro del contesto ER non risolto e migliore visibilita/gestione edge tramite mappatura degli ID sorgente.
- Test di regressione aggiornati per generalizzazioni, canvas logico, export e SQL.

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
