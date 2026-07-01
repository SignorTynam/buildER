import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface WorkspaceWelcomePageProps {
  projectName: string;
  fileCount?: number;
  folderCount?: number;
  onNewSchema: () => void;
  onNewNote: () => void;
  onNewSql: () => void;
  onOpenProject: () => void;
  onImportSchema: () => void;
}

export function WorkspaceWelcomePage({
  projectName,
  fileCount = 0,
  folderCount = 0,
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
        <div className="workspace-welcome-hero">
          <div className="workspace-welcome-logo" aria-label={t("workspaceWelcome.logoAria")}>
            <span>ER</span>
          </div>
          <div>
            <p className="workspace-welcome-page__eyebrow">{projectName}</p>
            <h1>{t("workspaceWelcome.title")}</h1>
            <p className="workspace-welcome-page__subtitle">{t("workspaceWelcome.subtitle")}</p>
          </div>
        </div>

        <div className="workspace-welcome-grid">
          <section className="workspace-welcome-panel workspace-welcome-page__start" aria-label={t("workspaceWelcome.start")}>
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
          </section>

          <section className="workspace-welcome-panel workspace-welcome-project">
            <h2>{t("workspaceWelcome.projectSection")}</h2>
            <dl>
              <div>
                <dt>{t("workspaceWelcome.projectName")}</dt>
                <dd>{projectName}</dd>
              </div>
              <div>
                <dt>{t("workspaceWelcome.projectFiles")}</dt>
                <dd>{t("workspaceWelcome.fileFolderCount", { files: fileCount, folders: folderCount })}</dd>
              </div>
            </dl>
          </section>

          <section className="workspace-welcome-panel workspace-welcome-tips">
            <h2>{t("workspaceWelcome.tipsSection")}</h2>
            <ul>
              <li>{t("workspaceWelcome.tipExplorer")}</li>
              <li>{t("workspaceWelcome.tipReverse")}</li>
              <li>{t("workspaceWelcome.tipVersioning")}</li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
