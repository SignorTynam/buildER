import type {
  ProjectVersionDiffItem,
  ProjectVersionDiffResult,
  ProjectVersionDiffSectionKey,
} from "../../features/versioning/projectVersionDiff";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

export interface VersionCompareActiveChange {
  section: ProjectVersionDiffSectionKey;
  tone: "added" | "removed" | "modified";
  item: ProjectVersionDiffItem;
}

interface VersionCompareChangeDrawerProps {
  open: boolean;
  diff: ProjectVersionDiffResult;
  activeChange: VersionCompareActiveChange | null;
  onSelectChange: (change: VersionCompareActiveChange) => void;
  onClose: () => void;
}

const SECTION_KEYS: ProjectVersionDiffSectionKey[] = ["er", "layout", "logical", "code", "workspace"];

function ChangeGroup({
  section,
  tone,
  title,
  items,
  activeChange,
  onSelectChange,
}: {
  section: ProjectVersionDiffSectionKey;
  tone: "added" | "removed" | "modified";
  title: string;
  items: ProjectVersionDiffItem[];
  activeChange: VersionCompareActiveChange | null;
  onSelectChange: (change: VersionCompareActiveChange) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <details className={`version-compare-change-group is-${tone}`} open>
      <summary>
        <span>{title}</span>
        <strong>{items.length}</strong>
      </summary>
      <ul>
        {items.map((item) => {
          const selected =
            activeChange?.section === section &&
            activeChange.tone === tone &&
            activeChange.item.kind === item.kind &&
            activeChange.item.id === item.id;
          return (
            <li key={`${section}-${tone}-${item.kind}-${item.id}`}>
              <button
                type="button"
                className={selected ? "version-compare-change-item active" : "version-compare-change-item"}
                onClick={() => onSelectChange({ section, tone, item })}
                data-testid="visual-compare-change-item"
              >
                <span>{item.label}</span>
                <small>{item.kind}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function VersionCompareChangeDrawer({
  open,
  diff,
  activeChange,
  onSelectChange,
  onClose,
}: VersionCompareChangeDrawerProps) {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <aside className="version-compare-drawer" aria-label={t("versioning.visualCompare.detailsTitle")} data-testid="visual-compare-drawer">
      <div className="version-compare-drawer-head">
        <div>
          <span>{t("versioning.visualCompare.detailsTitle")}</span>
          <strong>{t("versioning.diff.changedSections")}: {diff.summary.changedSectionCount}</strong>
        </div>
        <button type="button" className="studio-modal__close" onClick={onClose} aria-label={t("common.actions.close")}>
          <StudioIcon name="close" aria-hidden="true" />
        </button>
      </div>
      {diff.isEqual ? (
        <div className="version-compare-empty-changes">
          <StudioIcon name="success" aria-hidden="true" />
          <p>{t("versioning.visualCompare.emptyChanges")}</p>
        </div>
      ) : (
        <div className="version-compare-drawer-scroll">
          {SECTION_KEYS.map((key) => {
            const section = diff.sections[key];
            return (
              <section key={key} className="version-compare-drawer-section">
                <h3>{t(`versioning.diff.sections.${key}`)}</h3>
                {!section.changed ? <p>{t("versioning.diff.noSectionChanges")}</p> : null}
                <ChangeGroup
                  section={key}
                  tone="added"
                  title={t("versioning.diff.added")}
                  items={section.added}
                  activeChange={activeChange}
                  onSelectChange={onSelectChange}
                />
                <ChangeGroup
                  section={key}
                  tone="removed"
                  title={t("versioning.diff.removed")}
                  items={section.removed}
                  activeChange={activeChange}
                  onSelectChange={onSelectChange}
                />
                <ChangeGroup
                  section={key}
                  tone="modified"
                  title={t("versioning.diff.modified")}
                  items={section.modified}
                  activeChange={activeChange}
                  onSelectChange={onSelectChange}
                />
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}
