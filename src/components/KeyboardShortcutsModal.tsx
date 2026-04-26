interface ShortcutItem {
  keys: string;
  action: string;
}

interface ShortcutSection {
  title: string;
  items: ShortcutItem[];
}

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: "Azioni standard",
    items: [
      { keys: "Ctrl/Cmd S", action: "Salva progetto .ersp" },
      { keys: "Ctrl/Cmd Z", action: "Undo" },
      { keys: "Ctrl/Cmd Shift Z", action: "Redo" },
      { keys: "Ctrl/Cmd Y", action: "Redo" },
      { keys: "Esc", action: "Chiude modal, annulla selezione o termina operazione corrente" },
    ],
  },
  {
    title: "Workspace",
    items: [
      { keys: "Ctrl/Cmd I", action: "Apre/chiude dock tecnico; in schema alterna SQL/Review" },
      { keys: "Ctrl/Cmd .", action: "Focus mode" },
      { keys: "Ctrl/Cmd D", action: "Duplica selezione ER" },
      { keys: "Delete / Backspace", action: "Elimina selezione ER" },
    ],
  },
  {
    title: "Strumenti ER",
    items: [
      { keys: "V", action: "Selezione" },
      { keys: "S", action: "Sposta / pan" },
      { keys: "E", action: "Entita" },
      { keys: "R", action: "Relazione" },
      { keys: "A", action: "Attributo" },
      { keys: "C", action: "Collegamento" },
      { keys: "G", action: "Generalizzazione" },
      { keys: "X", action: "Cancella" },
    ],
  },
  {
    title: "Canvas",
    items: [
      { keys: "Tab", action: "Focus su nodi e collegamenti" },
      { keys: "Enter", action: "Rinomina elemento selezionato o in focus" },
      { keys: "Frecce", action: "Sposta elemento selezionato con precisione" },
      { keys: "+ / -", action: "Zoom quando il canvas ha focus" },
      { keys: "Rotella", action: "Zoom viewport" },
      { keys: "Tasto centrale drag", action: "Pan del canvas" },
    ],
  },
  {
    title: "Editor codice",
    items: [
      { keys: "Tab", action: "Inserisce tabulazione nel codice ERS" },
      { keys: "( [ {", action: "Auto-pair se il codice e modificabile" },
      { keys: ") ] }", action: "Salta la parentesi di chiusura gia presente" },
    ],
  },
  {
    title: "Schema logico",
    items: [
      { keys: "Doppio click tabella", action: "Rinomina tabella" },
      { keys: "Doppio click colonna", action: "Rinomina colonna" },
      { keys: "Type Mode", action: "Clic su colonna per aprire editor SQL contestuale" },
    ],
  },
];

export function KeyboardShortcutsModal(props: KeyboardShortcutsModalProps) {
  return (
    <div className="help-modal-backdrop command-modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="help-modal shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="help-modal-head command-modal-head">
          <div>
            <h2 id="keyboard-shortcuts-title">Keyboard shortcuts</h2>
            <p>Comandi da tastiera supportati da ER Studio.</p>
          </div>
          <button type="button" className="help-close" onClick={props.onClose} aria-label="Chiudi scorciatoie">
            X
          </button>
        </div>

        <div className="shortcuts-modal-content">
          {SHORTCUT_SECTIONS.map((section) => (
            <section key={section.title} className="shortcut-section">
              <h3>{section.title}</h3>
              <dl>
                {section.items.map((item) => (
                  <div key={`${section.title}-${item.keys}-${item.action}`} className="shortcut-row">
                    <dt>
                      {item.keys.split(" / ").map((key) => (
                        <kbd key={key}>{key}</kbd>
                      ))}
                    </dt>
                    <dd>{item.action}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
