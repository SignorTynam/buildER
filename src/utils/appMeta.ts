export const APP_NAME = "ER Studio";
export const APP_VERSION = "4.2";
export const APP_TITLE = `${APP_NAME}`;

export interface AppChangelogEntry {
  version: string;
  date: string;
  updates: string[];
}

export const APP_CHANGELOG: AppChangelogEntry[] = [
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
