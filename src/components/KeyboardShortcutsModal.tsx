import { useMemo, useState } from "react";
import { StudioIcon, type StudioIconName } from "./icons/StudioIcon";

interface ShortcutItem {
  keys: string;
  action: string;
}

type ShortcutSectionId = "standard" | "workspace" | "er" | "canvas" | "code" | "logical";

interface ShortcutSection {
  id: ShortcutSectionId;
  title: string;
  shortTitle: string;
  icon: StudioIconName;
  items: ShortcutItem[];
}

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    id: "standard",
    title: "Azioni standard",
    shortTitle: "Standard",
    icon: "keyboard",
    items: [
      { keys: "Ctrl/Cmd S", action: "Salva progetto .ersp" },
      { keys: "Ctrl/Cmd Z", action: "Undo" },
      { keys: "Ctrl/Cmd Shift Z", action: "Redo" },
      { keys: "Ctrl/Cmd Y", action: "Redo" },
      { keys: "Esc", action: "Chiude modal, annulla selezione o termina operazione corrente" },
    ],
  },
  {
    id: "workspace",
    title: "Workspace",
    shortTitle: "Workspace",
    icon: "show",
    items: [
      { keys: "Ctrl/Cmd I", action: "Apre/chiude dock tecnico; in schema alterna SQL/Review" },
      { keys: "Ctrl/Cmd .", action: "Focus mode" },
      { keys: "Ctrl/Cmd C", action: "Copia selezione ER" },
      { keys: "Ctrl/Cmd V", action: "Incolla selezione ER" },
      { keys: "Ctrl/Cmd D", action: "Duplica selezione ER" },
      { keys: "Delete / Backspace", action: "Elimina selezione ER" },
    ],
  },
  {
    id: "er",
    title: "Strumenti ER",
    shortTitle: "ER",
    icon: "design",
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
    id: "canvas",
    title: "Canvas",
    shortTitle: "Canvas",
    icon: "fit",
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
    id: "code",
    title: "Editor codice",
    shortTitle: "Codice",
    icon: "code",
    items: [
      { keys: "Tab", action: "Inserisce tabulazione nel codice ERS" },
      { keys: "( [ {", action: "Auto-pair se il codice e modificabile" },
      { keys: ") ] }", action: "Salta la parentesi di chiusura gia presente" },
    ],
  },
  {
    id: "logical",
    title: "Schema logico",
    shortTitle: "Logico",
    icon: "database",
    items: [
      { keys: "Doppio click tabella", action: "Rinomina tabella" },
      { keys: "Doppio click colonna", action: "Rinomina colonna" },
      { keys: "Type Mode", action: "Clic su colonna per aprire editor SQL contestuale" },
    ],
  },
];

const FILTERS: Array<{ id: "all" | ShortcutSectionId; label: string }> = [
  { id: "all", label: "Tutti" },
  ...SHORTCUT_SECTIONS.map((section) => ({ id: section.id, label: section.shortTitle })),
];

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function shortcutMatches(section: ShortcutSection, item: ShortcutItem, query: string) {
  if (!query) {
    return true;
  }

  return normalizeSearch(`${section.title} ${section.shortTitle} ${item.action} ${item.keys}`).includes(query);
}

function splitShortcutKeys(keys: string) {
  return keys.split(" / ").map((combo) => combo.trim().split(/\s+/).filter(Boolean));
}

export function KeyboardShortcutsModal(props: KeyboardShortcutsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<"all" | ShortcutSectionId>("all");
  const normalizedQuery = normalizeSearch(searchQuery);
  const visibleSections = useMemo(
    () =>
      SHORTCUT_SECTIONS
        .filter((section) => activeSection === "all" || section.id === activeSection)
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => shortcutMatches(section, item, normalizedQuery)),
        }))
        .filter((section) => section.items.length > 0),
    [activeSection, normalizedQuery],
  );
  const resultCount = visibleSections.reduce((count, section) => count + section.items.length, 0);

  return (
    <div className="studio-modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="studio-modal studio-modal--wide shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shortcuts-sheet">
          <div className="shortcuts-sheet-header">
            <div className="shortcuts-sheet-title-row">
              <span className="shortcuts-sheet-title-icon" aria-hidden="true">
                <StudioIcon name="keyboard" />
              </span>
              <div>
                <h2 id="keyboard-shortcuts-title" className="shortcuts-sheet-title">Keyboard shortcuts</h2>
                <p className="shortcuts-sheet-subtitle">Comandi rapidi supportati da ER Studio.</p>
              </div>
            </div>
            <button
              type="button"
              className="studio-modal__close shortcuts-sheet-close"
              onClick={props.onClose}
              aria-label="Chiudi scorciatoie"
            >
              <StudioIcon name="close" aria-hidden="true" />
            </button>
          </div>

          <div className="shortcuts-sheet-controls">
            <label className="shortcuts-sheet-search">
              <StudioIcon name="search" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cerca comando o scorciatoia..."
                aria-label="Cerca comando o scorciatoia"
                autoFocus
              />
            </label>
            <div className="shortcuts-sheet-tabs" aria-label="Filtra scorciatoie">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={filter.id === activeSection ? "shortcuts-sheet-tab active" : "shortcuts-sheet-tab"}
                  onClick={() => setActiveSection(filter.id)}
                  aria-pressed={filter.id === activeSection}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="shortcuts-sheet-list" aria-live="polite">
            {visibleSections.length > 0 ? (
              visibleSections.map((section) => (
                <section key={section.id} className="shortcuts-sheet-section" aria-labelledby={`shortcuts-section-${section.id}`}>
                  <div className="shortcuts-sheet-section-title" id={`shortcuts-section-${section.id}`}>
                    <StudioIcon name={section.icon} aria-hidden="true" />
                    <span>{section.title}</span>
                  </div>
                  <div className="shortcuts-sheet-section-list">
                    {section.items.map((item) => (
                      <div key={`${section.id}-${item.keys}-${item.action}`} className="shortcuts-sheet-row">
                        <span className="shortcuts-sheet-action">{item.action}</span>
                        <span className="shortcuts-sheet-keys" aria-label={`Scorciatoia: ${item.keys}`}>
                          {splitShortcutKeys(item.keys).map((combo, comboIndex) => (
                            <span key={`${item.keys}-${comboIndex}`} className="shortcuts-sheet-key-combo">
                              {combo.map((key) => (
                                <kbd key={`${comboIndex}-${key}`} className="shortcuts-sheet-kbd">{key}</kbd>
                              ))}
                            </span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="shortcuts-sheet-empty" role="status">
                <StudioIcon name="search" aria-hidden="true" />
                <strong>Nessuna scorciatoia trovata</strong>
                <span>Prova con un comando, una categoria o una combinazione di tasti diversa.</span>
              </div>
            )}
          </div>

          <div className="shortcuts-sheet-footer">
            {resultCount} {resultCount === 1 ? "scorciatoia" : "scorciatoie"} visibili
          </div>
        </div>
      </div>
    </div>
  );
}
