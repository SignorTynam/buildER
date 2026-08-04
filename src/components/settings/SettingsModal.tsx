import { useId, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { SUPPORTED_LOCALES } from "../../i18n";
import type { Locale } from "../../i18n";
import { useI18n } from "../../i18n/useI18n";
import { useCanvasMinimapVisibility } from "../../hooks/useCanvasMinimapVisibility";
import { APP_VERSION } from "../../utils/appMeta";
import { StudioIcon } from "../icons/StudioIcon";
import type { StudioIconName } from "../icons/StudioIcon";
import { Badge, Button, Modal } from "../ui";

type SettingsSectionId = "appearance" | "diagram" | "info";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  /** Stato indicatori diagnostici (posseduto da App, condiviso col toggle in ErrorsPanel). */
  showDiagnostics: boolean;
  onShowDiagnosticsChange: (visible: boolean) => void;
  /** Aprono le superfici esistenti (App chiude prima le Impostazioni). */
  onOpenShortcuts: () => void;
  onOpenReleaseCenter: () => void;
}

const SETTINGS_SECTIONS: ReadonlyArray<{ id: SettingsSectionId; icon: StudioIconName }> = [
  { id: "appearance", icon: "settings" },
  { id: "diagram", icon: "entity" },
  { id: "info", icon: "info" },
];

/**
 * Fase I — schermata Impostazioni centralizzata (stile IDE).
 *
 * Non introduce comportamenti nuovi: raccoglie in un unico posto preferenze che già
 * esistono e restano sincronizzate con i loro controlli originali —
 * - Lingua → `useI18n().setLocale` (stessa fonte del menu header),
 * - Indicatori diagnostici → stato `showDiagnostics` di App (stesso toggle di ErrorsPanel),
 * - Minimap → store condiviso `useCanvasMinimapVisibility` (stesso toggle del canvas).
 * Tema e Densità sono segnaposto "in arrivo": è qui che atterreranno in fasi dedicate.
 */
export function SettingsModal({
  open,
  onClose,
  showDiagnostics,
  onShowDiagnosticsChange,
  onOpenShortcuts,
  onOpenReleaseCenter,
}: SettingsModalProps) {
  const { t, locale, setLocale, getLanguageMenuLabel } = useI18n();
  const [minimapVisible, setMinimapVisible] = useCanvasMinimapVisibility();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("appearance");
  const tabRefs = useRef(new Map<SettingsSectionId, HTMLButtonElement>());
  const languageSelectId = useId();
  const languageDescId = `${languageSelectId}-desc`;

  const tabId = (id: SettingsSectionId) => `settings-tab-${id}`;
  const panelId = (id: SettingsSectionId) => `settings-panel-${id}`;

  function handleNavKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (index + 1) % SETTINGS_SECTIONS.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      nextIndex = (index - 1 + SETTINGS_SECTIONS.length) % SETTINGS_SECTIONS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = SETTINGS_SECTIONS.length - 1;
    else return;
    event.preventDefault();
    const next = SETTINGS_SECTIONS[nextIndex];
    setActiveSection(next.id);
    tabRefs.current.get(next.id)?.focus();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("settings.title")}
      subtitle={t("settings.subtitle")}
      size="lg"
      className="settings-modal"
      testId="settings-modal"
    >
      <div className="settings-layout">
        <nav
          className="settings-nav"
          role="tablist"
          aria-orientation="vertical"
          aria-label={t("settings.sectionsAria")}
        >
          {SETTINGS_SECTIONS.map((section, index) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              id={tabId(section.id)}
              aria-selected={activeSection === section.id}
              aria-controls={panelId(section.id)}
              tabIndex={activeSection === section.id ? 0 : -1}
              ref={(element) => {
                if (element) tabRefs.current.set(section.id, element);
                else tabRefs.current.delete(section.id);
              }}
              className={activeSection === section.id ? "settings-nav__item is-active" : "settings-nav__item"}
              onClick={() => setActiveSection(section.id)}
              onKeyDown={(event) => handleNavKeyDown(event, index)}
            >
              <StudioIcon name={section.icon} aria-hidden="true" />
              <span>{t(`settings.sections.${section.id}`)}</span>
            </button>
          ))}
        </nav>

        <div
          className="settings-content"
          role="tabpanel"
          id={panelId(activeSection)}
          aria-labelledby={tabId(activeSection)}
        >
          {activeSection === "appearance" ? (
            <SettingsSection title={t("settings.sections.appearance")}>
              <div className="settings-row">
                <div className="settings-row__text">
                  <label htmlFor={languageSelectId} className="settings-row__label">
                    {t("settings.appearance.language.label")}
                  </label>
                  <p id={languageDescId} className="settings-row__desc">
                    {t("settings.appearance.language.help")}
                  </p>
                </div>
                <select
                  id={languageSelectId}
                  aria-describedby={languageDescId}
                  className="ui-select"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value as Locale)}
                >
                  {SUPPORTED_LOCALES.map((option) => (
                    <option key={option} value={option}>
                      {getLanguageMenuLabel(option)}
                    </option>
                  ))}
                </select>
              </div>

              <SettingsPlaceholderRow
                label={t("settings.appearance.theme.label")}
                description={t("settings.appearance.theme.help")}
                comingSoonLabel={t("settings.comingSoon")}
              />
              <SettingsPlaceholderRow
                label={t("settings.appearance.density.label")}
                description={t("settings.appearance.density.help")}
                comingSoonLabel={t("settings.comingSoon")}
              />
            </SettingsSection>
          ) : null}

          {activeSection === "diagram" ? (
            <SettingsSection title={t("settings.sections.diagram")}>
              <SettingsToggleRow
                label={t("settings.diagram.diagnostics.label")}
                description={t("settings.diagram.diagnostics.help")}
                checked={showDiagnostics}
                onChange={onShowDiagnosticsChange}
              />
              <SettingsToggleRow
                label={t("settings.diagram.minimap.label")}
                description={t("settings.diagram.minimap.help")}
                checked={minimapVisible}
                onChange={setMinimapVisible}
              />
            </SettingsSection>
          ) : null}

          {activeSection === "info" ? (
            <SettingsSection title={t("settings.sections.info")}>
              <div className="settings-row">
                <div className="settings-row__text">
                  <span className="settings-row__label">{t("settings.info.version.label")}</span>
                  <p className="settings-row__desc">{t("settings.info.version.help")}</p>
                </div>
                <span className="settings-row__value">{APP_VERSION}</span>
              </div>

              <div className="settings-row">
                <div className="settings-row__text">
                  <span className="settings-row__label">{t("settings.info.changelog.label")}</span>
                  <p className="settings-row__desc">{t("settings.info.changelog.help")}</p>
                </div>
                <Button variant="secondary" onClick={onOpenReleaseCenter}>
                  {t("settings.info.changelog.action")}
                </Button>
              </div>

              <div className="settings-row">
                <div className="settings-row__text">
                  <span className="settings-row__label">{t("settings.info.shortcuts.label")}</span>
                  <p className="settings-row__desc">{t("settings.info.shortcuts.help")}</p>
                </div>
                <Button variant="secondary" onClick={onOpenShortcuts}>
                  {t("settings.info.shortcuts.action")}
                </Button>
              </div>
            </SettingsSection>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-section" aria-label={title}>
      <h3 className="settings-section__title">{title}</h3>
      <div className="settings-section__body">{children}</div>
    </section>
  );
}

function SettingsToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className="settings-row">
      <div className="settings-row__text">
        <label htmlFor={id} className="settings-row__label">
          {label}
        </label>
        <p id={descId} className="settings-row__desc">
          {description}
        </p>
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="settings-switch"
        checked={checked}
        aria-describedby={descId}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

function SettingsPlaceholderRow({
  label,
  description,
  comingSoonLabel,
}: {
  label: string;
  description: string;
  comingSoonLabel: string;
}) {
  return (
    <div className="settings-row is-disabled" aria-disabled="true">
      <div className="settings-row__text">
        <span className="settings-row__label">
          {label}
          <Badge tone="neutral" className="settings-row__badge">
            {comingSoonLabel}
          </Badge>
        </span>
        <p className="settings-row__desc">{description}</p>
      </div>
    </div>
  );
}
