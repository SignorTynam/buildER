export const APP_NAME = "buildER";
export const APP_VERSION = "6.0";
export const APP_TITLE = `${APP_NAME}`;

export type AppChangelogImpact = "patch" | "minor" | "major";

export interface AppChangelogFeature {
  title: string;
  description: string;
  icon?: string;
  tag?: string;
}

export interface AppChangelogEntry {
  version: string;
  date: string;
  impact?: AppChangelogImpact;
  headline?: string;
  summary?: string;
  hero?: {
    eyebrow?: string;
    title: string;
    subtitle: string;
  };
  highlights?: AppChangelogFeature[];
  updates: string[];
}

export const APP_CHANGELOG: AppChangelogEntry[] = [
  {
    version: "6.0",
    date: "2026-06-25",
    impact: "major",
    headline: "buildER 6: traduzione ER piu completa e trasformazioni multivalore solide",
    summary:
      "buildER 6 e un major upgrade dalla 5.4: completa la gestione degli attributi semplici multivalore con Fix Unique/Shared, corregge la traduzione logica delle FK generate, introduce la traduzione standard degli attributi composti multivalore, preserva cardinalita e geometria nelle trasformazioni e rafforza la copertura test.",
    hero: {
      eyebrow: "Major Upgrade",
      title: "Benvenuto in buildER 6",
      subtitle:
        "Dalla 5.4 a buildER 6 la fase Translation diventa piu affidabile: Fix Unique/Shared, attributi composti multivalore, FK logiche, cardinalita e rendering ER generato lavorano insieme senza perdere semantica.",
    },
    highlights: [
      {
        title: "Fix Unique/Shared completo",
        description: "Gli attributi semplici multivalore possono essere trasformati in entita e relazione preservando cardinalita originali, modalita Unique o Shared e blocco sulle gerarchie non risolte.",
        tag: "Translation",
      },
      {
        title: "FK logiche corrette",
        description: "Unique genera la FK verso l'entita owner nella tabella attributo; Shared genera una tabella associativa con entrambe le FK e PK composta.",
        tag: "Logical",
      },
      {
        title: "Composti multivalore",
        description: "Gli attributi composti multivalore producono una tabella dedicata con FK owner, leaf attributes e PK naturale coerente anche con chiavi composte.",
        tag: "Schema",
      },
      {
        title: "Canvas di traduzione coerente",
        description: "Gli shape ER generati usano le stesse regole grafiche della vista ER, con dimensioni adattive e proprieta preservate.",
        tag: "Canvas",
      },
    ],
    updates: [
      "Versione applicativa aggiornata a buildER 6 con package.json, package-lock.json, src/utils/appMeta.ts, README e changelog allineati come major upgrade.",
      "Aggiunto Fix per attributi semplici multivalore con menu Unique e Shared, disponibile solo per attributi semplici diretti con cardinalita multivalore.",
      "Fix Unique trasforma l'attributo semplice multivalore in una nuova entita e relazione HAS_<ATTRIBUTO>, con cardinalita originale sul lato owner e (1,1) sul lato nuova entita.",
      "Fix Shared trasforma l'attributo semplice multivalore in una nuova entita e relazione HAS_<ATTRIBUTO>, con cardinalita originale sul lato owner e (1,N) sul lato nuova entita.",
      "Il Fix degli attributi semplici multivalore viene bloccato quando esistono gerarchie non ancora risolte, evitando trasformazioni in ordine non valido.",
      "Gli attributi composti sono esclusi dalla logica Unique/Shared degli attributi semplici multivalore.",
      "La traduzione logica di Fix Unique ora aggiunge nella tabella della nuova entita attributo la FK NOT NULL verso l'entita proprietaria.",
      "La traduzione logica di Fix Shared ora crea la tabella associativa con FK verso l'entita proprietaria e FK verso la nuova entita attributo, includendole nella PK composta.",
      "La traduzione logica dei Fix supporta PK semplici e composte dell'entita owner e blocca la generazione se l'owner non ha una PK utilizzabile.",
      "Aggiunta traduzione logica standard per attributi composti multivalore: tabella separata owner_attributo con FK owner NOT NULL, leaf attributes e PK composta da FK owner piu valori leaf.",
      "Gli attributi composti multivalore annidati vengono appiattiti usando solo i leaf attributes, senza trasformare i nodi composti intermedi in colonne.",
      "I multivalori annidati dentro un composto multivalore vengono rilevati e segnalati con issue invece di produrre una traduzione ambigua.",
      "La traduzione degli attributi composti multivalore gestisce owner con PK composta, owner senza PK e composti multivalore senza sotto-attributi con comportamento deterministico.",
      "Le trasformazioni Split sugli attributi composti multivalore preservano la cardinalita originale del root composto sul nuovo attributo semplice generato.",
      "Gli attributi generati da Split restano semplici, non composti, e non ricevono il simbolo grafico di attributo multivalore quando la vista ER non lo usa per quel caso.",
      "Unique e Shared possono essere applicati dopo Split perche la cardinalita originale resta disponibile sul nuovo attributo generato.",
      "La vista Traduzione usa la stessa geometria della vista ER per entita, relazioni e attributi generati dalle trasformazioni.",
      "Le entita generate con label lunga mantengono altezza ER standard e larghezza adattiva, senza height hard-coded eccessiva.",
      "Le relazioni generate con label lunga, come HAS_<ATTRIBUTO>, usano dimensioni calcolate dagli helper ER e non tagliano il testo.",
      "I fallback dei nodi sintetici nella Logical Transformation View preservano le proprieta ER del nodo sorgente, inclusi cardinality, isIdentifier, isWeak, isCompositeInternal e relationshipParticipations.",
      "Estesa la copertura test per Fix Unique/Shared, FK logiche, PK composte, attributi composti multivalore, Split con cardinalita, rendering geometrico nella vista Traduzione e versioning major.",
    ],
  },
  {
    version: "5.4",
    date: "2026-06-25",
    impact: "patch",
    headline: "buildER 5.4: canvas più fluido, export migliorato e layout attribuiti rifattorizzato",
    summary:
      "buildER 5.4 è un update fix della 5.3: rifinisce il rendering del canvas con label cardinalità senza sfondo, migliora l'export SVG con pulizia degli elementi di validazione e preservazione dei fill, rifattorizza il layout degli attributi per entità e relazioni, rende il code panel un drawer integrato nel canvas, aggiunge il rename dei target di traduzione e potenzia il hook useHistory.",
    highlights: [
      {
        title: "Canvas più pulito",
        description: "Le label delle cardinalità non mostrano più sfondi rettangolari. Il resize dei nodi preserva il centro durante la rinomina.",
        tag: "Canvas",
      },
      {
        title: "Export SVG migliorato",
        description: "Gli elementi di validazione (halo warning/error) vengono rimossi dall'export. I fill dei marker degli identificatori vengono preservati correttamente in modalità stampa.",
        tag: "Export",
      },
      {
        title: "Code panel come drawer",
        description: "Il pannello Code si apre ora come drawer sovrapposto al canvas, senza ridurre lo spazio del diagramma.",
        tag: "UX",
      },
    ],
    updates: [
      "Versione applicativa aggiornata a buildER 5.4 con package.json, package-lock.json, src/utils/appMeta.ts, README e changelog allineati come update fix.",
      "Rimossa l'interazione legacy di drag-edge da DiagramCanvas: il codice è stato semplificato e i test aggiornati.",
      "Aggiunta funzionalità di rename per i target di traduzione (tabelle e colonne) nel LogicalTranslationWorkspace.",
      "Aggiunto supporto i18n per le azioni di rename in italiano, inglese e albanese nel LogicalTranslationWorkspace.",
      "Hook useHistory potenziato: supporto a massimo di voci cronologia configurabile, clonazione custom e check di uguaglianza; undo/redo rispetta il limite massimo.",
      "Aggiornata la gestione delle sessioni workspace per i pannelli tecnici (code, notes, review): ripristino dello stato corretto dalla sessione salvata.",
      "Corretta la descrizione del notesPanel nelle traduzioni italiana, inglese e albanese per maggiore chiarezza.",
      "Altezza degli attributi multivalore corretta da 44 a 34 px per coerenza di layout; normalizzazione automatica nei file legacy.",
      "Label delle cardinalità ridisegnate senza sfondo rettangolare: stili CSS dedicati, rendering più pulito e test di verifica aggiornati.",
      "Logica di resize dei nodi rifattorizzata per entità e relazioni: il centro viene preservato correttamente durante la rinomina anche per relazioni a rombo.",
      "Comando subattributo nella toolbar sempre visibile per gli attributi semplici; logica semplificata e test di visibilità aggiornati.",
      "Layout degli attributi rifattorizzato per supportare sia entità che relazioni come host, con posizionamento e distribuzione migliorati e suite di test ridotta e più precisa.",
      "Export SVG esteso con modalità normale e print: gli elementi di validazione (halo warning/error su nodi e archi) vengono rimossi prima dell'esportazione.",
      "Export SVG preserva i fill dei marker degli identificatori semplici (classe attribute-identifier) in modalità stampa.",
      "Code panel rifattorizzato come drawer sovrapposto al canvas: il canvas mantiene le dimensioni complete quando il drawer è aperto.",
      "Rimossa la classe legacy del technical workspace shell; la logica di layout aggiornata evita la riapertura automatica del pannello tecnico.",
      "Aggiornati i CSS di editor-refactor.css per supportare il nuovo layout drawer del pannello codice con design responsivo.",
      "Estesa la copertura test per: sessione workspace (pannelli tecnici), rename traduzione, history, layout attributi, export SVG, cardinalità, resize nodi, toolbar comandi e code drawer.",
    ],
  },
  {
    version: "5.3",
    date: "2026-06-21",
    impact: "minor",
    headline: "buildER 5.3: localizzazione completa e architettura più pulita",
    summary:
      "buildER 5.3 è un update fix della 5.2: completa la localizzazione in italiano, inglese e albanese su tutti i componenti principali, introduce il selettore lingua integrato nell'header, raffina la gestione della sessione workspace, rimuove logica obsoleta degli identificatori esterni e corregge la sanitizzazione della vista diagramma.",
    hero: {
      eyebrow: "Fix 5.3",
      title: "buildER 5.3",
      subtitle:
        "Un aggiornamento mirato che completa la localizzazione, porta il selettore lingua nell'header e ripulisce l'architettura interna.",
    },
    highlights: [
      {
        title: "Selettore lingua in header",
        description: "Il menu lingua è ora direttamente nell'AppHeader: cambia italiano, inglese e albanese senza aprire impostazioni separate.",
        tag: "i18n",
      },
      {
        title: "Localizzazione estesa",
        description: "DiagramCanvas, BottomStatusBar, ChangelogModal, ErWorkspaceSidebar, TechnicalDockPanel e VersionAnnouncement usano ora chiavi i18n al posto di stringhe statiche.",
        tag: "i18n",
      },
      {
        title: "Architettura workspace",
        description: "La sessione workspace è stata estratta in hook dedicati (useWorkspaceLayoutState, useWorkspaceNotices, useAppDialogs) e in un modulo features/workspace.",
        tag: "Refactor",
      },
    ],
    updates: [
      "Versione applicativa aggiornata a buildER 5.3 con package.json, package-lock.json, src/utils/appMeta.ts, README e changelog allineati come update fix.",
      "Aggiunto selettore lingua nell'AppHeader: menu a tendina con italiano, inglese e albanese, gestione stato locale e accessibilità da tastiera.",
      "Aggiornati i messaggi i18n di `en.ts`, `it.ts` e `sq.ts` con le chiavi necessarie al selettore lingua e ai nuovi componenti localizzati.",
      "Localizzati DiagramCanvas, BottomStatusBar, ChangelogModal, ErWorkspaceSidebar, TechnicalDockPanel e VersionAnnouncement: tutte le stringhe hardcoded sono state sostituite con funzioni di traduzione.",
      "Aggiunti stili CSS dedicati al menu lingua nell'header (`src/styles/panels.css`).",
      "Introdotto il modulo `src/features/workspace/workspaceSession.ts` per la serializzazione e il ripristino della sessione workspace.",
      "Introdotti gli hook `useWorkspaceLayoutState`, `useWorkspaceNotices` e `useAppDialogs` per separare le responsabilità di `App.tsx`.",
      "Refactoring di `App.tsx`: ridotto significativamente tramite integrazione dei nuovi hook e rimozione delle logiche di session/layout inline.",
      "Rimossa la funzione `onCreateExternalIdentifier` da `DiagramCanvas`, `SqlReverseErPreview` e `TranslationWorkspace`: la logica è stata eliminata perché obsoleta.",
      "Corretta la funzione `sanitizeDiagramView` in `src/utils/projectFile.ts` per accettare `'er'` come valore valido della vista diagramma.",
      "Aggiornata la configurazione TypeScript (`tsconfig.app.json` e `tsconfig.node.json`) per usare `bundler` come strategia di risoluzione dei moduli.",
      "Aggiornato il workflow CI (`deploy-pages.yml`) per installare le dipendenze di sviluppo durante il build GitHub Pages.",
      "Aggiunti test per selettore lingua AppHeader, sessione workspace, vista diagramma `'er'` e nuove chiavi i18n.",
    ],
  },
  {
    version: "5.2",

    date: "2026-06-19",
    impact: "patch",
    headline: "buildER 5.2: export immagini e label FK piu leggibili",
    summary:
      "buildER 5.2 e un update fix della 5.1: corregge l'export PNG/SVG, aggiunge JPEG, rende le label delle foreign key piu leggibili e sistema il footer del modal Notes.",
    hero: {
      eyebrow: "Fix 5.2",
      title: "buildER 5.2",
      subtitle:
        "Un aggiornamento mirato per esportare diagrammi piu puliti e lavorare meglio sulle foreign key nella vista Schema Logica.",
    },
    highlights: [
      {
        title: "Export immagini corretto",
        description: "PNG, SVG e JPEG esportano solo lo schema, con crop stretto, font e stili coerenti anche nella vista Logica.",
        tag: "Export",
      },
      {
        title: "Foreign key leggibili",
        description: "La vista Schema Logica mostra label FK opzionali con chip, badge FK e posizionamento anti-collisione.",
        tag: "Schema",
      },
      {
        title: "UI Notes rifinita",
        description: "I pulsanti del modal Notes ora hanno stile coerente e azioni chiare nel footer.",
        tag: "UI",
      },
    ],
    updates: [
      "Versione applicativa aggiornata a buildER 5.2 con package, lockfile, metadati UI e changelog allineati come update fix.",
      "Export PNG corretto con sfondo trasparente, senza fill bianco/grigio del canvas e senza esportare spazio vuoto del viewport.",
      "Export SVG corretto con sfondo trasparente, crop stretto sul contenuto reale e output standalone apribile nel browser.",
      "Aggiunto export JPEG con sfondo bianco, MIME `image/jpeg`, estensione `.jpeg` e qualita alta per l'output raster.",
      "Gli export ER e Logica ora usano bounding box reale dello schema con padding minimo anti-clipping, indipendente da pan e zoom correnti.",
      "Gli elementi di sfondo/canvas vengono esclusi dall'export tramite marker dedicati, evitando rettangoli infiniti o canvas esportati.",
      "Il font dell'export viene risolto dallo stile dell'app e applicato allo SVG serializzato.",
      "Gli stili calcolati essenziali e le variabili del canvas logico vengono copiati nell'export, evitando rettangoli neri o stili mancanti fuori dall'app.",
      "Toolbar, command menu e workspace logico espongono il nuovo comando JPEG; la voce UI usa la label compatta `JPEG`.",
      "Aggiunti test source-level per export immagine: niente minimi 1280x720, PNG trasparente, JPEG bianco, SVG trasparente e variabili logiche preservate.",
      "Aggiunto il toggle `Mostra FK` / `Nascondi FK` nella toolbar della vista Schema Logica per rendere permanenti le label delle foreign key.",
      "Toggle FK labels retrocompatibile: quando e spento, le label restano visibili solo su selezione o focus come nella 5.1.",
      "Le label FK sono state ridisegnate come chip SVG leggibili con badge `FK`, bordo, background chiaro e stato selezionato/highlight coerente.",
      "Il testo delle label FK usa i dati reali del modello quando disponibili, con fallback sicuro alla label dell'edge.",
      "Aggiunto wrapping multilinea delle label FK lunghe su 2/3 righe, con ellissi solo quando necessario e testo completo mantenuto nel title.",
      "Implementato layout intelligente delle label FK con reserved boxes, candidate positions e scoring deterministico per evitare tabelle e altre label.",
      "Le linee FK e le label FK ora sono su layer separati: le linee restano sotto le tabelle, le label restano sopra e cliccabili.",
      "Click sul chip FK seleziona la foreign key corretta senza bloccare la selezione esistente di linee e colonne.",
      "Adatta, Centra, Reset e gli export includono i bounds reali delle label FK visibili, evitando tagli quando il toggle e attivo o una FK e selezionata.",
      "Aggiunti test dedicati al wrapping FK, collision avoidance, fallback deterministico e presenza dei layer separati con `tspan` multilinea.",
      "Rifiniti gli stili CSS dei chip FK per garantire leggibilita, colori non neri e compatibilita con export SVG/PNG/JPEG.",
      "Corretto il footer del modal Notes: i pulsanti `Cancel` e `Save` ora hanno stile coerente, focus visibile e dimensioni da pulsanti reali.",
    ],
  },
  {
    version: "5.1",
    date: "2026-06-16",
    impact: "patch",
    headline: "buildER 5.1: fix per avvio, localizzazione e identita dell'app",
    summary:
      "buildER 5.1 e un fix della versione 5.0: aggiunge una schermata di avvio dedicata, completa diverse localizzazioni in italiano, inglese e albanese, allinea gli asset brand e copre i flussi principali con test end-to-end.",
    hero: {
      eyebrow: "Fix 5.1",
      title: "buildER 5.1",
      subtitle:
        "Un fix mirato che rende l'esperienza piu rifinita dall'apertura dell'app ai principali comandi localizzati.",
    },
    highlights: [
      {
        title: "Avvio piu curato",
        description: "La nuova loading screen mostra il brand buildER, prepara il workspace e rispetta la lingua salvata prima che l'editor sia pronto.",
        tag: "Startup",
      },
      {
        title: "Localizzazione estesa",
        description: "Toolbar, menu comandi, shortcut, modali, pannelli tecnici, SQL Reverse e messaggi applicativi usano chiavi i18n piu complete.",
        tag: "i18n",
      },
      {
        title: "Identita visiva completa",
        description: "Logo, favicon, manifest e asset buildER sono allineati all'app e ai browser moderni.",
        tag: "Brand",
      },
    ],
    updates: [
      "Versione applicativa aggiornata a buildER 5.1 con package, lockfile, metadati UI e changelog allineati.",
      "Aggiunta la schermata di caricamento iniziale con logo buildER, messaggio localizzato, suggerimento e delay configurabile per i test.",
      "Integrata la loading screen nel flusso principale dell'app, evitando che l'editor compaia prima che il workspace sia pronto.",
      "Aggiunti logo buildER, varianti senza sfondo/senza testo, favicon SVG/ICO/PNG, Apple touch icon e web app manifest.",
      "Aggiornato `index.html` per usare il nuovo favicon dell'app.",
      "Rimosso il tutorial legacy della modalita Code, ormai sostituito dai flussi moderni dell'app.",
      "Estesa la localizzazione di header, command menu, keyboard shortcuts e app chrome in italiano, inglese e albanese.",
      "Localizzati testi, aria-label, tooltip e stati di Toolbar, Notes, CodePanel, CardinalityModal, SQL Reverse e Logical Translation workspace.",
      "Aggiunte chiavi i18n per errori strutturati, messaggi di connessione, SQL Reverse, canvas e modal di scelta PK logica.",
      "Rimosse diverse classificazioni basate su pattern testuali italiani nei messaggi dell'app, sostituendole con percorsi espliciti e localizzabili.",
      "Aggiornati i dizionari `it`, `en` e `sq` e aggiunto un layer di integrazione per nuove sezioni localizzate.",
      "Rifiniti alcuni layout CSS di pannelli, loading screen, header e componenti collegati alle viste localizzate.",
      "Aggiunta configurazione Playwright per test end-to-end su Chromium con dev server Vite automatico.",
      "Aggiunti test E2E per loading screen e cambio lingua dell'app chrome tra italiano, inglese e albanese.",
      "Estesi i test i18n unitari per coprire le nuove chiavi e garantire che inglese e albanese non ricadano su fallback italiani.",
      "Aggiunti template GitHub per bug report, feature request, pull request e configurazione issue template.",
      "Aggiunto il Code of Conduct del repository.",
    ],
  },
  {
    version: "5.0",
    date: "2026-06-15",
    impact: "major",
    headline: "buildER 5: nuovo nome, esperienza responsive e UI moderna",
    summary:
      "buildER 5 e un upgrade maggiore: introduce il nuovo nome dell'app, consolida il supporto mobile/tablet, modernizza toolbar, modali e icone, rafforza SQL Reverse e aggiorna la logica degli identificatori esterni/misti.",
    hero: {
      eyebrow: "Major Upgrade",
      title: "Benvenuto in buildER 5",
      subtitle:
        "Dalla 4.6.2 a buildER 5 l'editor cambia nome e diventa piu stabile su desktop, tablet e mobile, con strumenti piu coerenti, preview SQL Reverse moderne e identificatori misti piu flessibili.",
    },
    highlights: [
      {
        title: "Responsive reale",
        description: "ER, Translation, Logical e SQL Reverse ora usano breakpoint piu chiari, controlli bottom ordinati e pannelli piu robusti su mobile e tablet.",
        tag: "Layout",
      },
      {
        title: "UI moderna e coerente",
        description: "Icon system centralizzato, quick actions, HUD viewport, command palette e shortcuts sheet sostituiscono parti legacy e placeholder testuali.",
        tag: "Studio",
      },
      {
        title: "SQL Reverse integrato",
        description: "Input modal, preview logica, preview ER, footer azioni, errori e warning sono stati riallineati allo stile moderno dell'app.",
        tag: "Reverse",
      },
    ],
    updates: [
      "Il programma cambia nome: da ER Studio a buildER.",
      "Versione applicativa aggiornata a buildER 5.0 con package, lockfile, metadati UI, README e changelog allineati come major upgrade.",
      "Definita una strategia responsive completa per desktop largo, desktop stretto/tablet landscape, tablet portrait e telefono.",
      "Stabilizzati app shell, workspace, canvas, pannelli e safe area usando viewport dinamici, min-height coerenti e prevenzione dell'overflow orizzontale globale.",
      "Riorganizzata la vista ER mobile: HUD viewport sopra, quick actions al centro e toolbox come barra piu bassa, senza collisioni tra controlli.",
      "Header mobile compattato su una sola riga con brand, nome progetto e pulsanti help/menu sempre raggiungibili.",
      "Quick actions ER unificate in Code, Reverse, Errors e Notes, con Diagnostics spostato dentro il pannello Errors.",
      "Errors e Notes/Code/Reverse condividono markup e stile, badge compatti e stati attivi coerenti.",
      "HUD viewport modernizzato con icone e controlli Adatta, Centra e Reset sempre visibili e touch-friendly.",
      "Toolbox ER riallineato a Translation e Logical come rail compatta senza titoli di sezione, con comandi contestuali mostrati solo quando utili alla selezione.",
      "Eliminate duplicazioni nel toolbox mobile per Attribute, Delete, Connect e comandi contestuali equivalenti.",
      "Introdotto un sistema icone centralizzato basato su lucide-react e StudioIcon, con icone custom per elementi ER specifici.",
      "Sostituiti placeholder testuali e SVG locali principali con icone coerenti in header, toolbar ER, Translation, Logical, SQL Reverse, HUD, modali e pannelli.",
      "Modernizzato il Menu comandi come command palette search-first con categorie, icone, shortcut chip sottili, stati active/disabled e layout mobile dedicato.",
      "Modernizzato il modal Keyboard Shortcuts come shortcuts sheet con ricerca, filtri categoria, righe sottili e kbd chip compatti.",
      "Rifiniti i button UI dei menu contestuali Move e dei footer modali per evitare bottoni legacy o disallineati.",
      "Modernizzato il modal SQL Reverse con header, textarea, errori/warning e footer azioni coerenti con lo stile Studio.",
      "Modernizzato il pannello Errors con cards warning/error, toggle diagnostica sul canvas e layout scrollabile su mobile.",
      "Uniformate le preview SQL Reverse logica ed ER allo stile delle viste reali, con sfondi coerenti e HUD non sovrapposto ai bottoni Avanti/Done.",
      "Migliorato il layout SQL Reverse per schemi piu grandi, foreign key, unique, not null e warning su statement non supportati.",
      "Aggiornata la regola degli identificatori esterni/misti: lo stesso attributo locale puo partecipare a piu identificatori misti alternativi della stessa entita.",
      "La normalizzazione degli identificatori esterni non elimina piu un attributo locale solo perche gia usato in un altro identificatore esterno, mantenendo invece deduplica interna e validazioni locali.",
      "ERS import/export preserva identificatori misti diversi che condividono lo stesso attributo locale.",
      "La traduzione logica mantiene alternative distinte quando identificatori esterni diversi riusano lo stesso attributo locale ma importano parti differenti.",
      "Aggiunti e aggiornati test di regressione per identificatori esterni condivisi, SQL Reverse, layout responsive, parsing/serializzazione ERS e workflow logico.",
      "Eseguiti controlli browser/devtools su viewport mobile, tablet e desktop per overflow, accessibilita dei controlli, modali, quick actions, toolbox e preview SQL Reverse.",
    ],
  },
  {
    version: "4.6.2",
    date: "2026-06-12",
    impact: "patch",
    headline: "Layout ERS stabile durante le modifiche codice",
    summary:
      "ER Studio 4.6.2 stabilizza il merge dal pannello Code e impedisce ai connector di deformare la geometria del diagramma.",
    updates: [
      "Versione applicativa aggiornata a ER Studio 4.6.2 con metadati package e changelog allineati.",
      "Il pannello Code ora conserva geometria e posizione dei nodi gia presenti quando il testo ERS viene modificato.",
      "Aggiunta una memoria layout per le modifiche da codice: un nodo che sparisce temporaneamente durante la digitazione e poi ricompare non viene piu riposizionato come nuovo.",
      "Il merge ERS riconosce meglio entita, attributi e rename usando ID esatti, alias locali e host degli attributi, preservando anche i metadati degli edge.",
      "I connector entita-relazione non accettano piu spostamenti manuali del tracciato: le cardinalita restano modificabili senza trascinare il link.",
      "Gli offset manuali legacy dei connector vengono ignorati e ripuliti, evitando che vecchi salvataggi deformino le linee.",
      "Aggiunti test di regressione per preservazione geometria, memoria layout e routing stabile dei connector.",
    ],
  },
  {
    version: "4.6.1",
    date: "2026-06-05",
    impact: "patch",
    headline: "Layout attributi e identificatori piu stabile",
    summary:
      "ER Studio 4.6.1 corregge il placement degli attributi attorno a entita e relazioni, migliora l'allineamento dei marker degli identificatori composti e mantiene visibili i collegamenti degli attributi anche quando entrano in una chiave composta.",
    updates: [
      "Versione applicativa aggiornata a ER Studio 4.6.1 e metadata package allineati alla release 4.6.1.",
      "Corretto il placement automatico degli attributi creati da un'entita o da una relazione: i nuovi attributi vengono distribuiti sui lati del nodo invece di accumularsi in una colonna o finire molto lontano.",
      "Gli attributi gia collegati e posizionati troppo lontano vengono riallineati vicino al proprio host quando viene ricalcolato il layout degli attributi diretti.",
      "Corretto il caso del terzo attributo: l'ordine dei lati usato dal bilanciamento e ora coerente, evitando che un attributo mantenga una vecchia posizione distante.",
      "Il reverse SQL usa la stessa distribuzione bilanciata degli attributi, cosi le tabelle importate generano diagrammi ER piu compatti e leggibili.",
      "I collegamenti diretti degli attributi restano visibili anche quando gli attributi partecipano a un identificatore interno composto.",
      "Il frame degli identificatori interni composti usa un percorso aperto e non disegna piu lati vuoti inutili quando i marker sono presenti solo su alcuni lati dell'entita.",
      "I marker neri degli identificatori composti vengono posizionati nel punto reale di incrocio tra il collegamento dell'attributo e la cornice dell'identificatore.",
      "Migliorata la gestione di piu identificatori composti sulla stessa entita con corsie separate e marker ancorati in modo piu prevedibile.",
      "Aggiunti test di regressione per layout attributi, attributi lontani, terzo attributo, reverse SQL e routing degli identificatori interni composti.",
    ],
  },
  {
    version: "4.6",
    date: "2026-06-03",
    impact: "minor",
    headline: "Una nuova esperienza per scoprire gli aggiornamenti",
    summary:
      "ER Studio 4.6 introduce un sistema completo per riconoscere, presentare e ricordare gli aggiornamenti dell'app: fix discreti, release importanti con effetto WOW e changelog manuale moderno.",
    hero: {
      eyebrow: "Important Update",
      title: "Benvenuto in ER Studio 4.6",
      subtitle:
        "Tutte le novita introdotte dopo la 4.5.2 vengono ora presentate con un'esperienza visuale piu chiara, moderna e memorabile.",
    },
    highlights: [
      {
        title: "Versioning intelligente",
        description: "L'app interpreta versioni semver, confronta la versione vista con quella corrente e riconosce patch, minor, major e downgrade.",
        tag: "Smart",
      },
      {
        title: "Annunci su misura",
        description: "Le patch usano una comunicazione compatta, mentre minor e major aprono una presentazione premium con hero, highlights e CTA.",
        tag: "WOW",
      },
      {
        title: "Changelog moderno",
        description: "Il comando Novita resta sempre disponibile e mostra release card moderne, badge impatto, highlights e versione corrente.",
        tag: "Studio",
      },
    ],
    updates: [
      "Versione applicativa aggiornata a ER Studio 4.6 e metadata package allineati alla release 4.6.0.",
      "Aggiunta utility di versioning pura con parseAppVersion, compareAppVersions e classifyAppUpdate.",
      "Supportate versioni semplici come 5, 5.2 e 5.2.1, con normalizzazione automatica di major, minor e patch.",
      "Aggiunta classificazione degli aggiornamenti in first-run, none, patch, minor, major e downgrade.",
      "Il primo avvio assoluto non viene piu trattato come update: la versione corrente viene salvata come ultima versione vista senza mostrare annunci automatici.",
      "Aggiunta persistenza localStorage protetta con chiavi dedicate per ultima versione vista e annunci gia mostrati.",
      "L'app mostra automaticamente l'annuncio solo quando APP_VERSION cambia e la versione corrente non e gia stata vista.",
      "Gli annunci automatici vengono segnati come visti solo dopo una chiusura volontaria o dopo l'apertura del changelog completo.",
      "Aggiunto annuncio compatto per patch update, con messaggio discreto, versione precedente/corrente e massimo quattro note principali.",
      "Aggiunto modal WOW per minor e major update, con backdrop moderno, hero visuale, numero versione, route di aggiornamento, cards highlight e call-to-action.",
      "Aggiunto flusso Vedi changelog completo: chiude l'annuncio automatico, salva la versione come vista e apre il changelog manuale.",
      "Gli annunci automatici evitano conflitti con modali, dialoghi, errori, command menu e workflow SQL Reverse, ritardando la comparsa quando l'editor e occupato.",
      "Esteso il modello APP_CHANGELOG con impact, headline, summary, hero e highlights, mantenendo compatibili le vecchie release basate solo su updates.",
      "Sostituito il vecchio blocco inline Novita con un nuovo ChangelogModal moderno basato su studio-modal.",
      "Il changelog manuale ora evidenzia la release corrente, mostra badge Fix, Important e Major, e visualizza highlights quando disponibili.",
      "Il comando Novita nel CommandMenuModal continua ad aprire sempre lo storico manuale, indipendentemente dagli annunci gia visti.",
      "Aggiunti stili moderni per version-announcement e changelog-modal-modern con card, pill, gradienti leggeri, micro-interazioni e supporto prefers-reduced-motion.",
      "Aggiunta gestione accessibile dei nuovi dialog con role dialog, aria-modal, focus iniziale sul CTA e chiusura da tastiera.",
      "Aggiunti test automatici dedicati al versioning per first-run, none, patch, minor, major, downgrade e versioni con patch mancante.",
      "Aggiornato lo script npm test per includere i nuovi test di versioning.",
    ],
  },
  {
    version: "4.5.2",
    date: "2026-06-03",
    updates: [
      "Export PNG e SVG disponibile dalla toolbar e dal Logical Translation workspace.",
      "Generazione SQL aggiornata con supporto ai dialetti.",
      "Gestione generalizzazioni rifattorizzata: gruppi e styling rivisti, normalizzazione nomi export e validazione identificatori.",
      "Traduzione generalizzazioni migliorata con risoluzione delle gerarchie compatibili, gestione delle gerarchie bloccanti e label discriminator aggiornate.",
      "Canvas logico: view mode dedicato e completamento step basato sul conteggio degli item aperti.",
      "Modalita trasformazione logica aggiornata con filtro del contesto ER non risolto e migliore visibilita/gestione edge tramite mappatura degli ID sorgente.",
      "Test di regressione aggiornati per generalizzazioni, canvas logico, export e SQL.",
    ],
  },
  {
    version: "4.5.1",
    date: "2026-05-29",
    updates: [
      "Vista Logica corretta per mostrare l'intero diagramma di trasformazione quando si entra nel workflow Logic.",
      "Comando toolbar rinominato da Translate a Logic.",
      "Preview scelta PK aggiornata con sottolineatura dei nomi colonna che diventano chiave primaria.",
      "Nomi delle colonne importate nella preview PK resi non ambigui con prefisso dell'entita sorgente.",
    ],
  },
  {
    version: "4.5",
    date: "2026-05-28",
    updates: [
      "Versione applicativa aggiornata alla release 4.5.",
      "Sintassi ERS aggiornata: gli identificatori vengono serializzati nel formato canonico identifier(...), con compatibilita in lettura per la vecchia sintassi (id), (external) ed external sulle relazioni.",
      "Supportati identificatori interni semplici, composti e alternativi nella nuova sintassi ERS, evitando duplicazioni degli attributi usati solo come chiave.",
      "Identificatori esterni/misti espressi in ERS come identifier(attrLocale, RELAZIONE), con inferenza automatica delle parti importate dalla relazione identificante.",
      "Validazione degli identificatori esterni aggiornata per permettere piu identificatori misti alternativi sulla stessa entita anche quando riusano la stessa relazione importata con attributi locali diversi.",
      "Layout degli identificatori esterni/misti migliorato con corsie progressive per frame, marker e percorsi, riducendo sovrapposizioni quando piu identificatori convivono sulla stessa entita.",
      "Posizionamento delle cardinalita nel canvas ER reso collision-aware: le label evitano attributi, nodi, marker e altre cardinalita mantenendo il layout semplice invariato quando non ci sono collisioni.",
      "Attributi composti ridisegnati nel canvas ER: il composto principale appare come capsula/ovale con testo centrato, mentre i sotto-attributi restano label esterne con cerchio terminale collegato.",
      "Vista Logica aggiornata: i nomi delle colonne PK sono sottolineati senza sottolineare badge, tipo SQL o intera riga.",
      "FIX ENTITIES non sceglie piu automaticamente tra piu chiavi candidate: apre un modal paginato per selezionare la PK per ogni entita ambigua.",
      "Modal di scelta PK migliorato con navigazione Precedente/Prossima, layout a due colonne, opzioni compatte e preview logica coerente con la Vista Logica.",
      "Preview della scelta PK aggiornata per mostrare tabelle logiche, badge PK/FK/NN/U, FK risultanti e chiavi alternative tradotte come UNIQUE NOT NULL.",
      "Copertura test estesa su ERS, identificatori esterni, layout delle label edge, scelta manuale delle candidate key e preview logica.",
    ],
  },
  {
    version: "4.4",
    date: "2026-05-26",
    updates: [
      "Versione applicativa aggiornata alla release 4.4.",
      "Etichette colonne nella Vista Logica aggiornate con badge per le keyword PK/FK/NN/U e colori dedicati.",
      "Rimossa la sottolineatura delle PK: le chiavi sono ora rese come pill badge distinti.",
      "Layout e calcolo larghezze della tabella logica aggiornati per integrare i badge senza sovrapposizioni.",
    ],
  },
  {
    version: "4.3.1",
    date: "2026-05-21",
    updates: [
      "Versione applicativa aggiornata alla release 4.3.1.",
      "Diagnostica canvas ora controllabile: gli indicatori di warning/error possono essere nascosti senza disattivare la validazione.",
      "Identificatori esterni renderizzati con cornice dedicata sull'entita, marker coerenti per parti importate/locali e tooltip sulle parti importate.",
      "Routing degli identificatori esterni migliorato con percorsi aperti che privilegiano i lati marcati ed evitano segmenti superflui.",
      "Bloccata la creazione di attributi composti annidati: gli attributi figli di un composto non possono diventare a loro volta composti.",
      "Aggiunti test di regressione per routing degli identificatori esterni, validazione dei path e attributi composti annidati.",
    ],
  },
  {
    version: "4.3",
    date: "2026-05-19",
    updates: [
      "Versione applicativa aggiornata alla release 4.3.",
      "Ruoli per le associazioni ad anello: gestione dedicata e validazioni per ruoli distinti.",
      "Geometria connector migliorata per collegamenti multipli/loop e label role separati.",
      "Identificatori esterni: layout importati/misti piu stabile, grouping path e marker locali coerenti.",
      "Traduzione generalizzazioni: regole collapse-up con attributo Type e substitution con relazioni IS.",
      "Validazioni ERS: warning su relazioni n-arie con cardinalita massima 1.",
      "Persistenza: ruoli dei connector ricorsivi preservati in ERS e file progetto.",
    ],
  },
  {
    version: "4.2",
    date: "2026-05-11",
    updates: [
      "Versione applicativa aggiornata alla release 4.2.",
      "Nuovo sistema modale Studio per menu comandi, scorciatoie, changelog e informazioni applicative.",
      "Vista Translation/Restructuring riallineata allo stile designER: toolbar verticale compatta, titolo RESTRUCTURING, evidenziazioni rosse coerenti, generalizzazioni piu leggibili e comando Notes integrato.",
      "Vista SQL/Schema aggiornata in stile designER con titolo SCHEMA, comando Show separato, toolbar normale/modifica, tabelle relazionali pulite, PK/FK sottolineate, frecce FK e menu Type compatto.",
      "Rimosso il pannello legacy 'Tipo SQL colonna': la modifica dei tipi SQL avviene tramite menu contestuale dalla toolbar schema.",
      "Persistenza schema logico corretta: rename, ordine colonne e metadati SQL manuali restano salvati quando si torna alla vista ER o si riallinea il workspace logico.",
      "Generalizzazioni ISA rafforzate con gruppi dedicati, cleanup, serializzazione coerente, validazioni aggiuntive e layout triangolo/bus piu stabile.",
      "Rendering canvas e toolbar rifiniti: placement preview, cardinalita, azioni contestuali, validazioni e riduzione degli elementi UI ridondanti.",
      "Vista Logica migliorata con bulk fix, gestione stage Translation/Schema, layout tabelle piu leggibile e highlighting SQL per entita e relazioni.",
      "Test di regressione estesi su ERS, generalizzazioni, workflow logico, relazione/schema SQL e persistenza progetto.",
    ],
  },
  {
    version: "4.1",
    date: "2026-04-30",
    updates: [
      "Versione applicativa aggiornata alla release 4.1.",
      "Pannelli Review, Code e Notes ripuliti con empty state compatti e meno testo ridondante.",
      "Card di traduzione e schema logico rese piu leggibili: regola e descrizione breve, senza output e dettagli ingombranti.",
      "Toolbar canvas collassata migliorata: shortcut centrati, testo nascosto e nessuna invasione del canvas.",
      "Inspector e impostazioni shape nel pannello Canvas resi piu compatti e stabili su larghezze ridotte.",
      "Pannelli laterali Traduzione e Schema logico migliorati quando vengono nascosti: riapertura compatta senza pannello vuoto.",
    ],
  },
  {
    version: "4.0",
    date: "2026-04-26",
    updates: [
      "Versione applicativa aggiornata alla release 4.0.",
      "Metadata, documentazione e riferimenti UI allineati alla nuova versione principale, senza rimuovere lo storico delle release precedenti.",
      "Nuova UI per l'applicazione: restyling completo con design moderno, layout a 5 colonne, temi chiaro/scuro e interfaccia localizzata in italiano, inglese e albanese.",
      "Rifacimento completo del workspace della vista Logica, integrandolo nativamente come first-class citizen della UI a 5 colonne, con miglioramenti significativi all'usabilita, alla flessibilita del layout e alla coerenza visiva dei diagrammi logici.",
    ],
  },
  {
    version: "3.9",
    date: "2026-04-20",
    updates: [
      "Versione applicativa aggiornata alla release 3.9.",
      "Ripristinata la Vista Logica come workflow guidato manuale post-traduzione, con step, item pending e regole esplicite nel nuovo LogicalTranslationWorkspace.",
      "Rimossa la conversione logica completa automatica in ingresso Vista Logica: il modello viene costruito in modo incrementale solo tramite decisioni utente.",
      "Separazione responsabilita consolidata: gerarchie ISA e attributi composti restano nella Vista Traduzione; la Vista Logica non ripropone piu lo step generalizzazioni.",
      "Aggiornato refresh/save-load del workspace logico per preservare decisioni manuali valide e invalidare in modo sicuro le decisioni legacy non coerenti.",
      "Aggiunti test di regressione sul workflow logico manuale (assenza auto-conversione, aggiornamenti incrementali, gestione legacy) e aggiornato il pacchetto test npm.",
    ],
  },
  {
    version: "3.8",
    date: "2026-04-16",
    updates: [
      "Versione applicativa aggiornata alla release 3.8.",
      "Introdotto il formato progetto .ersp con salvataggio e ripristino di workspace, vista corrente e viewport, piu migrazione compatibile dei backup JSON legacy versione 2.",
      "Aggiunto supporto i18n con interfaccia localizzata in italiano, inglese e albanese e catalogo centralizzato per i testi comuni della UI.",
      "Serializzazione e parsing ERS allineati alla regola ID = nome: export e lettura usano il nome corrente delle shape invece degli id legacy casuali.",
      "La rinomina delle shape aggiorna anche id e riferimenti collegati, evitando incoerenze nello schema ER esportato.",
      "Refactor completo del workflow in tre viste distinte: ER originale, Traduzione ER->ER guidata e vista Logica finale generata solo dall'ER tradotto.",
      "Nuovo translation workspace persistente con pipeline bloccante: prima generalizzazioni ISA, poi attributi composti, con motivazioni esplicite dei blocchi.",
      "La traduzione non genera piu direttamente tabelle logiche: generalizzazioni e attributi composti vengono risolti in un diagramma ER intermedio coerente.",
      "Vista Logica rifinita in stile designER/classico: tabelle rettangolari monocromatiche, nomi centrati, PK sottolineate e collegamenti FK ortogonali piu sobri.",
    ],
  },
  {
    version: "3.7",
    date: "2026-04-15",
    updates: [
      "Versione applicativa aggiornata alla release 3.7.",
      "Restyling del workspace della vista Logico integrato nativamente come first-class citizen della UI a 5 colonne.",
      "Risolto il problema di flessibilità verticale nel pannello Canvas Logico che limitava la sua visualizzazione (rimosso blocco fisso da 150px).",
      "Tradotte in italiano le opzioni dei vincoli e coperture ISA all'interno dell'inspector.",
      "Rifinito il rendering dei badge ISA con colori piu tenui e testo piu leggibile, per migliorare l'estetica e la chiarezza visiva.",
      "Nuovo aggiornamento della vista Logica alla release 3.7, con miglioramenti significativi all'usabilita, alla flessibilita del layout e alla coerenza visiva dei diagrammi logici.",
    ],
  },
  {
    version: "3.6",
    date: "2026-04-14",
    updates: [
      "Versione applicativa aggiornata alla release 3.6.",
      "Layout identificatori interni composti rifattorizzato in geometria ortogonale con backbone comune e rami lineari.",
      "Routing curvo eliminato: posizione backbone calcolata automaticamente da bounding box entita e distribuzione attributi membri.",
      "Drag del backbone composito introdotto: gli attributi membri si muovono come gruppo coerente.",
      "Rendering ripulito: rimossi i collegamenti diagonali duplicati dei membri composti e introdotti stem ortogonali entita-backbone.",
      "Recompute coerente del composto durante move, add/remove membri e reload del diagramma.",
    ],
  },
  {
    version: "3.5",
    date: "2026-04-14",
    updates: [
      "Versione applicativa aggiornata alla release 3.5.",
      "Gestione cardinalita rivista: partecipazioni entity-relazione tipizzate e cardinalita attributo spostata sul nodo attributo.",
      "Utility cardinalita centralizzate per normalizzazione e risoluzione etichette dei collegamenti.",
      "Inspector relazione semplificato: rinomina tramite azione rapida senza campo nome dedicato.",
      "Documentazione e governance allineate con SECURITY, LICENSE, CONTRIBUTING e CHANGELOG.",
    ],

  },
  {
    version: "3.4",
    date: "2026-04-14",
    updates: [
      "Nuova sintassi ERS per identificatori interni composti: `identifier att1, att2` con supporto a gruppi multipli distinti nella stessa entita.",
      "Compatibilita retroattiva mantenuta: il parser continua ad accettare la forma legacy `composite att1, att2`.",
      "Drag migliorato: spostando una relazione si spostano insieme anche gli attributi collegati, mantenendo comunque il drag singolo degli attributi.",
      "Versione applicativa e documentazione allineate alla release 3.4.",
    ],
  },
  {
    version: "3.3",
    date: "2026-04-13",
    updates: [
      "Refactor identificatori interni: ogni entita puo avere piu identificatori interni tramite struttura dedicata `internalIdentifiers`.",
      "Nuova sezione UI 'Identificatori interni' con flusso completo crea/modifica/elimina e modal di selezione attributi eleggibili.",
      "Filtraggio attributi consolidato: esclusi multivalore, identificatori semplici e attributi gia usati in altri identificatori interni.",
      "Sincronizzazione retro-compatibile tra stato moderno e flag legacy attributo (`isIdentifier`, `isCompositeInternal`) con normalizzazione automatica.",
      "Coerenza flussi legacy/nuovi: i semplici creati da controlli storici vengono allineati nella lista identificatori interni e viceversa.",
      "Rendering canvas corretto per composti multipli: identificatori interni composti distinti sulla stessa entita non vengono piu fusi in un unico backbone.",
      "Modal identificatori reso robusto in pannello embedded tramite portal su `document.body`, eliminando clipping e scroll anomalo.",
      "Nuova guardia cardinalita: gli attributi usati in identificatori interni (semplici o composti) non espongono cardinalita opzionale e i valori non validi vengono rimossi automaticamente.",
      "Versione applicativa e documentazione allineate alla release 3.3.",
    ],
  },
  {
    version: "3.2.0",
    date: "2026-04-09",
    updates: [
      "Validazione semantica degli identificatori esterni centralizzata nel dominio con invalidazione automatica quando i legami richiesti non sono piu coerenti.",
      "Sincronizzazione stato/UI sugli identificatori esterni invalidi: cleanup dei metadati residui e avvisi specifici mostrati all'utente durante l'editing.",
      "Routing grafico degli identificatori esterni rifinito su junction finali reali, con eliminazione di micro-stub e migliore leggibilita dei raccordi.",
      "Drag entita esteso agli attributi collegati (inclusi attributi identificanti e composti interni) per mantenere la struttura durante lo spostamento.",
      "Creazione elementi con identita separate: ID tecnico progressivo (`entity1`, `attribute1`, `relationship1`) distinto dal nome visuale (`ENTITA1`, `ATTRIBUTO1`, `RELAZIONE1`).",
      "Versione applicativa, metadata e documentazione allineati alla release 3.2.0.",
    ],
  },
  {
    version: "3.1.0",
    date: "2026-04-07",
    updates: [
      "UI contestuale rifinita: onboarding guidato alla prima apertura con step reali (crea entita, collega, rinomina).",
      "Toolbar piu focalizzata: azioni contestuali mostrate in base alla selezione anche con pannello strumenti chiuso.",
      "Rimosse le azioni duplicate tra barra contestuale e inspector embedded, con meno rumore durante l'editing.",
      "Messaggi di errore uniformati nel formato unico: cosa e successo, perche, e come risolvere in una sola frase.",
      "Export PNG corretto: risoluzione esplicita delle variabili CSS del canvas per evitare immagini nere o incomplete.",
      "Introdotti autosalvataggio locale e ripristino sessione automatico dopo chiusura o crash.",
      "Ripristino workspace esteso a diagramma ER, vista logica, viewport/selezioni, bozza ERS e stato pannelli.",
    ],
  },
  {
    version: "3.0.0",
    date: "2026-03-29",
    updates: [
      "Vista Logica riattivata nel workspace con switch dedicato ER/Logica in testata.",
      "Generazione automatica del modello relazionale dal diagramma ER con rendering tabelle, PK/FK e riferimenti.",
      "Flusso operativo logico completo: rigenera modello, auto-layout e adatta al viewport direttamente dalla barra azioni.",
    ],
  },
  {
    version: "2.5.2",
    date: "2026-03-29",
    updates: [
      "Release allineata alla richiesta corrente: workspace centrato su diagramma ER senza introdurre la vista logica in UI.",
      "Confermata la coerenza dell'identificatore esterno come attributo dell'entita anche nelle validazioni.",
      "Rifinito il rendering dei marker degli identificatori esterni composti (punti e raccordi) con geometria piu pulita.",
    ],
  },
  {
    version: "2.5.1",
    date: "2026-03-27",
    updates: [
      "Toast workspace unificati in overlay: non spostano piu il layout e sostituiscono i vecchi messaggi inline nel canvas.",
      "Esteso il flusso notifiche ai messaggi guidati di collegamento, alle rimozioni/eliminazioni e ai warning selezionati dall'inspector.",
      "Lista validazioni resa attivabile: cliccando un warning o un errore nell'inspector viene mostrato subito il relativo toast.",
      "Menu Workspace corretto come pannello floating ancorato al pulsante, senza clipping o testi schiacciati nell'header.",
      "Workspace laterale migliorato: rail strumenti piu largo di default e pannelli laterali ridimensionabili con drag handle e reset rapido.",
    ],
  },
  {
    version: "2.4.3",
    date: "2026-03-27",
    updates: [
      "Refactor geometria connector: anchor logico spostato al centro del bounding box per il calcolo di direzione, lato dominante e routing iniziale.",
      "Routing ortogonale reso piu coerente: i trunk paralleli si spostano senza cambiare lato di uscita o ingresso dei nodi.",
      "Clipping finale sul bordo separato dalla logica di routing, con linee piu bilanciate durante drag, move e resize.",
      "Toast workspace rifatti in overlay: non spostano il layout, si chiudono da soli e sono riservati ad avvisi ed errori.",
    ],
  },
  {
    version: "2.4.2",
    date: "2026-03-25",
    updates: [
      "Accessibilita tastiera estesa al canvas: focus su nodi e collegamenti, selezione da tastiera, spostamento con frecce e rinomina con Invio.",
      "Aggiunta protezione dalle modifiche non salvate su home, guida codice, nuovo diagramma e import JSON/ERS, oltre alla guardia prima di chiudere la pagina.",
      "Notifiche migliorate con toast di successo e azione rapida Annulla dove possibile; creazione collegamenti resa piu chiara con preview visiva ed Esc per annullare.",
    ],
  },
  {
    version: "2.4",
    date: "2026-03-22",
    updates: [
      "Aggiunte entita deboli dedicate con doppio rettangolo, configurabili dall'Inspector e serializzate in ERS con la flag weak.",
      "Aggiunti attributi composti con nodo principale ovale, supporto ERS tramite multivalued e numero arbitrario di sotto-attributi collegabili.",
      "Generalizzazioni estese con vincoli ISA disjoint/overlap e total/partial, disponibili su canvas, Inspector e modalita codice.",
    ],
  },
  {
    version: "2.3",
    date: "2026-03-19",
    updates: [
      "Modalita codice aggiornata con sincronizzazione live: il diagramma si aggiorna automaticamente durante la scrittura del codice ERS valido.",
      "Rimosso il pulsante Applica al diagramma e semplificato il flusso operativo del pannello codice.",
      "Informazioni e guida allineate al nuovo comportamento live sync e alla versione 2.3.",
    ],
  },
  {
    version: "2.2",
    date: "2026-03-19",
    updates: [
      "Aggiornata la sezione Informazioni con stato notazione ER portato a v2.2 e descrizioni piu precise dei comandi principali.",
      "Allineata la versione applicativa e le etichette versione tra header, pagina iniziale e finestre informative.",
      "Migliorata la leggibilita del changelog con nuova voce di rilascio 2.2.",
    ],
  },
  {
    version: "2.1",
    date: "2026-03-19",
    updates: [
      "Aggiornata la sezione Informazioni con indicazioni piu chiare su strumenti, flusso di lavoro e stato della notazione ER.",
      "Allineata la versione applicativa e la scheda rilascio della pagina iniziale alla nuova versione 2.1.",
      "Migliorata la comunicazione delle funzionalita disponibili e dei prossimi elementi ER in roadmap.",
    ],
  },
  {
    version: "2.0",
    date: "2026-03-13",
    updates: [
      "Nuovo strumento Cancella (shortcut X): elimina con click diretto nodi e collegamenti.",
      "Rendering identificatore esterno migliorato: linea coerente, routing anti-collisione e rispetto della posizione relativa degli elementi.",
      "Interazione completa identificatore esterno: trascinamento linea e pallina con offset persistenti.",
      "Rimozione identificatore esterno dedicata: con Delete sul simbolo oppure dal pulsante nell'Inspector, senza eliminare attributi.",
      "Validazioni cardinalita identificatore esterno aggiornate: richiesto (1,1) sul lato dipendente, nessun vincolo sull'altro lato.",
    ],
  },
  {
    version: "1.1",
    date: "2026-03-13",
    updates: [
      "Attributi con linea sempre dritta e aggancio corretto al bordo di entita/associazione.",
      "Migliorato posizionamento etichetta attributo sul lato opposto alla direzione del collegamento.",
      "Cardinalita configurabile da elenco (niente input libero), con supporto opzionale anche sui collegamenti attributo.",
      "Identificatore composto interno configurabile manualmente selezionando 2+ attributi.",
      "Blocco regola: un attributo nel composto interno non puo diventare identificatore singolo.",
      "Aggiunto identificatore esterno su associazione con controllo cardinalita obbligatorie 1:1 e 0:1.",
    ],
  },
  {
    version: "1.0",
    date: "2026-03-13",
    updates: [
      "Rinominato il menu Aiuto in Informazioni.",
      "Aggiunto il pulsante Novita con storico aggiornamenti.",
      "Introdotto versioning applicazione: ER Studio 1.0.",
      "Migliorata la resa attributi: cardinalita opzionale, etichetta dinamica e connessioni lineari.",
      "Aggiunto identificatore composto interno configurabile manualmente selezionando 2+ attributi.",
    ],
  },
];
