interface CodeModeTutorialPageProps {
  appTitle: string;
  appVersion: string;
  onBackWorkspace: () => void;
  onOpenCodeStudio: () => void;
}

const CODE_TUTORIAL_SAMPLE = `entity BASE_ENTITY {
  identifier BASE_ID
  attribute LABEL
  multivalued CONTACT
}

attribute DetailA
attribute DetailB
attribute DetailC

attribute-link DetailA -> CONTACT
attribute-link DetailB -> CONTACT
attribute-link DetailC -> CONTACT

entity SUBTYPE_A weak
entity SUBTYPE_B

inheritance SUBTYPE_A -> BASE_ENTITY disjoint total
inheritance SUBTYPE_B -> BASE_ENTITY overlap partial`;

const WORKSPACE_MODES = [
  {
    title: "Diagramma per il colpo d'occhio",
    text: "Usa la vista Diagramma quando vuoi capire struttura e collisioni visive senza leggere il file ERS.",
  },
  {
    title: "Vista affiancata per il controllo",
    text: "Apri la vista affiancata quando stai scrivendo e vuoi vedere subito come il parser traduce le righe nel canvas.",
  },
  {
    title: "Editor ERS nella vista affiancata",
    text: "Usa il pannello ERS affiancato quando il modello e abbastanza stabile e vuoi lavorare piu velocemente da tastiera.",
  },
];

const FLOW_STEPS = [
  {
    step: "01",
    title: "Dichiara prima le entita base",
    text: "Parti da entity e relation. Il canvas serve a confermare la struttura, non a inventarla al posto tuo.",
  },
  {
    step: "02",
    title: "Aggiungi attributi dentro il blocco giusto",
    text: "Gli attributi semplici, identifier e composti si leggono meglio quando restano vicini al loro contenitore nel blocco.",
  },
  {
    step: "03",
    title: "Usa attribute-link per gli attributi collegati",
    text: "Gli attributi collegati restano nodi normali. Il numero di elementi e libero.",
  },
  {
    step: "04",
    title: "Controlla l'ultimo stato valido",
    text: "Se una riga e incompleta, il parser mostra l'errore ma il diagramma resta fermo sull'ultima versione corretta.",
  },
];

const SYNTAX_PATTERNS = [
  {
    title: "Entita e attributi",
    code: `entity STUDENTE {\n  identifier MATRICOLA\n  attribute NOME\n}`,
    text: "Il blocco entity e il punto piu pulito per definire identificatori e attributi base.",
  },
  {
    title: "Relazione con cardinalita",
    code: `relation FREQUENTA {\n  connect STUDENTE "(0,N)"\n  connect CORSO "(1,N)"\n}`,
    text: "Usa relation in forma compatta o a blocco. La forma a blocco e piu leggibile quando la relazione cresce.",
  },
  {
    title: "Identificatori interni composti multipli",
    code: `entity ORDINE {\n  attribute ANNO\n  attribute NUMERO\n  attribute SERIE\n  attribute PROGRESSIVO\n  identifier ANNO, NUMERO\n  identifier SERIE, PROGRESSIVO\n}`,
    text: "Ogni riga identifier con lista separata da virgole definisce un identificatore interno composto distinto.",
  },
  {
    title: "Attributo composto con sotto-attributi",
    code: `multivalued INDIRIZZO\nattribute Via\nattribute-link Via -> INDIRIZZO`,
    text: "Nel DSL legacy la keyword compatibile resta multivalued, ma nell'interfaccia il concetto corretto e attributo composto.",
  },
  {
    title: "Vincoli ISA avanzati",
    code: `inheritance SUBTYPE_A -> BASE_ENTITY disjoint total`,
    text: "Disjoint/overlap e total/partial si impostano su ogni singolo collegamento di generalizzazione.",
  },
];

const COMMON_TRAPS = [
  {
    title: "Etichetta UI e parola chiave del DSL",
    text: "Nell'interfaccia parla di attributo composto; nel file ERS la keyword legacy da usare resta `multivalued`.",
  },
  {
    title: "Direzione di attribute-link",
    text: "Il figlio punta al padre: `attribute-link via -> indirizzo`. Invertire la freccia cambia il significato del contenitore.",
  },
  {
    title: "Attributi incompatibili",
    text: "Un attributo composto non puo essere membro di un identificatore interno. Inoltre un attributo non puo comparire in piu identificatori interni contemporaneamente.",
  },
  {
    title: "Errore temporaneo durante la digitazione",
    text: "Se stai scrivendo a meta una riga, non aspettarti una sincronizzazione parziale: il diagramma resta all'ultimo stato valido finche la sintassi non torna corretta.",
  },
];

const REVIEW_CHECKLIST = [
  "Apri la vista affiancata quando stai verificando una relazione o un set ISA perche vedi subito cardinalita, etichette e vincoli.",
  "Usa Rigenera dal diagramma solo quando il canvas e piu affidabile della bozza corrente: e un riallineamento completo, non una fusione.",
  "Scarica il file .ers quando vuoi revisionare o versionare il modello testuale fuori dal canvas.",
];

export function CodeModeTutorialPage(props: CodeModeTutorialPageProps) {
  return (
    <div className="tutorial-shell">
      <header className="tutorial-header">
        <div className="tutorial-header-main">
          <button type="button" className="tutorial-brand" onClick={props.onBackWorkspace}>
            <span className="landing-kicker">Guida alla modalita codice</span>
            <strong>{props.appTitle}</strong>
          </button>

          <nav className="tutorial-nav" aria-label="Sezioni tutorial">
            <a href="#tutorial-overview">Panoramica</a>
            <a href="#tutorial-workflow">Flusso di lavoro</a>
            <a href="#tutorial-syntax">Sintassi</a>
            <a href="#tutorial-troubleshooting">Errori comuni</a>
          </nav>
        </div>

        <div className="tutorial-header-actions">
          <span className="landing-version-chip">Versione {props.appVersion}</span>
          <button type="button" className="landing-secondary-link" onClick={props.onBackWorkspace}>
            Torna al workspace
          </button>
        </div>
      </header>

      <main className="tutorial-main">
        <section className="tutorial-hero" id="tutorial-overview">
          <div className="tutorial-hero-copy">
            <p className="landing-hero-eyebrow">Tutorial operativo dedicato</p>
            <h1>Scrivi ERS con parser e canvas in parallelo, senza perdere il controllo del modello.</h1>
            <p className="tutorial-hero-lead">
              Usa questa guida come riferimento rapido: contenitore prima dei figli, sintassi valida prima della sincronizzazione,
              canvas come verifica e non come sorgente primaria.
            </p>

            <div className="tutorial-entry-grid">
              <button type="button" className="tutorial-entry-card tutorial-entry-card-primary" onClick={props.onOpenCodeStudio}>
                <span className="landing-kicker">Scelta consigliata</span>
                <strong>Apri la vista affiancata</strong>
                <span>Scrivi ERS e controlla subito come il parser aggiorna il canvas.</span>
              </button>
              <button type="button" className="tutorial-entry-card" onClick={props.onBackWorkspace}>
                <span className="landing-kicker">Alternativa</span>
                <strong>Torna al workspace</strong>
                <span>Rientra nel canvas principale e usa questa pagina solo come riferimento.</span>
              </button>
            </div>

            <div className="tutorial-overview-grid">
              {WORKSPACE_MODES.map((item) => (
                <article key={item.title} className="tutorial-overview-card">
                  <h2>{item.title}</h2>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="tutorial-stage-card">
            <div className="tutorial-stage-head">
              <div>
                <span className="landing-kicker">Sessione tipo</span>
                <h2>Il file .ers resta la sorgente primaria.</h2>
              </div>
              <div className="tutorial-stage-status">
                <span>Sincronizzazione live</span>
                <span>Parser ERS</span>
                <span>Canvas Chen</span>
              </div>
            </div>

            <pre className="tutorial-stage-code">{CODE_TUTORIAL_SAMPLE}</pre>

            <div className="tutorial-stage-footer">
              <strong>Regola pratica</strong>
              <p>
                Definisci prima il contenitore, poi i figli, poi i link: il canvas conferma il risultato quando la sintassi torna valida.
              </p>
            </div>
          </aside>
        </section>

        <section className="tutorial-section" id="tutorial-workflow">
          <div className="tutorial-section-heading">
            <span>Flusso di lavoro</span>
            <h2>Scrivi in ordine strutturale, non riga per riga a caso.</h2>
            <p>
              L'editor ERS rende veloce la modellazione solo se mantieni una disciplina minima: contenitore prima dei figli
              e controllo visivo nella vista affiancata quando serve.
            </p>
          </div>

          <div className="tutorial-flow-grid">
            {FLOW_STEPS.map((item) => (
              <article key={item.step} className="tutorial-flow-card">
                <span className="tutorial-flow-step">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="tutorial-section" id="tutorial-syntax">
          <div className="tutorial-section-heading">
            <span>Sintassi</span>
            <h2>I pattern essenziali bastano per coprire quasi tutto il lavoro quotidiano.</h2>
            <p>
              Non serve memorizzare tutto il DSL per partire. Questi frammenti coprono entita, relazioni,
              attributi composti e generalizzazioni.
            </p>
          </div>

          <div className="tutorial-syntax-layout">
            <div className="tutorial-syntax-grid">
              {SYNTAX_PATTERNS.map((item) => (
                <article key={item.title} className="tutorial-syntax-card">
                  <h3>{item.title}</h3>
                  <pre>{item.code}</pre>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>

            <article className="tutorial-note-card">
              <span className="landing-kicker">Compatibilita DSL</span>
              <h3>Tre dettagli che evitano quasi tutti i dubbi iniziali.</h3>
              <ul className="tutorial-note-list">
                <li>
                  <code>multivalued</code> e la parola chiave legacy compatibile per l&apos;attributo composto.
                </li>
                <li>
                  <code>attribute-link figlio -&gt; padre</code> collega un sotto-attributo al suo contenitore.
                </li>
                <li>
                  <code>inheritance</code> porta con se anche <code>disjoint/overlap</code> e{" "}
                  <code>total/partial</code> sulla stessa riga.
                </li>
                {REVIEW_CHECKLIST.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="tutorial-section" id="tutorial-troubleshooting">
          <div className="tutorial-section-heading">
            <span>Errori comuni</span>
            <h2>Gli intoppi tipici non sono nel canvas: quasi sempre sono nel modello mentale.</h2>
            <p>
              Quando qualcosa sembra non sincronizzarsi, nella maggior parte dei casi il parser sta difendendo il
              diagramma da una struttura ambigua o incompleta.
            </p>
          </div>

          <div className="tutorial-warning-grid">
            <article className="tutorial-warning-card">
              <h3>Trappole frequenti</h3>
              <div className="tutorial-warning-list">
                {COMMON_TRAPS.map((item) => (
                  <div key={item.title}>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="tutorial-warning-card tutorial-warning-card-strong">
              <span className="landing-kicker">Quando usare questa pagina</span>
              <h3>Prima di una revisione, prima di importare un .ers, o quando passi dal canvas al testo.</h3>
              <p>
                La pagina tutorial serve come riferimento stabile: puoi leggerla, poi aprire direttamente la vista affiancata
                senza perdere il contesto del flusso consigliato.
              </p>
            </article>
          </div>
        </section>

        <section className="tutorial-final-cta">
          <div>
            <span className="landing-kicker">Pronto a scrivere</span>
            <h2>Scegli il punto di ingresso giusto: affiancata se vuoi scrivere ERS, workspace se vuoi tornare al canvas.</h2>
          </div>

          <div className="tutorial-final-actions">
            <button type="button" className="landing-secondary-link" onClick={props.onBackWorkspace}>
              Torna al workspace
            </button>
            <button type="button" className="landing-primary-button" onClick={props.onOpenCodeStudio}>
              Apri la vista affiancata
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
