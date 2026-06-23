# Fase 2 - Outline relazione finale di tirocinio

## Titolo provvisorio

1. Relazione finale di tirocinio: sviluppo dell'applicazione buildER per la progettazione di schemi Entity-Relationship
2. Sviluppo e miglioramento di buildER: applicazione web per la modellazione concettuale e logica di basi di dati
3. Progettazione e sviluppo di buildER, strumento didattico per schemi ER e logici

## Copertina

La copertina dovra contenere:

- Universita di Bologna;
- corso di laurea;
- titolo della relazione;
- nome e cognome dello studente;
- matricola, se richiesta;
- nome tutor: Prof.ssa Alessandra Lumini;
- anno accademico;
- periodo del tirocinio;
- eventuale struttura ospitante;
- eventuale logo dell'Universita o del corso, se previsto dal template.

## Indice

Indice proposto:

1. Introduzione al tirocinio
2. Obiettivi del tirocinio e del progetto
3. Descrizione generale di buildER
4. Analisi dei requisiti e contesto d'uso
5. Tecnologie utilizzate
6. Architettura e progettazione del sistema
7. Implementazione delle funzionalita principali
8. Test, bug fixing e miglioramenti
9. Ruolo della tutor e competenze acquisite
10. Risultati finali, limiti e sviluppi futuri
11. Bibliografia e sitografia
12. Appendici eventuali

## Distribuzione delle 10 pagine

Copertina, indice, bibliografia e appendici non sono conteggiati nelle 10 pagine del corpo centrale.

| Pagina | Sezione | Contenuto principale | Output atteso |
|---|---|---|---|
| 1 | Introduzione al tirocinio | Contesto universitario, progetto buildER, tutor, finalita generale | Presentazione chiara del tirocinio e del tema affrontato |
| 2 | Obiettivi del tirocinio e del progetto | Obiettivo generale, obiettivi specifici, valore didattico | Quadro degli scopi del lavoro |
| 3 | Descrizione generale di buildER | Funzioni principali, utenti previsti, flusso ER/logico | Descrizione non solo tecnica, ma orientata al tirocinio |
| 4 | Analisi dei requisiti | Requisiti funzionali e non funzionali ricavati dal progetto | Collegamento tra bisogni, scelte e funzionalita |
| 5 | Tecnologie utilizzate | React, TypeScript, Vite, SVG, CSS, npm, Playwright, GitHub Actions | Tabella o paragrafi sulle tecnologie effettivamente usate |
| 6 | Architettura e progettazione del sistema | Struttura del repository, separazione moduli, flusso dati | Spiegazione ordinata dell'organizzazione del codice |
| 7 | Implementazione delle funzionalita principali | Modellazione ER, traduzione, schema logico, export, salvataggio, i18n | Sintesi delle parti implementate e migliorate |
| 8 | Test, bug fixing e miglioramenti | Test unitari, E2E, regressioni, problemi risolti | Dimostrazione dell'attenzione alla qualita |
| 9 | Ruolo della tutor e competenze acquisite | Supervisione Prof.ssa Lumini, feedback, competenze tecniche e trasversali | Valorizzazione del tirocinio come esperienza formativa |
| 10 | Risultati finali, limiti e sviluppi futuri | Stato finale, limiti noti, possibili estensioni | Chiusura critica e professionale |

## Pagina 1 - Introduzione al tirocinio

- Obiettivo della pagina: introdurre il tirocinio, il progetto buildER e il contesto universitario in cui e stato svolto.
- Contenuti da includere: nome del progetto, natura di applicazione web, ambito delle basi di dati, ruolo della Prof.ssa Alessandra Lumini come tutor, motivazione generale del lavoro.
- Concetti da non dimenticare: la relazione e una relazione di tirocinio, non una documentazione tecnica; il progetto ha una finalita formativa e didattica.
- Lunghezza indicativa: 1 pagina, 3-4 paragrafi.
- Tono: accademico, introduttivo, ordinato.
- Elementi visivi: nessuno obbligatorio; eventualmente logo buildER o screenshot iniziale se il template lo consente.
- Possibile frase iniziale: "Il tirocinio ha riguardato lo sviluppo e il consolidamento di buildER, un'applicazione web dedicata alla progettazione di schemi Entity-Relationship e alla loro traduzione verso schemi logici."
- Possibile frase finale: "La relazione descrive quindi il percorso svolto, le scelte progettuali adottate, le funzionalita realizzate e le competenze maturate durante l'esperienza."

## Pagina 2 - Obiettivi del tirocinio e del progetto

- Obiettivo della pagina: spiegare perche il progetto e stato svolto e quali obiettivi tecnici, didattici e formativi ha perseguito.
- Contenuti da includere: obiettivo generale, obiettivi specifici, attenzione a usabilita, correttezza concettuale, qualita del codice, esportazione e test.
- Concetti da non dimenticare: il tirocinio non consiste solo nello "sviluppare funzionalita", ma anche nel consolidare metodo, autonomia e capacita progettuale.
- Lunghezza indicativa: 1 pagina, con elenco puntato breve.
- Tono: chiaro e progettuale.
- Elementi visivi: eventuale tabella "Obiettivo - Risultato atteso".
- Possibile frase iniziale: "L'obiettivo generale del tirocinio e stato contribuire alla realizzazione di uno strumento web utile alla modellazione concettuale e logica di basi di dati."
- Possibile frase finale: "Questi obiettivi hanno guidato sia le scelte implementative sia il progressivo miglioramento dell'esperienza utente."

## Pagina 3 - Descrizione generale di buildER

- Obiettivo della pagina: presentare buildER dal punto di vista dell'utente e del contesto didattico.
- Contenuti da includere: modellazione ER, canvas SVG, toolbar, pannelli, salvataggio `.ersp`, export, schema logico, SQL reverse, localizzazione.
- Concetti da non dimenticare: lo strumento supporta la comprensione del passaggio da modello concettuale a modello logico.
- Lunghezza indicativa: 1 pagina.
- Tono: descrittivo, non pubblicitario.
- Elementi visivi: screenshot della schermata principale o di un diagramma ER.
- Possibile frase iniziale: "buildER si presenta come un ambiente di lavoro interattivo nel quale l'utente puo costruire e modificare diagrammi ER direttamente nel browser."
- Possibile frase finale: "La presenza di strumenti di esportazione e salvataggio rende inoltre il risultato utilizzabile in materiali didattici, relazioni o successive revisioni del progetto."

## Pagina 4 - Analisi dei requisiti

- Obiettivo della pagina: collegare le funzionalita implementate ai bisogni concreti del progetto.
- Contenuti da includere: requisiti funzionali e non funzionali.
- Requisiti funzionali da citare: creazione elementi ER, collegamenti, cardinalita, identificatori, generalizzazioni, traduzione logica, export, salvataggio/caricamento, SQL reverse, i18n.
- Requisiti non funzionali da citare: usabilita, leggibilita, manutenibilita, compatibilita dei file, responsive, testabilita, stabilita.
- Lunghezza indicativa: 1 pagina.
- Tono: analitico.
- Elementi visivi: tabella requisiti/funzionalita.
- Possibile frase iniziale: "L'analisi dei requisiti e stata orientata alla costruzione di uno strumento adatto sia alla modellazione interattiva sia alla revisione didattica degli schemi."
- Possibile frase finale: "La distinzione tra requisiti funzionali e non funzionali ha permesso di valutare il progetto non solo in termini di funzionalita disponibili, ma anche di qualita complessiva dell'esperienza."

## Pagina 5 - Tecnologie utilizzate

- Obiettivo della pagina: descrivere le tecnologie effettivamente usate nel repository e il loro ruolo.
- Contenuti da includere: React, TypeScript, Vite, CSS, SVG, npm, tsx, Playwright, Git/GitHub, GitHub Actions/GitHub Pages, lucide-react.
- Concetti da non dimenticare: spiegare perche ogni tecnologia e utile, senza trasformare la pagina in un elenco di dipendenze.
- Lunghezza indicativa: 1 pagina.
- Tono: tecnico ma accessibile.
- Elementi visivi: tabella "Tecnologia - Uso - Motivazione".
- Possibile frase iniziale: "Il progetto e stato realizzato con tecnologie web moderne, scelte per consentire un'interfaccia interattiva, una struttura tipizzata e un processo di build/test ripetibile."
- Possibile frase finale: "L'insieme di queste tecnologie ha reso possibile sviluppare un'applicazione web modulare, testabile e distribuibile come sito statico."

## Pagina 6 - Architettura e progettazione del sistema

- Obiettivo della pagina: spiegare come e organizzato il codice e quali principi architetturali emergono.
- Contenuti da includere: `src/App.tsx` come orchestratore, `src/canvas`, `src/components`, `src/inspector`, `src/toolbar`, `src/translation`, `src/logical`, `src/i18n`, `src/types`, `src/utils`.
- Concetti da non dimenticare: separazione tra UI e logica di dominio; utility pure e testabili; tipi condivisi; compatibilita dei file progetto.
- Lunghezza indicativa: 1 pagina.
- Tono: progettuale, con riferimenti ai moduli.
- Elementi visivi: piccolo schema a blocchi dell'architettura.
- Possibile frase iniziale: "L'architettura di buildER e organizzata come una single-page application nella quale l'interfaccia React coordina moduli di dominio TypeScript dedicati a parsing, validazione, layout, traduzione ed export."
- Possibile frase finale: "Questa organizzazione ha favorito una maggiore manutenibilita e ha reso possibile testare molte parti della logica senza dipendere direttamente dall'interfaccia grafica."

## Pagina 7 - Implementazione delle funzionalita principali

- Obiettivo della pagina: sintetizzare le parti realizzate o consolidate durante il progetto.
- Contenuti da includere: modellazione ER, identificatori, generalizzazioni, traduzione ER->ER, vista logica, export, salvataggio, SQL reverse, i18n.
- Concetti da non dimenticare: evidenziare i miglioramenti progressivi emersi dal changelog; non descrivere ogni funzione in dettaglio da manuale utente.
- Lunghezza indicativa: 1 pagina.
- Tono: descrittivo e selettivo.
- Elementi visivi: 1-2 screenshot, ad esempio canvas ER e schema logico.
- Possibile frase iniziale: "L'implementazione ha riguardato diverse aree dell'applicazione, con l'obiettivo di rendere coerente il percorso che va dalla costruzione dello schema ER alla produzione dello schema logico."
- Possibile frase finale: "Nel complesso, le funzionalita implementate mostrano un percorso di sviluppo orientato sia alla completezza del modello sia alla chiarezza d'uso."

## Pagina 8 - Test, bug fixing e miglioramenti

- Obiettivo della pagina: mostrare come e stata verificata la qualita del progetto.
- Contenuti da includere: test unitari/integrativi in `test/`, E2E Playwright in `tests/e2e/`, esempi di aree testate, bug/miglioramenti dal changelog.
- Concetti da non dimenticare: test di parsing/serializzazione, layout, export, sessione, i18n, SQL reverse, traduzione logica.
- Lunghezza indicativa: 1 pagina.
- Tono: professionale e concreto.
- Elementi visivi: tabella "Area testata - Tipo di test - Scopo".
- Possibile frase iniziale: "Una parte rilevante del lavoro ha riguardato la stabilizzazione dell'applicazione attraverso test di regressione e verifiche sui flussi principali."
- Possibile frase finale: "L'attivita di test ha quindi accompagnato lo sviluppo, riducendo il rischio di regressioni nelle aree piu delicate del progetto."

## Pagina 9 - Ruolo della tutor e competenze acquisite

- Obiettivo della pagina: valorizzare l'esperienza di tirocinio e il ruolo formativo della Prof.ssa Alessandra Lumini.
- Contenuti da includere: tutor come figura di supervisione, consigli metodologici, suggerimenti progettuali, confronto sulle priorita, competenze tecniche e trasversali.
- Concetti da non dimenticare: non inventare citazioni dirette; usare tono rispettoso e professionale; collegare il feedback della tutor a qualita, chiarezza, usabilita e correttezza.
- Lunghezza indicativa: 1 pagina.
- Tono: riflessivo, universitario, sobrio.
- Elementi visivi: nessuno necessario.

Bozza di paragrafo pronto:

> La Prof.ssa Alessandra Lumini ha ricoperto il ruolo di tutor del tirocinio, supervisionando l'andamento del progetto e fornendo indicazioni utili per orientare il lavoro. I suoi consigli hanno contribuito a definire le priorita, con particolare attenzione alla chiarezza dell'applicazione, alla qualita complessiva dell'interfaccia, all'usabilita dello strumento e alla correttezza concettuale degli schemi prodotti. Il confronto con la tutor ha inoltre aiutato a considerare il progetto non solo come esercizio tecnico, ma come strumento da rendere comprensibile e utile in un contesto didattico. Tale supervisione ha favorito lo sviluppo di competenze tecniche, legate alla progettazione e implementazione dell'applicazione, e di competenze metodologiche, legate alla pianificazione, alla revisione progressiva del lavoro e alla capacita di integrare feedback esterni.

- Possibile frase finale della pagina: "L'esperienza ha quindi contribuito sia al consolidamento di competenze tecniche sia alla maturazione di un approccio piu consapevole alla progettazione software."

## Pagina 10 - Risultati finali, limiti e sviluppi futuri

- Obiettivo della pagina: chiudere la relazione con una valutazione critica del risultato.
- Contenuti da includere: stato finale di buildER, risultati raggiunti, limiti noti, possibili sviluppi futuri.
- Risultati da citare: editor ER, schema logico, export, salvataggio, i18n, SQL reverse, test.
- Limiti da citare con prudenza: parser SQL non completo, attributi derivati e simboli EER specialistici non ancora coperti, possibili ulteriori miglioramenti su layout, accessibilita, documentazione utente e casi SQL avanzati.
- Sviluppi futuri possibili: ampliamento costrutti EER, maggiore copertura SQL, miglioramenti UI/accessibilita, esempi didattici, guide integrate, ulteriori test E2E.
- Lunghezza indicativa: 1 pagina.
- Tono: conclusivo e critico.
- Elementi visivi: nessuno obbligatorio.
- Possibile frase iniziale: "Al termine del tirocinio, buildER si presenta come un'applicazione web articolata, capace di supportare diverse fasi della progettazione di basi di dati."
- Possibile frase finale: "I possibili sviluppi futuri confermano che il progetto puo continuare a evolvere, mantenendo come riferimento la chiarezza didattica, la correttezza dei modelli e la qualita dell'esperienza utente."

## Bibliografia e sitografia

Da completare in base alle indicazioni del corso e del template Prism. Possibili riferimenti:

- manuali universitari di basi di dati;
- modello Entity-Relationship;
- modello relazionale;
- documentazione ufficiale React, TypeScript, Vite, Playwright;
- eventuale repository GitHub o sito pubblico del progetto.

## Appendici eventuali

Possibili appendici:

- esempi di schema ER realizzato con buildER;
- esempio di schema logico generato;
- esempio di export PNG/SVG/JPEG;
- esempio di file `.ersp`;
- elenco sintetico dei test;
- screenshot dell'interfaccia.
