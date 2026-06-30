import { useState } from "react";
import type {
  ProjectVersionDiffItem,
  ProjectVersionDiffResult,
  ProjectVersionDiffSection,
  ProjectVersionDiffSectionKey,
} from "../../features/versioning/projectVersionDiff";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface VersionDiffDialogProps {
  open: boolean;
  diff: ProjectVersionDiffResult | null;
  onClose: () => void;
}

const SECTION_KEYS: ProjectVersionDiffSectionKey[] = [
  "project",
  "files",
  "folders",
  "schemas",
  "notes",
  "sql",
  "er",
  "layout",
  "logical",
  "code",
  "workspace",
];

function getItemKindKey(kind: string): string {
  switch (kind) {
    case "entity":
      return "entity";
    case "relationship":
      return "relationship";
    case "attribute":
      return "attribute";
    case "connector":
    case "inheritance":
      return "edge";
    case "generalization":
      return "generalization";
    case "node-position":
      return "nodeMoved";
    case "node-size":
      return "nodeResized";
    case "node-layout":
      return "layoutChanged";
    case "viewport":
      return "viewport";
    case "table":
      return "table";
    case "column":
      return "column";
    case "foreign-key":
      return "foreignKey";
    case "code-draft":
    case "code-dirty":
      return "code";
    case "workspace-field":
      return "workspace";
    default:
      return "generic";
  }
}

function DiffItem({ item }: { item: ProjectVersionDiffItem }) {
  const { t } = useI18n();

  return (
    <li className="version-diff-item">
      <div className="version-diff-item-head">
        <strong>{item.label}</strong>
        <span>{t(`versioning.diff.itemKinds.${getItemKindKey(item.kind)}`)}</span>
      </div>
      {item.before !== undefined || item.after !== undefined ? (
        <div className="version-diff-before-after">
          <div>
            <span>{t("versioning.diff.before")}</span>
            <strong>{item.before ?? "-"}</strong>
          </div>
          <div>
            <span>{t("versioning.diff.after")}</span>
            <strong>{item.after ?? "-"}</strong>
          </div>
        </div>
      ) : null}
      {item.details && item.details.length > 0 ? (
        <dl className="version-diff-details">
          {item.details.map((detail) => (
            <div key={`${item.id}-${detail.label}`}>
              <dt>{detail.label}</dt>
              <dd>
                <span>{detail.before ?? "-"}</span>
                <StudioIcon name="arrowRight" aria-hidden="true" />
                <span>{detail.after ?? "-"}</span>
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

function DiffGroup({
  title,
  items,
  tone,
}: {
  title: string;
  items: ProjectVersionDiffItem[];
  tone: "added" | "removed" | "modified";
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <details className={`version-diff-group is-${tone}`} open>
      <summary>
        <span>{title}</span>
        <strong>{items.length}</strong>
      </summary>
      <ul>
        {items.map((item) => (
          <DiffItem key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </ul>
    </details>
  );
}

function DiffSection({ section }: { section: ProjectVersionDiffSection }) {
  const { t } = useI18n();

  return (
    <section className="version-diff-section" data-testid={`version-diff-section-${section.key}`}>
      <div className="version-diff-section-head">
        <h3>{t(`versioning.diff.sections.${section.key}`)}</h3>
        <div className="version-diff-section-counts">
          <span>{t("versioning.diff.added")}: {section.added.length}</span>
          <span>{t("versioning.diff.removed")}: {section.removed.length}</span>
          <span>{t("versioning.diff.modified")}: {section.modified.length}</span>
        </div>
      </div>
      {!section.changed ? (
        <div className="version-diff-empty">
          <StudioIcon name="success" aria-hidden="true" />
          <p>{t("versioning.diff.noSectionChanges")}</p>
        </div>
      ) : (
        <>
          <DiffGroup title={t("versioning.diff.added")} items={section.added} tone="added" />
          <DiffGroup title={t("versioning.diff.removed")} items={section.removed} tone="removed" />
          <DiffGroup title={t("versioning.diff.modified")} items={section.modified} tone="modified" />
        </>
      )}
    </section>
  );
}

export function VersionDiffDialog({ open, diff, onClose }: VersionDiffDialogProps) {
  const { t } = useI18n();
  const [activeSection, setActiveSection] = useState<ProjectVersionDiffSectionKey>("er");

  if (!open || !diff) {
    return null;
  }

  return (
    <div className="studio-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="studio-modal studio-modal--wide version-diff-dialog versioning-diff-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-diff-title"
        onClick={(event) => event.stopPropagation()}
        data-testid="version-diff-dialog"
      >
        <div className="studio-modal__header version-diff-header">
          <div>
            <h2 id="version-diff-title" className="studio-modal__title">{t("versioning.diff.title")}</h2>
            <div className="version-diff-compare-strip" aria-label={t("versioning.diff.summary")}>
              <div className="version-diff-version-card">
                <span>{t("versioning.diff.baseVersion")}</span>
                <strong>{diff.leftLabel}</strong>
                {diff.leftCommitId ? <small>{diff.leftCommitId.slice(0, 8)}</small> : null}
              </div>
              <StudioIcon name="arrowRight" aria-hidden="true" />
              <div className="version-diff-version-card">
                <span>{t("versioning.diff.targetVersion")}</span>
                <strong>{diff.rightLabel}</strong>
                {diff.rightCommitId ? <small>{diff.rightCommitId.slice(0, 8)}</small> : null}
              </div>
            </div>
          </div>
          <button type="button" className="studio-modal__close" onClick={onClose} aria-label={t("common.actions.close")}>
            <StudioIcon name="close" aria-hidden="true" />
          </button>
        </div>
        <div className="studio-modal__body version-diff-body">
          <section className="version-diff-summary" data-testid="version-diff-summary">
            <div>
              <h3>{t("versioning.diff.summary")}</h3>
              {diff.isEqual ? <p>{t("versioning.diff.identicalVersions")}</p> : null}
            </div>
            {diff.isEqual ? (
              <div className="version-diff-empty is-hero">
                <StudioIcon name="success" aria-hidden="true" />
                <strong>{t("versioning.diff.noChanges")}</strong>
              </div>
            ) : (
              <div className="version-diff-summary-grid">
                <span>{t("versioning.diff.added")}<strong>{diff.summary.addedCount}</strong></span>
                <span>{t("versioning.diff.removed")}<strong>{diff.summary.removedCount}</strong></span>
                <span>{t("versioning.diff.modified")}<strong>{diff.summary.modifiedCount}</strong></span>
                <span>{t("versioning.diff.changedSections")}<strong>{diff.summary.changedSectionCount}</strong></span>
              </div>
            )}
          </section>

          <nav className="versioning-diff-tabs" aria-label={t("versioning.diff.changedSections")}>
            {SECTION_KEYS.map((key) => {
              const section = diff.sections[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={activeSection === key ? "active" : ""}
                  onClick={() => setActiveSection(key)}
                >
                  {t(`versioning.diff.sections.${key}`)}
                  <span>{section.added.length + section.removed.length + section.modified.length}</span>
                </button>
              );
            })}
          </nav>

          {SECTION_KEYS.map((key) => (
            <div key={key} hidden={activeSection !== key}>
              <DiffSection section={diff.sections[key]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
