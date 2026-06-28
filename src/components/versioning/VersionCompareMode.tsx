import { useEffect, useMemo, useState } from "react";
import type { ProjectCommitSnapshot, ProjectVersioningState } from "../../features/versioning/projectCommitSnapshot";
import {
  buildVersionCompareVisualModel,
  type VersionCompareRef,
  type VersionCompareViewMode,
  type VersionCompareVisualModel,
} from "../../features/versioning/projectVersionVisualDiff";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";
import { VersionCompareWorkspaceInstance } from "./VersionCompareWorkspaceInstance";

interface VersionCompareModeProps {
  appTitle: string;
  appVersion: string;
  versioning: ProjectVersioningState;
  currentSnapshot: ProjectCommitSnapshot;
  initialLeft: VersionCompareRef;
  initialRight: VersionCompareRef;
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

export function VersionCompareMode({
  appTitle,
  appVersion,
  versioning,
  currentSnapshot,
  initialLeft,
  initialRight,
  restoreDialogOpen = false,
  onExitCompareMode,
}: VersionCompareModeProps) {
  const { t } = useI18n();
  const [leftViewMode, setLeftViewMode] = useState<VersionCompareViewMode>("er");
  const [rightViewMode, setRightViewMode] = useState<VersionCompareViewMode>("er");

  useEffect(() => {
    setLeftViewMode("er");
    setRightViewMode("er");
  }, [initialLeft, initialRight]);

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

  const visualModelResult = useMemo(
    () => buildVersionCompareVisualModel(versioning, currentSnapshot, initialLeft, initialRight),
    [currentSnapshot, initialLeft, initialRight, versioning],
  );

  const missingMessage =
    visualModelResult.status === "missing-head"
      ? t("versioning.visualCompare.missingHead")
      : visualModelResult.status === "missing-commit"
        ? t("versioning.diff.commitNotFound", { commitId: visualModelResult.commitId })
        : "";
  const model = visualModelResult.status === "ok" ? localizeModel(visualModelResult.model, t) : null;
  const leftHighlights = model?.highlights.left ?? null;
  const rightHighlights = model?.highlights.right ?? null;

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

      {model && leftHighlights && rightHighlights ? (
        <div className="version-compare-mode-body">
          <section className="version-compare-mode-main">
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
