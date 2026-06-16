# buildER — Guida stile UI per Codex/Cursor

Questa guida definisce lo stile UI da usare in tutto il progetto buildER. Deve essere considerata la fonte di verità per ogni futura modifica grafica, refactor di componenti o nuova feature UI.

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

## Identità visiva

Lo stile buildER è un design da editor professionale, non una landing page decorativa e non una UI legacy a riquadri grezzi.

- Palette soft grigio-verde/sage, neutra e tecnica.
- Superfici chiare, bordi sottili, gerarchia visiva sobria.
- Contrasto leggibile senza colori aggressivi.
- Canvas ampio, ordinato, senza rumore visivo.
- Pannelli compatti ma leggibili.
- Toolbar e controlli coerenti con il resto del workspace.
- Stati attivi evidenti ma non eccessivi.
- Focus ring accessibile.

## Token obbligatori

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

## Cosa eliminare o migrare

- Blocchi CSS duplicati in `:root` che ridefiniscono gli stessi token più volte.
- Vecchi override aggiunti “a strati” per correggere layout precedenti.
- Commenti del tipo “keep this block last” usati come soluzione strutturale.
- Classi legacy che simulano pannelli quando esistono componenti condivisi.
- Stili visuali hardcoded non collegati ai token.
- Pannelli laterali/dock vecchi non più usati.
- CSS morto, selettori non referenziati e variabili obsolete.
- Differenze visive ingiustificate tra `CodePanel`, `NotesPanel`, `InspectorPanel`, `TechnicalDockPanel`, `CommandMenuModal`, `SqlReverse*`, `TranslationWorkspace`, `LogicalTranslationWorkspace`.

## Cosa non eliminare senza motivo

Non confondere legacy visivo con compatibilità dati. Il supporto a vecchi file progetto, vecchi JSON o import legacy serve a non rompere i progetti degli utenti. Non va rimosso solo perché contiene la parola `legacy`. Il refactor UI deve concentrarsi su CSS, componenti visuali e layout, non sulla compatibilità del formato progetto.

## Architettura CSS desiderata

Strategia preferita:

```txt
src/styles/
  design-tokens.css
  base.css
  layout.css
  panels.css
  editor-surfaces.css
  diagram.css
```

`src/main.tsx` deve importare solo il set finale ordinato, senza CSS legacy residuo.

Strategia accettabile: mantenere i file attuali ma ripulirli, evitando token duplicati e blocchi finali di override che riscrivono mezzo tema.

## Piano operativo per Codex/Cursor

1. Crea un branch dedicato partendo da `main` aggiornata.
2. Esegui un audit dei file CSS e dei componenti UI.
3. Crea una mappa di classi legacy, token duplicati, selettori non usati, componenti fuori pattern e colori hardcoded.
4. Consolida i token globali.
5. Migra i componenti ai pattern condivisi.
6. Rimuovi CSS morto e vecchi override.
7. Mantieni la compatibilità dati legacy dei file progetto.
8. Verifica build e test.
9. Aggiorna documentazione e changelog solo se necessario.

## Checklist finale obbligatoria

Prima di consegnare, verificare:

- `npm run build` passa;
- `npm test` passa;
- `npm run test:e2e` passa se la modifica tocca UI o flussi utente;
- non ci sono nuovi errori TypeScript;
- non ci sono import CSS non usati;
- non ci sono token duplicati inutilmente;
- non ci sono pannelli legacy ancora visibili;
- non ci sono bottoni/card/tab nuovi fuori design system;
- il progetto carica ancora file `.ersp` versione corrente;
- il supporto a import legacy non è stato rotto;
- canvas ER, vista traduzione, vista logica, reverse SQL, modali, header, toolbar e inspector sono visivamente coerenti.
