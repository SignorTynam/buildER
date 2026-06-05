# ER Studio — Guida stile UI v4 per Codex

Questa guida definisce lo stile UI da usare in tutto il progetto ER Studio a partire dal design introdotto nella versione 4. Deve essere considerata la fonte di verità per ogni futura modifica grafica, refactor di componenti o nuova feature UI.

## Obiettivo

Portare tutta l'app a un unico design system moderno, coerente e non legacy.

Il risultato atteso è un'interfaccia da studio professionale per modellazione ER:

- pulita, tecnica, leggibile;
- coerente tra canvas, toolbar, header, pannelli, modali, dock, sidebar, preview SQL/logiche e stati di errore;
- basata sui token di design `--studio-*` e `--editor-*`;
- priva di pannelli legacy, classi legacy, vecchi blocchi CSS duplicati e override casuali;
- accessibile, responsive e stabile in build/test.

## Principio fondamentale

Non aggiungere nuovo stile locale isolato se esiste già un pattern condiviso.

Ogni superficie UI deve usare, quando possibile:

- `PanelShell` per il contenitore principale di pannelli/sidebar/dock;
- `PanelHeader` per intestazioni di pannelli;
- `PanelSection` per gruppi interni;
- `PanelCard` o `PanelStepCard` per card/azioni/selezioni;
- `PanelTabs` per tab;
- `WarningCard` per warning/error/info;
- `EmptyStateCard` per stati vuoti;
- `CommandOptionRow` per righe comando/menu.

Se un componente usa ancora markup o classi custom per ricreare pannelli, card, tab o warning, deve essere migrato ai componenti condivisi oppure allineato esattamente allo stesso linguaggio CSS.

## Cosa significa “stile v4”

Lo stile v4 è un design da editor professionale, non una landing page decorativa e non una UI legacy a riquadri grezzi.

### Identità visiva

- Palette soft grigio-verde/sage, neutra e tecnica.
- Superfici chiare, bordi sottili, gerarchia visiva sobria.
- Contrasto leggibile senza colori aggressivi.
- Canvas ampio, ordinato, senza rumore visivo.
- Pannelli compatti ma leggibili.
- Toolbar e controlli coerenti con il resto del workspace.
- Stati attivi evidenti ma non eccessivi.
- Focus ring accessibile.

### Token obbligatori

Usare i token globali invece di valori hardcoded:

- colore sfondo: `--studio-bg`, `--editor-shell-bg`;
- superfici: `--studio-surface`, `--studio-surface-strong`, `--studio-surface-muted`, `--editor-panel`, `--editor-panel-strong`, `--editor-panel-muted`;
- bordi: `--studio-border`, `--studio-border-strong`, `--editor-border`, `--editor-border-strong`;
- testo: `--studio-ink`, `--studio-muted`, `--studio-faint`, `--editor-text`, `--editor-text-strong`, `--editor-text-muted`;
- accento: `--studio-accent`, `--studio-accent-strong`, `--studio-accent-soft`, `--editor-accent`, `--editor-accent-soft`;
- stati: `--studio-danger`, `--studio-warning`, `--studio-success`, relativi soft tokens e token diagramma;
- raggi: `--studio-radius-sm`, `--studio-radius-md`, `--studio-radius-lg`, `--studio-radius-panel`;
- ombre: `--studio-shadow-sm`, `--studio-shadow-panel`, `--studio-shadow-floating`;
- focus: `--studio-focus-ring`.

Evita nuovi colori hardcoded come `#111`, `#fff`, `#ffd94d`, `#dfe3dc`, `#151414`, ecc. Se un colore deve rimanere, deve essere promosso a token con nome semantico.

## Cosa eliminare

### Da eliminare o migrare

- Blocchi CSS duplicati in `:root` che ridefiniscono gli stessi token più volte.
- Vecchi override aggiunti “a strati” per correggere layout precedenti.
- Commenti del tipo “keep this block last” usati come soluzione strutturale.
- Classi legacy che simulano pannelli quando esistono componenti condivisi.
- Stili visuali hardcoded non collegati ai token.
- Pannelli laterali/dock vecchi non più usati.
- CSS morto, selettori non referenziati e variabili obsolete.
- Differenze visive ingiustificate tra `CodePanel`, `NotesPanel`, `InspectorPanel`, `TechnicalDockPanel`, `CommandMenuModal`, `SqlReverse*`, `TranslationWorkspace`, `LogicalTranslationWorkspace`.

### Da NON eliminare senza motivo

Non confondere legacy visivo con compatibilità dati.

Il supporto a vecchi file progetto, vecchi JSON o import legacy serve a non rompere i progetti degli utenti. Non va rimosso solo perché contiene la parola `legacy`. Il refactor UI deve concentrarsi su CSS, componenti visuali e layout, non sulla compatibilità del formato progetto.

## Architettura CSS desiderata

Scegliere una delle due strategie, preferibilmente la prima.

### Strategia preferita: consolidamento in moduli ordinati

Organizzare gli stili in modo leggibile:

```txt
src/styles/
  design-tokens.css       // solo :root e token semantici
  base.css                // reset, body, form controls, focus, utility minime
  layout.css              // app shell, topbar, workspace, canvas region
  panels.css              // PanelShell, PanelHeader, PanelSection, PanelCard, tabs, warning, empty
  editor-surfaces.css     // code panel, notes panel, inspector, technical dock, command menu, modali
  diagram.css             // canvas, nodi, edge, selection, viewport HUD
```

`src/main.tsx` deve importare solo il set finale ordinato, senza CSS legacy residuo.

### Strategia accettabile: mantenere i file attuali ma ripulirli

Se non conviene creare nuovi file, allora:

- `src/index.css` contiene solo token base, reset e landing se ancora necessaria;
- `src/styles/editor-refactor.css` contiene solo layout editor/workspace/canvas;
- `src/styles/panels.css` contiene solo componenti condivisi dei pannelli;
- niente token duplicati tra file;
- niente blocchi “override finali” che riscrivono mezzo tema.

## Regole componenti

### Header

`AppHeader` deve sembrare parte dello studio v4:

- topbar compatta;
- brand e versione leggibili;
- nome progetto come input integrato;
- azioni coerenti con bottoni/token globali;
- niente stile “legacy terminale” non coerente con il resto, salvo scelta intenzionale tokenizzata.

### Toolbar

La toolbar deve essere:

- compatta;
- tokenizzata;
- coerente con bordi/raggi/stati attivi del resto dei pannelli;
- leggibile anche in stato collapsed;
- senza highlight hardcoded come giallo puro o nero/bianco assoluto.

### Pannelli laterali e dock

Tutti i pannelli devono avere la stessa grammatica:

- contenitore: superficie chiara, bordo sottile, radius coerente;
- header: titolo, descrizione opzionale, azioni;
- sezioni: `PanelSection`;
- card: `PanelCard`;
- stati vuoti: `EmptyStateCard`;
- warning/error/info: `WarningCard`;
- tab: `PanelTabs`.

Questo vale per:

- `InspectorPanel`;
- `CodePanel`;
- `NotesPanel`;
- `TechnicalDockPanel`;
- `ErWorkspaceSidebar`;
- `WorkspaceStageBar`;
- `CommandMenuModal`;
- `KeyboardShortcutsModal`;
- `ChangelogModal`;
- `VersionAnnouncement`;
- `SqlReverseInputModal`;
- `SqlReversePreviewFrame`;
- `SqlReverseErPreview`;
- `SqlReverseLogicalPreview`;
- viste di traduzione ER/logica.

### Modali

Le modali devono usare la stessa struttura:

- overlay coerente;
- panel centrale tokenizzato;
- header chiaro;
- body con sezioni/card;
- footer azioni coerenti;
- focus ring e `aria-*` corretti;
- niente bottoni custom isolati.

### Canvas e diagramma

Il canvas deve restare prioritario:

- sfondo neutro, non invadente;
- griglia leggera;
- nodi leggibili;
- selezione/focus coerenti con `--studio-accent`;
- warning/error su diagramma coerenti con i token stato;
- nessun rumore decorativo che ostacoli la modellazione.

## Piano operativo per Codex

1. Lavora sul branch `main`.
2. Esegui un audit dei file CSS e dei componenti UI.
3. Crea una mappa di:
   - classi legacy;
   - token duplicati;
   - selettori non usati;
   - componenti che non usano i componenti condivisi dei pannelli;
   - colori hardcoded.
4. Consolida i token globali.
5. Migra i componenti ai pattern condivisi.
6. Rimuovi CSS morto e vecchi override.
7. Mantieni la compatibilità dati legacy dei file progetto.
8. Verifica build e test.
9. Aggiorna changelog/app metadata solo se la modifica rientra nelle convenzioni versione del progetto.

## Checklist finale obbligatoria

Prima di consegnare, Codex deve verificare:

- `npm run build` passa;
- `npm test` passa;
- non ci sono nuovi errori TypeScript;
- non ci sono import CSS non usati;
- non ci sono token duplicati inutilmente;
- non ci sono pannelli legacy ancora visibili;
- non ci sono bottoni/card/tab nuovi fuori design system;
- il progetto carica ancora file `.ersp` versione corrente;
- il supporto a import legacy non è stato rotto;
- canvas ER, vista traduzione, vista logica, reverse SQL, modali, header, toolbar e inspector sono visivamente coerenti.

## Prompt Codex riutilizzabile

Copia e incolla questo prompt quando vuoi far applicare o mantenere lo stile v4.

```text
Sei nel repository SignorTynam/ER-Studio. Lavora sul branch main, che è il branch più aggiornato.

Obiettivo: eliminare definitivamente lo stile UI legacy dall'app e rendere tutto il progetto coerente con il design moderno introdotto dalla versione 4 di ER Studio.

Contesto tecnico:
- Progetto React + TypeScript + Vite.
- L'app usa CSS globali importati da src/main.tsx.
- Esistono componenti condivisi in src/components/panels.tsx: PanelShell, PanelHeader, PanelTabs, PanelSection, CollapsiblePanel, PanelCard, PanelStepCard, WorkspaceViewBar, WorkspaceViewButton, WarningCard, EmptyStateCard, CommandOptionRow.
- Questi componenti devono diventare la base obbligatoria per pannelli, card, tab, warning, stati vuoti e righe comando.

Stile richiesto:
- Studio professionale, tecnico, pulito, sobrio.
- Palette grigio-verde/sage, superfici chiare, bordi sottili, ombre leggere, radius coerenti.
- Canvas centrale ampio, leggibile, non decorativo.
- Toolbar compatta e coerente.
- Header/topbar coerente con il resto del workspace.
- Pannelli laterali, dock, modali, sidebar, preview SQL/logiche e menu comando devono sembrare parte dello stesso design system.
- Usa token CSS semantici, non colori hardcoded.
- Usa i token --studio-* e --editor-* come fonte di verità.

Cosa devi fare:
1. Ispeziona tutto il progetto sul branch main.
2. Trova tutti i residui di stile legacy: vecchi pannelli, vecchi selettori, vecchi blocchi CSS, colori hardcoded, duplicazioni di :root, override finali, classi non più coerenti, CSS morto.
3. Ripulisci il CSS globale. In particolare controlla:
   - src/index.css
   - src/styles/editor-refactor.css
   - src/styles/panels.css
   - eventuali altri CSS importati o riferiti.
4. Consolida i token in una sola definizione chiara. Evita più blocchi :root che ridefiniscono lo stesso tema.
5. Rimuovi o migra i vecchi stili. Non lasciare commenti/soluzioni del tipo “keep this block last” come architettura permanente.
6. Migra i componenti che hanno markup visuale custom verso i componenti condivisi di panels.tsx quando ha senso.
7. Uniforma visivamente almeno queste aree:
   - AppHeader
   - Toolbar
   - InspectorPanel
   - CodePanel
   - NotesPanel
   - TechnicalDockPanel, se ancora usato o da rimuovere se morto
   - CommandMenuModal
   - KeyboardShortcutsModal
   - ChangelogModal
   - VersionAnnouncement
   - OnboardingGuide
   - ErWorkspaceSidebar
   - WorkspaceStageBar
   - TranslationWorkspace
   - LogicalTranslationWorkspace
   - SqlReverseInputModal
   - SqlReversePreviewFrame
   - SqlReverseErPreview
   - SqlReverseLogicalPreview
   - BottomStatusBar
   - DiagramCanvas, DiagramNode, DiagramEdge.
8. Non rompere la compatibilità dati. Se trovi codice con "legacy" legato a import di vecchi file progetto o JSON, non eliminarlo solo per il nome. L'obiettivo è rimuovere legacy UI/CSS, non rompere i vecchi progetti degli utenti.
9. Mantieni o migliora accessibilità: aria-label, focus-visible, contrasto, stato disabled, tastiera.
10. Mantieni tutte le funzionalità esistenti.

Vincoli importanti:
- Non introdurre librerie UI esterne.
- Non riscrivere l'app da zero.
- Non cambiare il modello dati se non serve per il refactor UI.
- Non rompere reverse SQL, traduzione ER, modello logico, salvataggio/caricamento progetto, esportazioni, shortcut, modali e pannelli.
- Non lasciare CSS duplicato o morto.
- Non usare colori hardcoded per nuovi stili: promuovi a token semantici.
- Se una classe è ancora necessaria per compatibilità visuale durante il refactor, rinominala o documentala; non lasciare nomi legacy per superfici nuove.

Output atteso:
- Refactor CSS completo e ordinato.
- Componenti allineati allo stile v4.
- Nessun pannello legacy visibile.
- Nessun vecchio stile legacy ancora dominante.
- Build e test passanti.
- Breve riepilogo finale con:
  1. file modificati;
  2. CSS rimosso/consolidato;
  3. componenti migrati;
  4. eventuali residui motivati;
  5. risultato di npm run build e npm test.

Comandi da eseguire prima della consegna:
- npm run build
- npm test
```
