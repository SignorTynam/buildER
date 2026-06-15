import { useMemo } from "react";
import type { MessageKey } from "../i18n";
import { useI18n } from "../i18n/useI18n";
import builderLogo from "../image/buildER no background.png";

const LOADING_TIP_KEYS = [
  "loading.tips.reverseSql",
  "loading.tips.codePanel",
  "loading.tips.export",
  "loading.tips.commandMenu",
  "loading.tips.logicalView",
  "loading.tips.importSql",
  "loading.tips.rename",
  "loading.tips.notes",
  "loading.tips.projectFile",
  "loading.tips.layout",
] as const satisfies readonly MessageKey[];

export function AppLoadingScreen() {
  const { t } = useI18n();
  const tipKey = useMemo(() => LOADING_TIP_KEYS[Math.floor(Math.random() * LOADING_TIP_KEYS.length)], []);

  return (
    <main className="app-loading-screen" data-testid="app-loading-screen" role="status" aria-live="polite">
      <section className="app-loading-card" aria-label={t("loading.cardAria")}>
        <img className="app-loading-logo" src={builderLogo} alt={t("app.name")} draggable={false} />
        <div className="app-loading-brand">
          <span>{t("app.name")}</span>
          <strong>{t("loading.status")}</strong>
        </div>
        <div className="app-loading-progress" aria-hidden="true">
          <span className="app-loading-progress-bar" />
        </div>
        <p className="app-loading-tip" data-testid="app-loading-tip">
          <span>{t("loading.tipLabel")}:</span> {t(tipKey)}
        </p>
      </section>
    </main>
  );
}
