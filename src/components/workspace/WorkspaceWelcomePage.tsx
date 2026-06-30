import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface WorkspaceWelcomePageProps {
  projectName: string;
  onNewSchema: () => void;
  onNewNote: () => void;
  onNewSql: () => void;
  onOpenProject: () => void;
  onImportSchema: () => void;
}

export function WorkspaceWelcomePage({
  projectName,
  onNewSchema,
  onNewNote,
  onNewSql,
  onOpenProject,
  onImportSchema,
}: WorkspaceWelcomePageProps) {
  const { t } = useI18n();

  return (
    <main className="workspace-welcome-page" aria-label={t("workspaceWelcome.title")}>
      <section className="workspace-welcome-page__content">
        <p className="workspace-welcome-page__eyebrow">{projectName}</p>
        <h1>{t("workspaceWelcome.title")}</h1>
        <p className="workspace-welcome-page__subtitle">{t("workspaceWelcome.subtitle")}</p>

        <div className="workspace-welcome-page__start" aria-label={t("workspaceWelcome.start")}>
          <h2>{t("workspaceWelcome.start")}</h2>
          <button type="button" onClick={onNewSchema}>
            <StudioIcon name="entity" aria-hidden="true" />
            <span>{t("workspaceWelcome.newSchema")}</span>
          </button>
          <button type="button" onClick={onNewNote}>
            <StudioIcon name="fileText" aria-hidden="true" />
            <span>{t("workspaceWelcome.newNote")}</span>
          </button>
          <button type="button" onClick={onNewSql}>
            <StudioIcon name="database" aria-hidden="true" />
            <span>{t("workspaceWelcome.newSql")}</span>
          </button>
          <button type="button" onClick={onOpenProject}>
            <StudioIcon name="openProject" aria-hidden="true" />
            <span>{t("workspaceWelcome.openProject")}</span>
          </button>
          <button type="button" onClick={onImportSchema}>
            <StudioIcon name="download" aria-hidden="true" />
            <span>{t("workspaceWelcome.importSchema")}</span>
          </button>
        </div>

        <p className="workspace-welcome-page__hint">{t("workspaceWelcome.openSchemaHint")}</p>
      </section>
    </main>
  );
}
