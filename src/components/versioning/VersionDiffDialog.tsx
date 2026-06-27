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

const SECTION_KEYS: ProjectVersionDiffSectionKey[] = ["er", "layout", "logical", "code", "workspace"];

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
          {item.before !== undefined ? <span>{item.before}</span> : null}
          {item.after !== undefined ? <span>{item.after}</span> : null}
        </div>
      ) : null}
      {item.details && item.details.length > 0 ? (
        <dl className="version-diff-details">
          {item.details.map((detail) => (
            <div key={`${item.id}-${detail.label}`}>
              <dt>{detail.label}</dt>
              <dd>
                {detail.before !== undefined ? <span>{detail.before}</span> : null}
                {detail.after !== undefined ? <span>{detail.after}</span> : null}
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
}: {
  title: string;
  items: ProjectVersionDiffItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="version-diff-group">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <DiffItem key={`${item.kind}-${item.id}`} item={item} />
        ))}
      </ul>
    </div>
  );
}

function DiffSection({ section }: { section: ProjectVersionDiffSection }) {
  const { t } = useI18n();

  return (
    <section className="version-diff-section" data-testid={`version-diff-section-${section.key}`}>
      <h3>{t(`versioning.diff.sections.${section.key}`)}</h3>
      {!section.changed ? (
        <p className="version-diff-empty">{t("versioning.diff.noSectionChanges")}</p>
      ) : (
        <>
          <DiffGroup title={t("versioning.diff.added")} items={section.added} />
          <DiffGroup title={t("versioning.diff.removed")} items={section.removed} />
          <DiffGroup title={t("versioning.diff.modified")} items={section.modified} />
        </>
      )}
    </section>
  );
}

export function VersionDiffDialog({ open, diff, onClose }: VersionDiffDialogProps) {
  const { t } = useI18n();

  if (!open || !diff) {
    return null;
  }

  return (
    <div className="studio-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="studio-modal studio-modal--wide version-diff-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-diff-title"
        onClick={(event) => event.stopPropagation()}
        data-testid="version-diff-dialog"
      >
        <div className="studio-modal__header">
          <div>
            <h2 id="version-diff-title" className="studio-modal__title">{t("versioning.diff.title")}</h2>
            <p className="studio-modal__subtitle">
              {diff.leftLabel} {"->"} {diff.rightLabel}
            </p>
          </div>
          <button type="button" className="studio-modal__close" onClick={onClose} aria-label={t("common.actions.close")}>
            <StudioIcon name="close" aria-hidden="true" />
          </button>
        </div>
        <div className="studio-modal__body version-diff-body">
          <section className="version-diff-summary" data-testid="version-diff-summary">
            <h3>{t("versioning.diff.summary")}</h3>
            {diff.isEqual ? (
              <p>{t("versioning.diff.noChanges")}</p>
            ) : (
              <div className="version-diff-summary-grid">
                <span>{t("versioning.diff.added")}: {diff.summary.addedCount}</span>
                <span>{t("versioning.diff.removed")}: {diff.summary.removedCount}</span>
                <span>{t("versioning.diff.modified")}: {diff.summary.modifiedCount}</span>
                <span>{t("versioning.diff.changedSections")}: {diff.summary.changedSectionCount}</span>
              </div>
            )}
          </section>
          {SECTION_KEYS.map((key) => (
            <DiffSection key={key} section={diff.sections[key]} />
          ))}
        </div>
      </div>
    </div>
  );
}
