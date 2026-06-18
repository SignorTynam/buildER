export const APP_NAME = "buildER";
export const APP_VERSION = "5.1";
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
      "Flusso guidato per identificatore esterno: si crea selezionando identificatore sorgente e poi entita/attributo destinazione.",
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
