# Fase 1 - Raccolta informazioni tirocinio

## 1. Dati generali del tirocinio

- Nome progetto: buildER.
- Tipo progetto: applicazione web single-page.
- Ambito: progettazione di basi di dati, con particolare attenzione a schemi Entity-Relationship in stile Chen e schemi logici/relazionali.
- Contesto: tirocinio universitario.
- Tutor: Prof.ssa Alessandra Lumini.
- Ruolo della tutor: supervisione del tirocinio, consigli metodologici, suggerimenti progettuali, orientamento sulle priorita, attenzione alla chiarezza concettuale e alla qualita complessiva del lavoro.
- Obiettivo generale del tirocinio: realizzare, migliorare e consolidare buildER come applicazione web per la modellazione di schemi ER, la loro traduzione verso schemi logici e l'esportazione dei risultati in formati utilizzabili in ambito didattico e progettuale.
- Periodo del tirocinio: > Informazione da completare manualmente.
- Numero ore/CFU: > Informazione da completare manualmente.
- Corso di laurea: > Informazione da completare manualmente.
- Struttura ospitante: > Informazione da completare manualmente.

## 2. Descrizione sintetica del progetto

buildER e un'applicazione web pensata per supportare la progettazione di basi di dati attraverso la costruzione, la visualizzazione e la trasformazione di schemi Entity-Relationship e schemi logici. Il progetto consente di modellare diagrammi ER in stile Chen, intervenendo su entita, relazioni, attributi, cardinalita, identificatori e generalizzazioni ISA. A partire dal modello concettuale, l'applicazione guida poi l'utente in una fase di traduzione verso uno schema logico, rappresentato con tabelle, colonne, chiavi primarie, chiavi esterne e vincoli.

Il problema affrontato riguarda la necessita di disporre di uno strumento interattivo, chiaro e accessibile da browser per esercitarsi nella progettazione concettuale e logica di basi di dati. In ambito universitario e didattico, buildER puo essere usato da studenti e docenti per costruire esempi, verificare scelte progettuali, visualizzare trasformazioni e discutere in modo piu immediato la corrispondenza tra modello ER e modello relazionale.

Il repository mostra che il progetto non si limita alla sola rappresentazione grafica: include salvataggio e caricamento del progetto in formato `.ersp`, sincronizzazione con una rappresentazione testuale ERS, esportazione in PNG/SVG/JPEG, reverse engineering da SQL, localizzazione dell'interfaccia in italiano, inglese e albanese, test unitari/di integrazione e test end-to-end con Playwright.

## 3. Obiettivi del progetto

### 3.1 Obiettivo generale

L'obiettivo principale del tirocinio puo essere formulato come segue: sviluppare e consolidare buildER, un'applicazione web per la modellazione di schemi Entity-Relationship, il supporto alla traduzione verso schemi logici e la produzione di output esportabili e riutilizzabili, con attenzione alla correttezza concettuale, alla leggibilita grafica, all'usabilita e alla manutenibilita del codice.

### 3.2 Obiettivi specifici

- Migliorare l'interfaccia utente dell'editor, rendendo piu chiari toolbar, header, menu comandi, modali, pannelli tecnici e stati dell'applicazione.
- Rendere piu leggibili gli schemi ER e logici attraverso layout automatici, gestione delle sovrapposizioni, routing degli edge, label di cardinalita e label delle foreign key.
- Gestire in modo robusto gli elementi ER principali: entita, entita deboli, relazioni, attributi semplici, composti e multivalore, cardinalita, identificatori interni, esterni e misti, generalizzazioni ISA.
- Migliorare la pipeline di trasformazione, distinguendo la fase di traduzione ER->ER per generalizzazioni e attributi composti dalla successiva costruzione del modello logico.
- Consolidare la vista logica con tabelle, colonne, PK, FK, UNIQUE, NOT NULL, tipi SQL e visualizzazione delle relazioni tra tabelle.
- Migliorare l'esportazione in PNG, SVG e JPEG, con bounding box reale dello schema, riduzione dello spazio vuoto, sfondo trasparente per PNG/SVG e sfondo bianco per JPEG.
- Introdurre e completare il supporto multilingua in italiano, inglese e albanese.
- Rafforzare salvataggio, caricamento e ripristino della sessione, inclusa compatibilita con versioni precedenti del formato progetto.
- Migliorare l'architettura del codice, separando la logica di dominio in `src/utils`, i tipi condivisi in `src/types`, i componenti UI in `src/components` e i workspace in moduli dedicati.
- Aumentare stabilita e manutenibilita tramite test unitari, test di regressione e test end-to-end.
- Rendere il progetto piu adatto all'uso didattico, con flussi guidati, validazioni, messaggi di errore strutturati e strumenti di import/export.

## 4. Funzionalita principali individuate

### 4.1 Modellazione ER

Il repository conferma la presenza di un editor ER basato su canvas SVG. Gli elementi principali sono modellati nei tipi in `src/types/diagram.ts` e gestiti dalla logica di dominio in `src/utils/diagram.ts`.

Funzionalita individuate:

- creazione di entita, relazioni e attributi;
- supporto per entita deboli;
- attributi identificanti, attributi composti e attributi multivalore;
- identificatori interni semplici e composti;
- identificatori esterni e misti;
- relazioni binarie, n-arie e associazioni ad anello con ruoli;
- collegamenti grafici tra entita, relazioni e attributi;
- cardinalita sui collegamenti e sugli attributi, con normalizzazione dei valori;
- generalizzazioni ISA con vincoli disjoint/overlap e total/partial;
- validazione dello schema e segnalazione di warning/error;
- selezione multipla, duplicazione, allineamento, zoom, pan, snap to grid, undo/redo;
- modalita codice ERS con parsing, serializzazione e sincronizzazione live tra testo e diagramma.

Nota per la relazione: il progetto non dichiara supporto completo a tutti i costrutti EER specialistici. Nel codice dell'interfaccia viene indicato che attributi derivati e altri simboli EER specialistici non risultano ancora coperti.

### 4.2 Schema logico

La vista logica e gestita principalmente da `src/logical`, `src/translation` e dai moduli `src/utils/erTranslation.ts`, `src/utils/logicalTranslation.ts`, `src/utils/logicalWorkspace.ts`, `src/utils/logicalLayout.ts` e `src/utils/logicalSql.ts`.

Funzionalita individuate:

- pipeline di traduzione ER->ER per risolvere generalizzazioni e attributi composti prima del passaggio logico;
- trasformazione verso modello logico con gestione di entita forti, entita deboli, relazioni, attributi multivalore e generalizzazioni;
- workflow manuale e incrementale con step, decisioni, conflitti e artefatti generati;
- scelta della chiave primaria quando esistono piu identificatori candidati;
- rappresentazione di tabelle logiche con colonne, chiavi primarie, chiavi esterne, vincoli UNIQUE e nullable/not nullable;
- gestione di metadati SQL delle colonne, inclusi tipo, default, lunghezza, precisione e scala;
- generazione SQL da modello logico con dialetti generic, MySQL, MariaDB, SQL Server, Oracle, PostgreSQL e SQLite;
- auto-layout del modello logico e visualizzazione dei collegamenti tra tabelle;
- label FK opzionali, permanenti o contestuali, con posizionamento anti-collisione e wrapping multilinea.

### 4.3 Esportazione

L'esportazione e implementata in `src/utils/export.ts` e richiamata dall'applicazione tramite comandi UI. I formati individuati sono:

- SVG;
- PNG;
- JPEG;
- file progetto `.ersp`;
- sorgente/testo ERS;
- SQL generato dalla vista logica.

Caratteristiche tecniche individuate:

- export SVG standalone con font e stili calcolati essenziali copiati nel markup serializzato;
- PNG con sfondo trasparente;
- JPEG con sfondo bianco e qualita alta;
- calcolo della bounding box reale del contenuto esportato;
- padding minimo anti-clipping;
- esclusione degli sfondi del canvas tramite marker dedicati;
- crop indipendente da pan e zoom correnti;
- compatibilita tra vista ER e vista logica;
- test dedicati in `test/export.test.ts`.

### 4.4 Interfaccia utente

L'interfaccia e basata su React e comprende:

- `AppHeader` con brand, comandi progetto, menu e selettore lingua;
- canvas SVG principale per ER e vista logica;
- toolbar laterale con strumenti di creazione e modifica;
- command menu con ricerca, categorie, icone e shortcut;
- modali per cardinalita, scorciatoie, changelog, note, SQL reverse e informazioni;
- pannelli tecnici per review, codice e note;
- loading screen iniziale con logo e messaggi localizzati;
- onboarding introduttivo;
- bottom/status bar e indicatori di validazione;
- layout responsive per desktop, tablet e telefono;
- supporto a scorciatoie da tastiera;
- localizzazione in italiano, inglese e albanese;
- sistema di icone basato su `lucide-react` e componenti interni come `StudioIcon`.

### 4.5 Salvataggio, caricamento e sessione

Il progetto include:

- salvataggio/caricamento in formato `.ersp`;
- MIME type e accept dedicati per file progetto;
- serializzazione di diagramma ER, workspace di traduzione, workspace logico, vista corrente e viewport;
- compatibilita con vecchi backup JSON e versioni precedenti del formato progetto;
- autosalvataggio/ripristino sessione tramite `localStorage`;
- salvataggio di selezioni, viewport, pannelli, bozza ERS, stato toolbar, vista logica e preferenze diagnostiche;
- test in `test/project-file.test.ts`, `test/workspace-session.test.ts` e `test/versioning.test.ts`.

### 4.6 Test

Il repository contiene un insieme ampio di test:

- test unitari e di integrazione in `test/`, eseguiti con `tsx --test`;
- test end-to-end Playwright in `tests/e2e/`;
- test su parsing e serializzazione ERS;
- test su file progetto e compatibilita;
- test su traduzione ER e traduzione logica;
- test su identificatori interni, esterni, composti e misti;
- test su layout attributi, cardinalita, edge label e label FK;
- test su SQL reverse parser, modello logico, diagramma e layout;
- test su export PNG/SVG/JPEG;
- test su clipboard, code editor, i18n, header lingua, loading screen e hook di history.

## 5. Tecnologie utilizzate

| Tecnologia | Dove viene usata | Perche e importante nel progetto |
|---|---|---|
| TypeScript | `src/`, `test/`, configurazioni `tsconfig*.json` | Garantisce tipi espliciti per diagrammi, modelli logici, file progetto e funzioni di trasformazione. |
| React | Componenti in `src/components`, `src/canvas`, `src/logical`, `src/translation`, `src/App.tsx` | Permette di costruire l'interfaccia interattiva dell'applicazione e coordinare canvas, toolbar, modali e workspace. |
| React DOM | `src/main.tsx` | Monta l'applicazione React nel documento HTML. |
| Vite | `vite.config.ts`, script `dev`, `build`, `preview` | Fornisce dev server, build e preview della single-page application. |
| CSS | `src/index.css`, `src/styles/` | Gestisce layout, responsive, tema grafico, pannelli, toolbar, modali e canvas. |
| SVG/Canvas browser | `src/canvas`, `src/utils/export.ts` | Abilita rendering vettoriale del diagramma e rasterizzazione per PNG/JPEG. |
| lucide-react | Dipendenza in `package.json`, componenti icona | Fornisce un sistema di icone coerente per l'interfaccia. |
| npm | `package.json`, `package-lock.json` | Gestisce dipendenze e script di sviluppo, build e test. |
| Node.js | Requisito indicato in README e DEVELOPMENT | Necessario per installare dipendenze ed eseguire build/test. |
| tsx | Script `npm test` | Esegue i test TypeScript direttamente senza compilazione manuale separata. |
| Playwright | `playwright.config.ts`, `tests/e2e/` | Verifica flussi end-to-end come loading screen e cambio lingua nel browser. |
| Git/GitHub | Repository, `.github/`, workflow | Supporta versionamento, issue/PR template e distribuzione automatica. |
| GitHub Actions | `.github/workflows/deploy-pages.yml` | Esegue build e deploy su GitHub Pages quando si lavora sul branch `main`. |
| GitHub Pages | Workflow `deploy-pages.yml` | Pubblica la build statica prodotta in `dist`. |

## 6. Attivita svolte durante il tirocinio

- Sviluppo e consolidamento dell'editor ER: il lavoro ha riguardato la gestione degli elementi principali della notazione Chen, inclusi entita, relazioni, attributi, collegamenti, cardinalita e generalizzazioni. Il codice mostra una progressiva estensione del modello dati e delle funzioni di validazione.

- Gestione avanzata degli identificatori: sono stati introdotti e rifiniti identificatori interni semplici/composti, esterni e misti. Il changelog evidenzia miglioramenti al rendering, alla validazione, alla normalizzazione e alla compatibilita con il formato ERS.

- Realizzazione del workflow di traduzione: il progetto distingue la traduzione ER->ER dalla costruzione dello schema logico. Questo consente di risolvere prima generalizzazioni e attributi composti, poi generare o completare il modello logico in modo piu controllato.

- Implementazione e miglioramento della vista logica: la vista logica permette di lavorare su tabelle, colonne, chiavi primarie, chiavi esterne, vincoli e metadati SQL. Il workflow e stato reso manuale e incrementale, con decisioni esplicite e gestione dei conflitti.

- Miglioramento dell'interfaccia utente: il changelog mostra un lavoro esteso su toolbar, header, command menu, shortcut, pannelli, modali, quick actions, HUD viewport e layout responsive. L'obiettivo e stato rendere lo strumento piu ordinato e utilizzabile su dispositivi diversi.

- Miglioramento degli export: l'applicazione supporta esportazione in PNG, SVG e JPEG, con attenzione a crop, sfondi, font, stili e compatibilita tra vista ER e vista logica. Questo e rilevante per inserire gli schemi in relazioni, slide o materiali didattici.

- Introduzione del salvataggio progetto: il formato `.ersp` permette di conservare diagramma ER, workspace logico, viewport, selezioni e metadati. Sono presenti funzioni di migrazione/compatibilita per versioni precedenti.

- Supporto multilingua: l'interfaccia e localizzata in italiano, inglese e albanese, con selettore lingua nell'header e test dedicati alla persistenza della lingua e alla copertura delle chiavi.

- Reverse engineering SQL: e stata introdotta una funzionalita che importa schemi SQL testuali, costruisce un modello intermedio e produce preview logica/ER. Il parser non mira a coprire tutta la grammatica SQL, ma supporta costrutti comuni come CREATE TABLE, PK, FK, UNIQUE, NOT NULL e DEFAULT.

- Rafforzamento della qualita tramite test: il repository include test su parsing, layout, export, traduzione, salvataggio, i18n e flussi E2E. Questo indica un'attenzione alla regressione e alla stabilita delle aree piu critiche.

- Documentazione e repository hygiene: sono presenti README, changelog, guida architetturale, guida sviluppo, struttura repository, documentazione su SQL reverse, licenza, contributing, security policy e template GitHub.

## 7. Problemi incontrati e soluzioni adottate

| Problema | Impatto | Soluzione/Miglioramento |
|---|---|---|
| Sovrapposizione o disposizione poco leggibile di attributi, cardinalita e label | Riduceva la chiarezza degli schemi e rendeva piu difficile la lettura del modello | Sono stati introdotti layout automatici, collision avoidance, routing piu stabile e test mirati su attributi, cardinalita, edge label e label FK. |
| Esportazione con spazio vuoto eccessivo o sfondi non corretti | Gli schemi esportati erano meno adatti a documenti e presentazioni | L'export calcola i bounds reali del contenuto, rimuove sfondi del canvas, usa PNG/SVG trasparenti e JPEG con sfondo bianco. |
| Complessita nella gestione degli identificatori | Identificatori interni, esterni e misti incidono su validazione, rendering, traduzione e salvataggio | La logica e stata tipizzata e normalizzata, con sezioni dedicate nell'inspector e test di regressione. |
| Traduzione logica non banale | Generalizzazioni, entita deboli, attributi composti e relazioni richiedono scelte progettuali esplicite | Il workflow e stato separato in step, con decisioni, preview, conflitti e possibilita di scelta manuale delle chiavi. |
| Necessita di preservare progetti gia salvati | Cambi di formato o logica potevano rendere non apribili file precedenti | Il formato `.ersp` include versioning, parsing robusto, migrazione da backup legacy e sanitizzazione dei dati. |
| Interfaccia inizialmente meno adatta a schermi diversi | Su mobile/tablet potevano comparire overflow, collisioni tra controlli o pannelli difficili da usare | Sono stati introdotti layout responsive, safe area, toolbar compatte, quick actions e test/controlli E2E. |
| Localizzazione incompleta o stringhe hardcoded | L'interfaccia multilingua poteva risultare incoerente | Le stringhe principali sono state spostate nei dizionari i18n e sono stati aggiunti test per italiano, inglese e albanese. |
| Reverse engineering SQL limitato rispetto alla complessita reale dei dialetti SQL | Un parser completo sarebbe molto ampio e difficile da mantenere | Il progetto usa un parser leggero, documenta costrutti supportati/limitazioni e segnala warning per elementi non convertibili. |
| App orchestrator complesso | `App.tsx` coordina molte responsabilita e puo diventare difficile da mantenere | Sono stati estratti hook e moduli dedicati per sessione, layout, notice e dialoghi, mantenendo la logica di dominio in utility testabili. |

## 8. Consigli e suggerimenti della Prof.ssa Alessandra Lumini

Durante il tirocinio, la Prof.ssa Alessandra Lumini ha svolto il ruolo di tutor e punto di riferimento per la supervisione del progetto. Il suo contributo va presentato nella relazione come un supporto metodologico e progettuale, evitando citazioni dirette non documentate.

Formulazioni consigliate:

> Durante il tirocinio, le indicazioni della Prof.ssa Alessandra Lumini hanno contribuito a orientare il lavoro verso una maggiore chiarezza progettuale e una migliore qualita complessiva dell'applicazione.

> I suggerimenti della tutor hanno portato a dare particolare importanza alla leggibilita degli schemi, alla coerenza dell'interfaccia e alla manutenibilita del codice.

> Il confronto con la Prof.ssa Alessandra Lumini ha aiutato a mantenere l'attenzione sulla correttezza concettuale degli schemi ER e logici, evitando che gli aspetti tecnici dell'implementazione prevalessero sugli obiettivi didattici del progetto.

Aspetti da valorizzare nella relazione:

- supervisione generale del tirocinio;
- definizione e revisione delle priorita di lavoro;
- attenzione alla correttezza concettuale della modellazione ER e logica;
- cura della leggibilita grafica degli schemi;
- ricerca di un'interfaccia semplice e adatta a un contesto didattico;
- incoraggiamento a mantenere una struttura progettuale ordinata, testabile e manutenibile;
- confronto progressivo sul lavoro svolto e sui possibili sviluppi futuri.

## 9. Competenze acquisite

### 9.1 Competenze tecniche

- Sviluppo web moderno con React, TypeScript e Vite.
- Modellazione di strutture dati per schemi ER e modelli logici.
- Progettazione e gestione di un canvas SVG interattivo.
- Implementazione di funzioni di parsing, serializzazione e validazione.
- Gestione della trasformazione da modello concettuale a modello logico.
- Generazione SQL da modello logico.
- Esportazione di contenuti SVG in formati vettoriali e raster.
- Gestione di salvataggio, caricamento, versioning e compatibilita dei file progetto.
- Localizzazione dell'interfaccia e gestione di dizionari multilingua.
- Scrittura di test unitari, test di regressione e test end-to-end.
- Uso di Git, GitHub Actions e workflow di deploy su GitHub Pages.
- Organizzazione modulare del codice e separazione tra UI, tipi e logica di dominio.

### 9.2 Competenze trasversali

- Autonomia nello sviluppo e nella gestione di un progetto articolato.
- Capacita di analisi e problem solving su problemi grafici, logici e architetturali.
- Pianificazione progressiva delle attivita e gestione delle priorita.
- Capacita di ricevere feedback dalla tutor e trasformarlo in miglioramenti concreti.
- Comunicazione tecnica piu chiara, sia nel codice sia nella documentazione.
- Attenzione all'utente finale, in particolare allo studente o docente che usa lo strumento per fini didattici.
- Capacita di valutare compromessi tra completezza funzionale, semplicita d'uso e manutenibilita.

## 10. Materiale da completare manualmente

- [ ] Periodo del tirocinio.
- [ ] Numero di ore.
- [ ] CFU.
- [ ] Corso di laurea.
- [ ] Struttura ospitante.
- [ ] Nome dello studente.
- [ ] Matricola, se richiesta dal template Prism/Universita.
- [ ] Anno accademico.
- [ ] Eventuale sito online del progetto.
- [ ] Eventuale link GitHub pubblico o privato.
- [ ] Screenshot dell'interfaccia principale.
- [ ] Screenshot di uno schema ER.
- [ ] Screenshot della vista di traduzione.
- [ ] Screenshot della vista logica/schema.
- [ ] Screenshot o esempio di export.
- [ ] Eventuali ringraziamenti personali.
- [ ] Eventuali riferimenti bibliografici su modello ER, modello relazionale, progettazione di basi di dati e strumenti web usati.
