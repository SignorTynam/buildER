import { useMemo, useState } from "react";
import type { Locale } from "../i18n";
import { useI18n } from "../i18n/useI18n";
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

function normalizeSearch(value: string, locale: Locale) {
  return value
    .trim()
    .toLocaleLowerCase(locale)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function shortcutMatches(section: ShortcutSection, item: ShortcutItem, query: string, locale: Locale) {
  if (!query) {
    return true;
  }

  return normalizeSearch(`${section.title} ${section.shortTitle} ${item.action} ${item.keys}`, locale).includes(query);
}

function splitShortcutKeys(keys: string) {
  return keys.split(" / ").map((combo) => combo.trim().split(/\s+/).filter(Boolean));
}

export function KeyboardShortcutsModal(props: KeyboardShortcutsModalProps) {
  const { locale, t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<"all" | ShortcutSectionId>("all");

  const shortcutSections: ShortcutSection[] = useMemo(
    () => [
      {
        id: "standard",
        title: t("keyboardShortcuts.sections.standard.title"),
        shortTitle: t("keyboardShortcuts.sections.standard.shortTitle"),
        icon: "keyboard",
        items: [
          { keys: "Ctrl/Cmd S", action: t("keyboardShortcuts.actions.saveProject") },
          { keys: "Ctrl/Cmd Z", action: t("keyboardShortcuts.actions.undo") },
          { keys: "Ctrl/Cmd Shift Z", action: t("keyboardShortcuts.actions.redo") },
          { keys: "Ctrl/Cmd Y", action: t("keyboardShortcuts.actions.redo") },
          { keys: "Esc", action: t("keyboardShortcuts.actions.escape") },
        ],
      },
      {
        id: "workspace",
        title: t("keyboardShortcuts.sections.workspace.title"),
        shortTitle: t("keyboardShortcuts.sections.workspace.shortTitle"),
        icon: "show",
        items: [
          { keys: "Ctrl/Cmd I", action: t("keyboardShortcuts.actions.toggleTechnicalDock") },
          { keys: "Ctrl/Cmd .", action: t("keyboardShortcuts.actions.focusMode") },
          { keys: "Ctrl/Cmd C", action: t("keyboardShortcuts.actions.copySelection") },
          { keys: "Ctrl/Cmd V", action: t("keyboardShortcuts.actions.pasteSelection") },
          { keys: "Ctrl/Cmd D", action: t("keyboardShortcuts.actions.duplicateSelection") },
          { keys: "Delete / Backspace", action: t("keyboardShortcuts.actions.deleteSelection") },
        ],
      },
      {
        id: "er",
        title: t("keyboardShortcuts.sections.er.title"),
        shortTitle: t("keyboardShortcuts.sections.er.shortTitle"),
        icon: "design",
        items: [
          { keys: "V", action: t("keyboardShortcuts.actions.selectTool") },
          { keys: "S", action: t("keyboardShortcuts.actions.moveTool") },
          { keys: "E", action: t("keyboardShortcuts.actions.entityTool") },
          { keys: "R", action: t("keyboardShortcuts.actions.relationshipTool") },
          { keys: "A", action: t("keyboardShortcuts.actions.attributeTool") },
          { keys: "C", action: t("keyboardShortcuts.actions.connectorTool") },
          { keys: "G", action: t("keyboardShortcuts.actions.generalizationTool") },
          { keys: "X", action: t("keyboardShortcuts.actions.deleteTool") },
        ],
      },
      {
        id: "canvas",
        title: t("keyboardShortcuts.sections.canvas.title"),
        shortTitle: t("keyboardShortcuts.sections.canvas.shortTitle"),
        icon: "fit",
        items: [
          { keys: "Tab", action: t("keyboardShortcuts.actions.focusNodes") },
          { keys: "Enter", action: t("keyboardShortcuts.actions.renameFocused") },
          { keys: t("keyboardShortcuts.keys.arrows"), action: t("keyboardShortcuts.actions.movePrecise") },
          { keys: "+ / -", action: t("keyboardShortcuts.actions.zoomWhenFocused") },
          { keys: t("keyboardShortcuts.keys.wheel"), action: t("keyboardShortcuts.actions.wheelZoom") },
          { keys: t("keyboardShortcuts.keys.middleButtonDrag"), action: t("keyboardShortcuts.actions.middleButtonPan") },
        ],
      },
      {
        id: "code",
        title: t("keyboardShortcuts.sections.code.title"),
        shortTitle: t("keyboardShortcuts.sections.code.shortTitle"),
        icon: "code",
        items: [
          { keys: "Tab", action: t("keyboardShortcuts.actions.insertTab") },
          { keys: "( [ {", action: t("keyboardShortcuts.actions.autoPair") },
          { keys: ") ] }", action: t("keyboardShortcuts.actions.skipClosingBracket") },
        ],
      },
      {
        id: "logical",
        title: t("keyboardShortcuts.sections.logical.title"),
        shortTitle: t("keyboardShortcuts.sections.logical.shortTitle"),
        icon: "database",
        items: [
          { keys: t("keyboardShortcuts.keys.doubleClickTable"), action: t("keyboardShortcuts.actions.renameTable") },
          { keys: t("keyboardShortcuts.keys.doubleClickColumn"), action: t("keyboardShortcuts.actions.renameColumn") },
          { keys: t("keyboardShortcuts.keys.typeMode"), action: t("keyboardShortcuts.actions.typeMode") },
        ],
      },
    ],
    [t],
  );
  const filters: Array<{ id: "all" | ShortcutSectionId; label: string }> = useMemo(
    () => [
      { id: "all", label: t("keyboardShortcuts.filters.all") },
      ...shortcutSections.map((section) => ({ id: section.id, label: section.shortTitle })),
    ],
    [shortcutSections, t],
  );
  const normalizedQuery = normalizeSearch(searchQuery, locale);
  const visibleSections = useMemo(
    () =>
      shortcutSections
        .filter((section) => activeSection === "all" || section.id === activeSection)
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => shortcutMatches(section, item, normalizedQuery, locale)),
        }))
        .filter((section) => section.items.length > 0),
    [activeSection, locale, normalizedQuery, shortcutSections],
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
                <h2 id="keyboard-shortcuts-title" className="shortcuts-sheet-title">{t("keyboardShortcuts.title")}</h2>
                <p className="shortcuts-sheet-subtitle">{t("keyboardShortcuts.subtitle")}</p>
              </div>
            </div>
            <button
              type="button"
              className="studio-modal__close shortcuts-sheet-close"
              onClick={props.onClose}
              aria-label={t("keyboardShortcuts.closeAria")}
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
                placeholder={t("keyboardShortcuts.searchPlaceholder")}
                aria-label={t("keyboardShortcuts.searchAria")}
                autoFocus
              />
            </label>
            <div className="shortcuts-sheet-tabs" aria-label={t("keyboardShortcuts.filterAria")}>
              {filters.map((filter) => (
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
                        <span className="shortcuts-sheet-keys" aria-label={t("keyboardShortcuts.shortcutAria", { keys: item.keys })}>
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
                <strong>{t("keyboardShortcuts.emptyTitle")}</strong>
                <span>{t("keyboardShortcuts.emptyDescription")}</span>
              </div>
            )}
          </div>

          <div className="shortcuts-sheet-footer">
            {t("keyboardShortcuts.visibleCount", { count: resultCount })}
          </div>
        </div>
      </div>
    </div>
  );
}
