import type { ProjectCommit } from "../../features/versioning/projectCommitSnapshot";
import type { VersionCompareRef } from "../../features/versioning/projectVersionVisualDiff";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface VersionCompareToolbarProps {
  leftRef: VersionCompareRef;
  rightRef: VersionCompareRef;
  commits: ProjectCommit[];
  headCommitId: string | null;
  syncViewport: boolean;
  detailsOpen: boolean;
  onLeftRefChange: (ref: VersionCompareRef) => void;
  onRightRefChange: (ref: VersionCompareRef) => void;
  onSyncViewportChange: (sync: boolean) => void;
  onFitBoth: () => void;
  onSwapSides: () => void;
  onToggleDetails: () => void;
  onRestoreCommit: (commitId: string) => void;
}

function encodeRef(ref: VersionCompareRef): string {
  return ref.kind === "commit" ? `commit:${ref.commitId}` : ref.kind;
}

function decodeRef(value: string): VersionCompareRef {
  if (value.startsWith("commit:")) {
    return { kind: "commit", commitId: value.slice("commit:".length) };
  }

  return value === "head" ? { kind: "head" } : { kind: "working-copy" };
}

function shortCommitId(id: string) {
  return id.slice(0, 8);
}

function formatCommitOption(commit: ProjectCommit) {
  return `${commit.message} (${shortCommitId(commit.id)})`;
}

function isCommitRef(ref: VersionCompareRef): ref is Extract<VersionCompareRef, { kind: "commit" }> {
  return ref.kind === "commit";
}

function VersionSelect({
  id,
  label,
  value,
  commits,
  headCommitId,
  onChange,
}: {
  id: string;
  label: string;
  value: VersionCompareRef;
  commits: ProjectCommit[];
  headCommitId: string | null;
  onChange: (ref: VersionCompareRef) => void;
}) {
  const { t } = useI18n();

  return (
    <label className="version-compare-select">
      <span>{label}</span>
      <select
        id={id}
        value={encodeRef(value)}
        onChange={(event) => onChange(decodeRef(event.target.value))}
        aria-label={label}
      >
        <option value="working-copy">{t("versioning.visualCompare.workingCopy")}</option>
        <option value="head" disabled={!headCommitId}>{t("versioning.visualCompare.head")}</option>
        {commits.map((commit) => (
          <option key={commit.id} value={`commit:${commit.id}`}>
            {formatCommitOption(commit)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function VersionCompareToolbar({
  leftRef,
  rightRef,
  commits,
  headCommitId,
  syncViewport,
  detailsOpen,
  onLeftRefChange,
  onRightRefChange,
  onSyncViewportChange,
  onFitBoth,
  onSwapSides,
  onToggleDetails,
  onRestoreCommit,
}: VersionCompareToolbarProps) {
  const { t } = useI18n();
  const restoreLeftVisible = isCommitRef(leftRef);
  const restoreRightVisible = isCommitRef(rightRef);

  return (
    <div className="version-compare-toolbar" data-testid="visual-compare-toolbar">
      <div className="version-compare-selectors">
        <VersionSelect
          id="version-compare-left"
          label={t("versioning.visualCompare.leftSide")}
          value={leftRef}
          commits={commits}
          headCommitId={headCommitId}
          onChange={onLeftRefChange}
        />
        <VersionSelect
          id="version-compare-right"
          label={t("versioning.visualCompare.rightSide")}
          value={rightRef}
          commits={commits}
          headCommitId={headCommitId}
          onChange={onRightRefChange}
        />
      </div>
      <div className="version-compare-actions">
        <label className="version-compare-sync-toggle">
          <input
            type="checkbox"
            checked={syncViewport}
            onChange={(event) => onSyncViewportChange(event.target.checked)}
          />
          <span>{t("versioning.visualCompare.syncViewport")}</span>
        </label>
        <button type="button" className="header-button" onClick={onFitBoth}>
          <StudioIcon name="fit" aria-hidden="true" />
          {t("versioning.visualCompare.fitBoth")}
        </button>
        <button type="button" className="header-button" onClick={onSwapSides}>
          <StudioIcon name="split" aria-hidden="true" />
          {t("versioning.visualCompare.swapSides")}
        </button>
        <button type="button" className="header-button" onClick={onToggleDetails} data-testid="visual-compare-toggle-details">
          <StudioIcon name="panelLeft" aria-hidden="true" />
          {detailsOpen ? t("versioning.visualCompare.closeDetails") : t("versioning.visualCompare.openDetails")}
        </button>
        {restoreLeftVisible ? (
          <button type="button" className="mode-button" onClick={() => onRestoreCommit(leftRef.commitId)}>
            {t("versioning.visualCompare.restoreLeft")}
          </button>
        ) : null}
        {restoreRightVisible ? (
          <button type="button" className="mode-button" onClick={() => onRestoreCommit(rightRef.commitId)}>
            {t("versioning.visualCompare.restoreRight")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
