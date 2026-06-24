# Relazione finale di tirocinio: sviluppo e consolidamento di buildER

Studente: Alion Emini  
Tutor: Prof.ssa Alessandra Lumini  
Università: Università di Bologna  
Corso di laurea: [Corso di laurea da completare]  
Matricola: [Matricola da completare]  
Anno accademico: [Anno accademico da completare]  
Periodo del tirocinio: [Periodo del tirocinio da completare]  
Ore/CFU: [Ore/CFU da completare]  
Struttura ospitante: [Struttura ospitante da completare]

## Sommario

La presente relazione descrive il tirocinio universitario svolto sul progetto buildER, un'applicazione web dedicata alla progettazione, visualizzazione, traduzione ed esportazione di schemi Entity-Relationship e schemi logici. Il lavoro, supervisionato dalla Prof.ssa Alessandra Lumini in qualità di tutor, ha riguardato il consolidamento dello strumento dal punto di vista funzionale, tecnico e didattico.

La relazione presenta gli obiettivi del tirocinio, il contesto applicativo di buildER, le principali tecnologie utilizzate, l'organizzazione architetturale del sistema e le funzionalità sviluppate o rafforzate. Vengono inoltre descritti i test, le verifiche svolte, i miglioramenti introdotti, il ruolo della tutor nel percorso e le competenze tecniche e metodologiche acquisite.

## 1. Introduzione

Il presente elaborato costituisce la relazione finale del tirocinio universitario dedicato al progetto buildER. Il progetto riguarda un'applicazione web pensata per supportare la progettazione di basi di dati attraverso la costruzione di schemi Entity-Relationship, la loro visualizzazione grafica, la traduzione verso schemi logici e l'esportazione dei risultati.

Il tirocinio è stato supervisionato dalla Prof.ssa Alessandra Lumini, tutor del percorso, che ha fornito indicazioni utili per orientare il lavoro verso chiarezza progettuale, correttezza concettuale e qualità complessiva dello strumento. La supervisione ha contribuito a mantenere un equilibrio tra aspetti tecnici, esigenze didattiche e usabilità dell'applicazione.

buildER si colloca nell'ambito della progettazione di basi di dati, un tema centrale nei percorsi universitari di informatica. La costruzione di uno schema concettuale richiede la capacità di individuare entità, relazioni, attributi, cardinalità e vincoli; la successiva trasformazione verso uno schema logico richiede invece regole coerenti per rappresentare tabelle, colonne, chiavi primarie, chiavi esterne e vincoli relazionali.

La relazione descrive il percorso svolto durante il tirocinio, presentando obiettivi, tecnologie, architettura, funzionalità principali, test, miglioramenti, competenze acquisite e possibili sviluppi futuri.

## 2. Obiettivi del tirocinio

L'obiettivo generale del tirocinio è stato contribuire allo sviluppo e al consolidamento di buildER come applicazione web per la modellazione di schemi ER e per il supporto alla loro trasformazione in schemi logici. Il lavoro ha richiesto di mantenere un equilibrio tra correttezza concettuale, qualità tecnica e usabilità, poiché uno strumento destinato anche all'uso didattico deve essere comprensibile, affidabile e coerente con i concetti che intende rappresentare.

| Obiettivo | Descrizione |
|---|---|
| Correttezza concettuale | Rappresentare in modo coerente entità, relazioni, attributi, cardinalità, identificatori e generalizzazioni. |
| Traduzione ER-logico | Supportare il passaggio da schema concettuale a schema logico con tabelle, colonne, chiavi e vincoli. |
| Leggibilità grafica | Migliorare disposizione degli elementi, label, collegamenti e resa degli schemi esportati. |
| Usabilità | Rendere l'interfaccia chiara tramite toolbar, pannelli, modali, scorciatoie e flussi guidati. |
| Esportazione e salvataggio | Produrre output riutilizzabili e conservare i progetti tramite formato `.ersp`. |
| Stabilità e test | Verificare le parti critiche tramite test unitari, test di integrazione e test end-to-end. |
| Valore didattico | Rendere più comprensibile il rapporto tra modello concettuale, modello logico e SQL. |

Dal punto di vista formativo, il tirocinio ha permesso di lavorare su un progetto reale, nel quale ogni scelta tecnica aveva conseguenze sulla comprensibilità dello strumento.

## 3. Il progetto buildER

buildER è un'applicazione web single-page per la modellazione di schemi Entity-Relationship in stile Chen. L'utente può costruire diagrammi ER su un canvas SVG, aggiungendo entità, relazioni, attributi, cardinalità, identificatori e generalizzazioni ISA. L'applicazione consente inoltre di passare alla vista logica, nella quale lo schema viene rappresentato attraverso tabelle, colonne, chiavi primarie, chiavi esterne e vincoli.

Il progetto è destinato principalmente a un contesto didattico e universitario. Può essere utile agli studenti che devono esercitarsi nella progettazione di basi di dati e ai docenti che vogliono mostrare esempi, discutere schemi o evidenziare il passaggio dal modello concettuale al modello logico.

Il flusso principale dell'applicazione parte dall'editor ER. Il canvas SVG permette una rappresentazione vettoriale degli elementi e supporta operazioni come selezione, spostamento, zoom, pan, duplicazione, allineamento, annulla e ripeti. Accanto alla vista grafica è presente anche una rappresentazione testuale ERS, sincronizzata con il diagramma.

La trasformazione verso lo schema logico è uno degli aspetti più significativi del progetto. buildER adotta un percorso esplicito: alcune strutture, come generalizzazioni e attributi composti, vengono trattate in una fase di trasformazione ER-ER; successivamente viene costruito il modello logico, con workflow manuale e incrementale.

Il repository conferma inoltre la presenza di generazione SQL, esportazione in PNG, SVG e JPEG, salvataggio e caricamento in formato `.ersp`, reverse engineering SQL e localizzazione in italiano, inglese e albanese.

[Inserire qui uno screenshot della schermata principale di buildER]

## 4. Analisi dei requisiti

### Requisiti funzionali

I requisiti funzionali individuati riguardano le operazioni che l'applicazione deve mettere a disposizione dell'utente. Il primo requisito è la creazione degli elementi ER principali: entità, relazioni, attributi e collegamenti. A questo si affiancano le operazioni di modifica, cancellazione, rinomina, selezione, spostamento e gestione della disposizione grafica.

Un secondo gruppo di requisiti riguarda la rappresentazione dei vincoli. L'applicazione deve permettere di definire cardinalità, identificatori interni, identificatori esterni, identificatori misti e generalizzazioni ISA. La traduzione verso lo schema logico costituisce un requisito centrale, poiché il sistema deve produrre tabelle, colonne, chiavi primarie, chiavi esterne e vincoli.

Rientrano tra i requisiti funzionali anche salvataggio e caricamento dei progetti, esportazione in PNG, SVG e JPEG, localizzazione dell'interfaccia e reverse engineering SQL.

### Requisiti non funzionali

I requisiti non funzionali riguardano la qualità complessiva dell'applicazione. Il primo aspetto è l'usabilità: l'utente deve poter comprendere gli strumenti disponibili, interagire con il canvas e ricevere feedback chiari.

La leggibilità grafica è un requisito altrettanto importante. Diagrammi con label sovrapposte, collegamenti poco chiari o spazi vuoti eccessivi negli export risultano meno utili in un contesto didattico. Altri requisiti riguardano stabilità, compatibilità, responsive, manutenibilità e testabilità.

## 5. Tecnologie utilizzate

Il progetto è sviluppato con TypeScript, React e Vite. TypeScript consente di definire in modo esplicito le strutture dati dell'applicazione, come nodi, collegamenti, diagrammi, modelli logici, tabelle e file progetto. React è utilizzato per costruire l'interfaccia utente attraverso componenti, mentre Vite fornisce l'ambiente di sviluppo, il dev server e la build della single-page application.

Il canvas usa SVG, tecnologia adatta alla rappresentazione di diagrammi vettoriali. Gli stili sono gestiti tramite CSS, mentre la libreria `lucide-react` supporta il sistema di icone dell'interfaccia. Per la verifica del progetto sono usati `tsx`, per i test TypeScript, e Playwright, per i test end-to-end nel browser.

| Tecnologia | Ruolo nel progetto |
|---|---|
| TypeScript | Tipizzazione del dominio applicativo, dei modelli ER/logici e delle funzioni di trasformazione. |
| React | Realizzazione dell'interfaccia utente e dei workspace interattivi. |
| Vite | Dev server, build e preview dell'applicazione web. |
| CSS | Layout, responsive, pannelli, modali, toolbar e stile del canvas. |
| SVG | Rendering vettoriale di diagrammi, nodi, collegamenti e label. |
| npm | Gestione delle dipendenze e degli script di sviluppo, test e build. |
| tsx | Esecuzione dei test TypeScript. |
| Playwright | Test end-to-end dei flussi principali nel browser. |
| Git/GitHub | Versionamento del progetto e organizzazione del repository. |
| GitHub Actions e Pages | Automazione della build e pubblicazione della build statica. |
| lucide-react | Icone dell'interfaccia. |

## 6. Architettura e progettazione

L'architettura di buildER è organizzata come applicazione web a componenti. Il file `src/App.tsx` svolge il ruolo di orchestratore principale: coordina stato del documento, viste, modali, comandi utente, sincronizzazione ERS, undo/redo e passaggio delle proprietà ai diversi workspace.

La cartella `src/canvas` contiene la logica di rendering e interazione del diagramma ER su SVG. La cartella `src/components` raccoglie componenti applicativi e condivisi. Le cartelle `src/inspector` e `src/toolbar` gestiscono rispettivamente la modifica delle proprietà degli elementi e gli strumenti disponibili nel canvas.

Le cartelle `src/translation` e `src/logical` sono dedicate al percorso di trasformazione e alla gestione dello schema logico. La localizzazione è concentrata in `src/i18n`, mentre `src/types` definisce i contratti TypeScript condivisi. La cartella `src/utils` contiene la logica pura e testabile: parser, serializzazione, validazione, layout, export, traduzione logica, SQL reverse e gestione dei file progetto.

Schema logico dell'organizzazione:

```text
Interfaccia utente
        ↓
Gestione dello stato
        ↓
Modello ER
        ↓
Traduzione logica
        ↓
Esportazione / salvataggio
```

## 7. Funzionalità sviluppate e consolidate

### Editor ER

L'editor ER rappresenta il nucleo dell'applicazione. L'utente può creare entità, relazioni e attributi, collegarli tra loro, indicare cardinalità e modellare vincoli. Il canvas supporta selezione, spostamento, zoom, pan, duplicazione, allineamento e undo/redo.

### Identificatori, vincoli e generalizzazioni

Gli identificatori interni, esterni e misti costituiscono una parte rilevante del lavoro. La loro corretta gestione è fondamentale perché incide sia sulla validità dello schema ER sia sulla successiva traduzione verso il modello logico. Le generalizzazioni ISA sono supportate con vincoli specifici, come total/partial e disjoint/overlap.

### Traduzione verso lo schema logico

La traduzione verso lo schema logico è organizzata come processo guidato. Il sistema prevede una pipeline ER-ER per risolvere strutture come generalizzazioni e attributi composti. Successivamente, il workspace logico permette di costruire il modello relazionale attraverso decisioni più esplicite.

### Esportazione, salvataggio e caricamento

buildER supporta l'esportazione in PNG, SVG e JPEG. Il changelog documenta miglioramenti specifici relativi a bounding box reale dello schema, riduzione dello spazio vuoto, sfondo trasparente per PNG e SVG, sfondo bianco per JPEG e conservazione degli stili nello SVG standalone. Il salvataggio avviene tramite formato `.ersp`.

### Interfaccia e localizzazione

L'interfaccia include toolbar, pannelli, modali, command menu, loading screen e scorciatoie da tastiera. La localizzazione in italiano, inglese e albanese è integrata nell'applicazione tramite dizionari e selettore lingua.

[Inserire qui uno screenshot della vista logica o dell'export]

## 8. Test, verifica e miglioramenti

La qualità di buildER è stata verificata tramite test unitari, test di integrazione e test end-to-end. I test nella cartella `test/` coprono parser ERS, serializzazione, traduzione ER, traduzione logica, identificatori, layout, export, file progetto, SQL reverse, localizzazione e sessione. I test Playwright nella cartella `tests/e2e/` verificano flussi reali nel browser, come loading screen e cambio lingua.

| Area testata | Tipo di verifica | Scopo |
|---|---|---|
| Parsing e serializzazione ERS | Test unitari e di integrazione | Verificare la coerenza tra rappresentazione testuale e diagramma. |
| Formato `.ersp` | Test di integrazione | Controllare salvataggio, caricamento, compatibilità e migrazione legacy. |
| Traduzione ER-ER | Test unitari | Verificare generalizzazioni, attributi composti e decisioni di traduzione. |
| Vista logica | Test unitari e di integrazione | Controllare tabelle, chiavi, foreign key, vincoli e workflow manuale. |
| Export | Test unitari | Verificare PNG, SVG, JPEG, sfondi, bounds e stili. |
| Layout | Test unitari | Evitare sovrapposizioni di attributi, cardinalità, edge label e label FK. |
| SQL reverse | Test unitari e di integrazione | Controllare parser SQL, modello logico, diagramma ER e layout generato. |
| Localizzazione | Test unitari ed E2E | Verificare dizionari, selettore lingua e testi dell'interfaccia. |

I miglioramenti introdotti hanno riguardato in particolare layout, label, export, sfondi, compatibilità dei salvataggi, responsive, localizzazione e stabilità.

## 9. Supervisione della tutor e competenze acquisite

La Prof.ssa Alessandra Lumini ha svolto il ruolo di tutor del tirocinio, supervisionando il percorso e fornendo indicazioni utili per orientare il lavoro. Il suo contributo ha aiutato a mantenere l'attenzione non solo sulla realizzazione tecnica, ma anche sulla chiarezza concettuale, sulla correttezza degli schemi, sulla leggibilità grafica e sull'utilità didattica dello strumento.

Le indicazioni della tutor hanno contribuito a definire le priorità del progetto. In particolare, hanno favorito un'attenzione costante alla coerenza tra schema ER e schema logico, alla semplicità dell'interfaccia e alla necessità di mantenere il codice organizzato e verificabile. Non vengono riportate citazioni dirette; il riferimento alla tutor è formulato come sintesi del ruolo di supervisione svolto durante il tirocinio.

### Competenze tecniche

Il tirocinio ha permesso di consolidare competenze nello sviluppo web con React, TypeScript e Vite, nella gestione di canvas SVG e nella modellazione di strutture dati per schemi ER e logici. Sono state inoltre rafforzate competenze su esportazione immagini, salvataggio, serializzazione, generazione SQL, test software, Git e debugging.

### Competenze metodologiche e trasversali

Sul piano metodologico, il lavoro ha richiesto autonomia, problem solving, pianificazione e revisione progressiva. Il confronto con la tutor ha favorito la capacità di ricevere feedback, trasformarlo in priorità operative e comunicare in modo più chiaro le scelte progettuali.

## 10. Conclusioni e sviluppi futuri

Il tirocinio ha portato al consolidamento di un progetto web articolato, capace di supportare diverse fasi della progettazione di basi di dati. buildER integra editor ER, vista logica, esportazione, salvataggio, localizzazione, test e funzionalità di reverse engineering SQL. Questi risultati mostrano un'evoluzione significativa dello strumento e ne confermano il possibile valore didattico.

L'esperienza ha avuto anche un valore formativo rilevante. Il progetto ha richiesto di lavorare su un'applicazione reale, con molte parti interdipendenti, e di collegare le scelte tecniche agli obiettivi di chiarezza, correttezza e usabilità. La supervisione della Prof.ssa Alessandra Lumini ha contribuito a mantenere questo orientamento, aiutando a considerare il software non solo come prodotto tecnico, ma come strumento di apprendimento.

Restano alcuni limiti realistici. Il layout automatico può essere ulteriormente migliorato per schemi molto grandi o densi. Il parser SQL, pur utile, non mira a coprire l'intera grammatica dei diversi dialetti. L'accessibilità e la documentazione utente possono essere ampliate, così come i test end-to-end. Inoltre, funzionalità collaborative online non risultano presenti e potrebbero rappresentare un'evoluzione futura.

Tra gli sviluppi futuri si possono indicare l'introduzione di esempi didattici integrati, una guida utente più completa, il miglioramento dell'accessibilità, l'ampliamento dei costrutti EER, il rafforzamento del parser SQL, ulteriori test e un layout automatico ancora più robusto. In conclusione, il tirocinio ha permesso di consolidare competenze tecniche e metodologiche, affrontando un progetto significativo per la progettazione di basi di dati.

## Bibliografia e sitografia essenziale

- Peter P. Chen, *The Entity-Relationship Model: Toward a Unified View of Data*, ACM Transactions on Database Systems, 1976.
- Ramez Elmasri, Shamkant B. Navathe, *Fundamentals of Database Systems*, Pearson.
- Documentazione ufficiale React: https://react.dev/
- Documentazione ufficiale TypeScript: https://www.typescriptlang.org/docs/
- Documentazione ufficiale Vite: https://vite.dev/guide/
- Documentazione ufficiale Playwright: https://playwright.dev/
