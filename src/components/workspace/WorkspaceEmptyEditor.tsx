import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface WorkspaceEmptyEditorProps {
  onOpenWelcome: () => void;
  onNewSchema: () => void;
  onOpenProject: () => void;
}

export function WorkspaceEmptyEditor({
  onOpenWelcome,
  onNewSchema,
  onOpenProject,
}: WorkspaceEmptyEditorProps) {
  const { t } = useI18n();

  return (
    <main className="workspace-empty-editor" aria-label={t("workspaceEmpty.title")}>
      <div className="workspace-empty-editor__mark" aria-hidden="true">
        <StudioIcon name="info" />
      </div>
      <h1>{t("workspaceEmpty.title")}</h1>
      <p>{t("workspaceEmpty.description")}</p>
      <div className="workspace-empty-editor__actions">
        <button type="button" onClick={onOpenWelcome}>
          <StudioIcon name="info" aria-hidden="true" />
          <span>{t("workspaceEmpty.openWelcome")}</span>
        </button>
        <button type="button" onClick={onNewSchema}>
          <StudioIcon name="entity" aria-hidden="true" />
          <span>{t("workspaceEmpty.newSchema")}</span>
        </button>
        <button type="button" onClick={onOpenProject}>
          <StudioIcon name="openProject" aria-hidden="true" />
          <span>{t("workspaceEmpty.openProject")}</span>
        </button>
      </div>
    </main>
  );
}
