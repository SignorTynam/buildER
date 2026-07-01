import { useEffect, useMemo, useState } from "react";
import type { ProjectCommitSnapshot, ProjectVersioningState } from "../../features/versioning/projectCommitSnapshot";
import { buildProjectVersionDiff } from "../../features/versioning/projectVersionDiff";
import {
  buildVersionCompareScopeOptions,
  buildVersionCompareVisualModel,
  getScopedTextFileContents,
  resolveVersionCompareSides,
  type VersionCompareRef,
  type VersionCompareScope,
  type VersionCompareScopeOption,
  type VersionCompareViewMode,
  type VersionCompareSideResolved,
  type VersionCompareVisualModel,
} from "../../features/versioning/projectVersionVisualDiff";
import type { ProjectVersionDiffSectionKey } from "../../features/versioning/projectVersionDiff";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";
import type { StudioIconName } from "../icons/StudioIcon";
import { VersionCompareTextDiff } from "./VersionCompareTextDiff";
import { VersionCompareWorkspaceInstance } from "./VersionCompareWorkspaceInstance";

interface VersionCompareModeProps {
  appTitle: string;
  appVersion: string;
  versioning: ProjectVersioningState;
  currentSnapshot: ProjectCommitSnapshot;
  initialLeft: VersionCompareRef;
  initialRight: VersionCompareRef;
  initialScope?: VersionCompareScope | null;
  restoreDialogOpen?: boolean;
  onExitCompareMode: () => void;
}

function localizeSide(
  side: VersionCompareVisualModel["left"],
  t: ReturnType<typeof useI18n>["t"],
): VersionCompareVisualModel["left"] {
  if (side.ref.kind === "working-copy") {
    return { ...side, label: t("versioning.visualCompare.workingCopy") };
  }

  if (side.ref.kind === "head") {
    return { ...side, label: t("versioning.visualCompare.head") };
  }

  return side;
}

function localizeModel(model: VersionCompareVisualModel, t: ReturnType<typeof useI18n>["t"]): VersionCompareVisualModel {
  const left = localizeSide(model.left, t);
  const right = localizeSide(model.right, t);
  return {
    ...model,
    left,
    right,
    diff: {
      ...model.diff,
      leftLabel: left.label,
      rightLabel: right.label,
    },
  };
}

function localizeResolvedSide(side: VersionCompareSideResolved, t: ReturnType<typeof useI18n>["t"]): VersionCompareSideResolved {
  if (side.ref.kind === "working-copy") {
    return { ...side, label: t("versioning.visualCompare.workingCopy") };
  }

  if (side.ref.kind === "head") {
    return { ...side, label: t("versioning.visualCompare.head") };
  }

  return side;
}

function getFileIcon(kind: string): StudioIconName {
  if (kind === "schema") {
    return "entity";
  }

  if (kind === "sql") {
    return "database";
  }

  if (kind === "unknown") {
    return "type";
  }

  return "fileText";
}

function getFileBadge(kind: string): string {
  if (kind === "schema") {
    return ".erschema";
  }

  if (kind === "sql") {
    return ".sql";
  }

  if (kind === "text") {
    return ".txt";
  }

  return "file";
}

function getStatusLabel(status: string, t: ReturnType<typeof useI18n>["t"]): string {
  switch (status) {
    case "added":
      return t("versioning.compareScope.fileAdded");
    case "deleted":
      return t("versioning.compareScope.fileDeleted");
    case "renamed":
      return t("versioning.compareScope.fileRenamed");
    case "unchanged":
      return t("versioning.compareScope.fileUnchanged");
    case "modified":
    default:
      return t("versioning.compareScope.fileModified");
  }
}

function scopeLabel(scope: VersionCompareScope, options: VersionCompareScopeOption[], t: ReturnType<typeof useI18n>["t"]) {
  if (scope.kind === "project") {
    return t("versioning.compareScope.project");
  }

  if (scope.kind === "project-tree") {
    return t("versioning.compareScope.projectTree");
  }

  const fileOption = options.find(
    (option): option is Extract<VersionCompareScopeOption, { kind: "file" }> =>
      option.kind === "file" && option.file.fileId === scope.fileId,
  );
  return fileOption?.file.name ?? scope.fileId;
}

function getPreferredFileView(kind: string): "er" | "text" | "sql" {
  if (kind === "schema") {
    return "er";
  }

  if (kind === "sql") {
    return "sql";
  }

  return "text";
}

const OVERVIEW_SECTIONS: ProjectVersionDiffSectionKey[] = ["project", "files", "folders", "schemas", "notes", "sql"];

export function VersionCompareMode({
  appTitle,
  appVersion,
  versioning,
  currentSnapshot,
  initialLeft,
  initialRight,
  initialScope = null,
  restoreDialogOpen = false,
  onExitCompareMode,
}: VersionCompareModeProps) {
  const { t } = useI18n();
  const [leftViewMode, setLeftViewMode] = useState<VersionCompareViewMode>("er");
  const [rightViewMode, setRightViewMode] = useState<VersionCompareViewMode>("er");
  const [selectedScope, setSelectedScope] = useState<VersionCompareScope | null>(initialScope);
  const [showUnchanged, setShowUnchanged] = useState(false);

  useEffect(() => {
    setLeftViewMode("er");
    setRightViewMode("er");
    setSelectedScope(initialScope);
    setShowUnchanged(false);
  }, [initialLeft, initialRight, initialScope]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true;

      if (isEditingField) {
        return;
      }

      if (event.key === "Escape" && !restoreDialogOpen) {
        event.preventDefault();
        onExitCompareMode();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onExitCompareMode, restoreDialogOpen]);

  const sidesResult = useMemo(
    () => resolveVersionCompareSides(versioning, currentSnapshot, initialLeft, initialRight),
    [currentSnapshot, initialLeft, initialRight, versioning],
  );

  const scopeOptions = useMemo(() => {
    if (sidesResult.status !== "ok") {
      return [];
    }
    return buildVersionCompareScopeOptions(sidesResult.left.snapshot, sidesResult.right.snapshot, {
      includeUnchanged: showUnchanged,
    });
  }, [showUnchanged, sidesResult]);

  const visualModelResult = useMemo(
    () =>
      selectedScope
        ? buildVersionCompareVisualModel(versioning, currentSnapshot, initialLeft, initialRight, selectedScope)
        : null,
    [currentSnapshot, initialLeft, initialRight, selectedScope, versioning],
  );

  const missingResult = visualModelResult ?? sidesResult;
  const missingMessage =
    missingResult.status === "missing-head"
      ? t("versioning.visualCompare.missingHead")
      : missingResult.status === "missing-commit"
        ? t("versioning.diff.commitNotFound", { commitId: missingResult.commitId })
        : "";
  const model = visualModelResult?.status === "ok" ? localizeModel(visualModelResult.model, t) : null;
  const leftHighlights = model?.highlights.left ?? null;
  const rightHighlights = model?.highlights.right ?? null;
  const resolvedSides =
    sidesResult.status === "ok"
      ? {
          left: localizeResolvedSide(sidesResult.left, t),
          right: localizeResolvedSide(sidesResult.right, t),
        }
      : null;
  const projectDiff = resolvedSides
    ? buildProjectVersionDiff(sidesResult.status === "ok" ? sidesResult.left.snapshot : currentSnapshot, sidesResult.status === "ok" ? sidesResult.right.snapshot : currentSnapshot, {
        leftLabel: resolvedSides.left.label,
        rightLabel: resolvedSides.right.label,
        leftCommitId: resolvedSides.left.commitId,
        rightCommitId: resolvedSides.right.commitId,
      })
    : null;
  const selectedFileOption =
    selectedScope?.kind === "file"
      ? scopeOptions.find((option) => option.kind === "file" && option.file.fileId === selectedScope.fileId)
      : null;
  const scopedText =
    selectedScope?.kind === "file" && resolvedSides
      ? getScopedTextFileContents(sidesResult.status === "ok" ? sidesResult.left.snapshot : currentSnapshot, sidesResult.status === "ok" ? sidesResult.right.snapshot : currentSnapshot, selectedScope.fileId)
      : null;

  function renderScopePicker() {
    return (
      <div className="version-compare-mode-body">
        <section className="version-compare-scope-picker" data-testid="version-compare-scope-picker">
          <header className="version-compare-scope-header">
            <div>
              <span>{t("versioning.visualCompare.modeTitle")}</span>
              <strong>{t("versioning.compareScope.title")}</strong>
              <p>{t("versioning.compareScope.description")}</p>
            </div>
            {resolvedSides ? (
              <small>
                {resolvedSides.left.label} {"->"} {resolvedSides.right.label}
              </small>
            ) : null}
          </header>
          <label className="version-compare-show-unchanged">
            <input type="checkbox" checked={showUnchanged} onChange={(event) => setShowUnchanged(event.target.checked)} />
            <span>{t("versioning.compareScope.showUnchanged")}</span>
          </label>
          <div className="version-compare-scope-list">
            {scopeOptions.map((option) => {
              if (option.kind === "project" || option.kind === "legacy-diagram") {
                return (
                  <button
                    key={option.kind}
                    type="button"
                    className="version-compare-scope-option"
                    onClick={() => setSelectedScope({ kind: "project" })}
                    data-testid="version-compare-scope-project"
                  >
                    <StudioIcon name="branch" aria-hidden="true" />
                    <span>
                      <strong>{option.kind === "legacy-diagram" ? t("versioning.compareScope.legacyDiagram") : t("versioning.compareScope.project")}</strong>
                      <small>{option.kind === "legacy-diagram" ? t("versioning.visualCompare.subtitle") : t("versioning.compareScope.projectOverview")}</small>
                    </span>
                    <em>{option.changed ? t("versioning.compareScope.fileModified") : t("versioning.compareScope.fileUnchanged")}</em>
                  </button>
                );
              }

              if (option.kind === "project-tree") {
                return (
                  <button
                    key={option.kind}
                    type="button"
                    className="version-compare-scope-option"
                    onClick={() => setSelectedScope({ kind: "project-tree" })}
                    data-testid="version-compare-scope-project-tree"
                  >
                    <StudioIcon name="openProject" aria-hidden="true" />
                    <span>
                      <strong>{t("versioning.compareScope.projectTree")}</strong>
                      <small>{t("versioning.compareScope.projectTreeDescription")}</small>
                    </span>
                    <em>{t("versioning.compareScope.fileModified")}</em>
                  </button>
                );
              }

              const { file } = option;
              return (
                <button
                  key={file.fileId}
                  type="button"
                  className="version-compare-scope-option"
                  onClick={() => setSelectedScope({ kind: "file", fileId: file.fileId, preferredView: getPreferredFileView(file.kind) })}
                  data-testid={`version-compare-scope-file-${file.fileId}`}
                >
                  <StudioIcon name={getFileIcon(file.kind)} aria-hidden="true" />
                  <span>
                    <strong>{file.name}</strong>
                    <small>
                      {file.path}
                      {file.status === "renamed" && file.leftPath && file.rightPath ? ` (${file.leftPath} -> ${file.rightPath})` : ""}
                    </small>
                  </span>
                  <mark>{getFileBadge(file.kind)}</mark>
                  <em>{getStatusLabel(file.status, t)}</em>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  function renderScopeToolbar() {
    return (
      <div className="version-compare-scope-toolbar">
        <span>{selectedScope ? scopeLabel(selectedScope, scopeOptions, t) : ""}</span>
        <button type="button" onClick={() => setSelectedScope(null)} data-testid="version-compare-change-scope">
          {t("versioning.compareScope.changeSelection")}
        </button>
      </div>
    );
  }

  function renderProjectOverview(treeOnly = false) {
    if (!projectDiff) {
      return null;
    }

    const sections = treeOnly ? (["project", "files", "folders"] as ProjectVersionDiffSectionKey[]) : OVERVIEW_SECTIONS;
    return (
      <div className="version-compare-mode-body">
        <section className="version-compare-overview" data-testid={treeOnly ? "version-compare-project-tree" : "version-compare-project-overview"}>
          {renderScopeToolbar()}
          <header className="version-compare-scope-header">
            <div>
              <span>{treeOnly ? t("versioning.compareScope.projectTree") : t("versioning.compareScope.projectOverview")}</span>
              <strong>{treeOnly ? t("versioning.compareScope.projectTree") : t("versioning.compareScope.project")}</strong>
            </div>
            <small>
              +{projectDiff.summary.addedCount} / -{projectDiff.summary.removedCount} / {projectDiff.summary.modifiedCount} modified
            </small>
          </header>
          <div className="version-compare-overview-sections">
            {sections.map((key) => {
              const section = projectDiff.sections[key];
              return (
                <article key={key} className={section.changed ? "is-changed" : ""}>
                  <strong>{key}</strong>
                  <span>{section.added.length} added</span>
                  <span>{section.removed.length} removed</span>
                  <span>{section.modified.length} modified</span>
                </article>
              );
            })}
          </div>
          {!treeOnly ? (
            <div className="version-compare-overview-files">
              <h2>{t("versioning.compareScope.changedFiles")}</h2>
              {scopeOptions.filter((option) => option.kind === "file").map((option) => {
                if (option.kind !== "file") {
                  return null;
                }
                return (
                  <button
                    key={option.file.fileId}
                    type="button"
                    onClick={() =>
                      setSelectedScope({
                        kind: "file",
                        fileId: option.file.fileId,
                        preferredView: getPreferredFileView(option.file.kind),
                      })
                    }
                    data-testid={`version-compare-overview-file-${option.file.fileId}`}
                  >
                    <StudioIcon name={getFileIcon(option.file.kind)} aria-hidden="true" />
                    <span>
                      <strong>{option.file.name}</strong>
                      <small>{option.file.path}</small>
                    </span>
                    <em>{getStatusLabel(option.file.status, t)}</em>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  function renderMissingSchemaSide(side: "left" | "right", label: string) {
    return (
      <section className={`version-compare-instance is-${side}`} data-testid={`version-compare-instance-${side}`}>
        <header className="version-compare-instance-header">
          <div>
            <span>{side === "left" ? t("versioning.visualCompare.leftWorkspace") : t("versioning.visualCompare.rightWorkspace")}</span>
            <strong>{label}</strong>
          </div>
        </header>
        <div className="version-compare-instance-real-workspace">
          <div className="version-compare-empty-logical" data-testid={`version-compare-${side}-missing-file`}>
            <StudioIcon name="fileText" aria-hidden="true" />
            <strong>{side === "left" ? t("versioning.compareScope.noFileInLeft") : t("versioning.compareScope.noFileInRight")}</strong>
          </div>
        </div>
      </section>
    );
  }

  return (
    <main
      className="version-compare-mode"
      data-testid="version-compare-mode"
      aria-label={t("versioning.visualCompare.compareModeAria")}
    >
      <header className="designer-topbar version-compare-topbar">
        <div className="designer-brand" aria-label={t("appHeader.brandAria")}>
          <strong>{appTitle}</strong>
          <span>v{appVersion}</span>
        </div>
        <div className="designer-project-name version-compare-title" aria-label={t("versioning.visualCompare.modeTitle")}>
          {t("versioning.visualCompare.modeTitle")}
        </div>
        <div className="designer-topbar-actions">
        <button
          type="button"
          className="version-compare-exit-button"
          onClick={onExitCompareMode}
          data-testid="exit-version-compare-mode"
          aria-label={t("versioning.visualCompare.exitCompare")}
        >
          <StudioIcon name="close" aria-hidden="true" />
          <span className="desktop-label">{t("versioning.visualCompare.exitCompare")}</span>
        </button>
        </div>
      </header>

      {sidesResult.status !== "ok" ? (
        <section className="version-compare-mode-error">
          <StudioIcon name="warning" aria-hidden="true" />
          <strong>{t("versioning.visualCompare.modeTitle")}</strong>
          <p>{missingMessage}</p>
        </section>
      ) : !selectedScope ? (
        renderScopePicker()
      ) : selectedScope.kind === "project" && scopeOptions.some((option) => option.kind === "legacy-diagram") ? (
        model && leftHighlights && rightHighlights ? (
          <div className="version-compare-mode-body">
            <section className="version-compare-mode-main">
              {renderScopeToolbar()}
              <div className="version-compare-mode-grid">
                <VersionCompareWorkspaceInstance
                  side="left"
                  resolved={model.left}
                  viewMode={leftViewMode}
                  diagramHighlights={leftHighlights.diagram}
                  logicalHighlights={leftHighlights.logical}
                  onViewModeChange={setLeftViewMode}
                />
                <VersionCompareWorkspaceInstance
                  side="right"
                  resolved={model.right}
                  viewMode={rightViewMode}
                  diagramHighlights={rightHighlights.diagram}
                  logicalHighlights={rightHighlights.logical}
                  onViewModeChange={setRightViewMode}
                />
              </div>
            </section>
          </div>
        ) : null
      ) : selectedScope.kind === "project" ? (
        renderProjectOverview(false)
      ) : selectedScope.kind === "project-tree" ? (
        renderProjectOverview(true)
      ) : scopedText ? (
        <div className="version-compare-mode-body">
          <section className="version-compare-mode-main">
            {renderScopeToolbar()}
            <VersionCompareTextDiff
              leftLabel={resolvedSides?.left.label ?? ""}
              rightLabel={resolvedSides?.right.label ?? ""}
              fileName={scopedText.fileName}
              leftContent={scopedText.leftContent}
              rightContent={scopedText.rightContent}
              language={scopedText.language}
              leftMissing={scopedText.leftMissing}
              rightMissing={scopedText.rightMissing}
            />
          </section>
        </div>
      ) : model && leftHighlights && rightHighlights ? (
        <div className="version-compare-mode-body">
          <section className="version-compare-mode-main">
            {renderScopeToolbar()}
            {selectedFileOption?.kind === "file" ? null : null}
            <div className="version-compare-mode-grid">
              {model.left.missingFile ? (
                renderMissingSchemaSide("left", model.left.label)
              ) : (
                <VersionCompareWorkspaceInstance
                  side="left"
                  resolved={model.left}
                  viewMode={leftViewMode}
                  diagramHighlights={leftHighlights.diagram}
                  logicalHighlights={leftHighlights.logical}
                  onViewModeChange={setLeftViewMode}
                />
              )}
              {model.right.missingFile ? (
                renderMissingSchemaSide("right", model.right.label)
              ) : (
                <VersionCompareWorkspaceInstance
                  side="right"
                  resolved={model.right}
                  viewMode={rightViewMode}
                  diagramHighlights={rightHighlights.diagram}
                  logicalHighlights={rightHighlights.logical}
                  onViewModeChange={setRightViewMode}
                />
              )}
            </div>
          </section>
        </div>
      ) : (
        <section className="version-compare-mode-error">
          <StudioIcon name="warning" aria-hidden="true" />
          <strong>{t("versioning.visualCompare.modeTitle")}</strong>
          <p>{missingMessage}</p>
        </section>
      )}
    </main>
  );
}
