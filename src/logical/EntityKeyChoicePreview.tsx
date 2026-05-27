import { useMemo } from "react";
import type { DiagramDocument } from "../types/diagram";
import type { LogicalTranslationChoice } from "../types/logical";
import type { LogicalEntityKeySelectionRequest } from "../utils/logicalTranslation";
import { buildEntityKeyChoicePreviewData } from "../utils/logicalKeyPreview";

interface EntityKeyChoicePreviewProps {
  diagram: DiagramDocument;
  request: LogicalEntityKeySelectionRequest;
  choice: LogicalTranslationChoice | null;
  confirmed: boolean;
}

type PreviewColumn = ReturnType<typeof buildEntityKeyChoicePreviewData>["logicalTable"]["columns"][number];

function renderAttributeBadges(isPrimaryKey: boolean, isForeignKey: boolean, isUniqueAlternative: boolean) {
  return (
    <span className="entity-key-preview-table-badges">
      {isPrimaryKey ? <span>PK</span> : null}
      {isForeignKey ? <span>FK</span> : null}
      {isUniqueAlternative ? <span>U</span> : null}
    </span>
  );
}

function renderSvgBadges(column: PreviewColumn, x: number, y: number) {
  const badges = [
    column.isPrimaryKey ? "PK" : null,
    column.isForeignKey ? "FK" : null,
    column.isUniqueAlternative ? "U" : null,
  ].filter(Boolean) as string[];

  return (
    <g className="entity-key-preview-svg-badges">
      {badges.map((badge, index) => (
        <g key={badge} transform={`translate(${x + index * 30}, ${y})`}>
          <rect width="24" height="18" rx="9" />
          <text x="12" y="13" textAnchor="middle">{badge}</text>
        </g>
      ))}
    </g>
  );
}

function renderLogicalTableSvg(options: {
  id: string;
  x: number;
  y: number;
  width: number;
  title: string;
  columns: PreviewColumn[];
  role: "host" | "source";
}) {
  const rowHeight = 34;
  const headerHeight = 44;
  const rowCount = Math.max(1, options.columns.length);
  const height = headerHeight + rowCount * rowHeight;

  return (
    <g
      key={options.id}
      className={[
        "entity-key-preview-logical-table",
        options.role === "host" ? "entity-key-preview-logical-table-host" : "entity-key-preview-logical-table-source",
      ].join(" ")}
    >
      <rect className="entity-key-preview-logical-table-frame" x={options.x} y={options.y} width={options.width} height={height} rx="6" />
      <rect className="entity-key-preview-logical-table-header" x={options.x} y={options.y} width={options.width} height={headerHeight} rx="6" />
      <line x1={options.x} y1={options.y + headerHeight} x2={options.x + options.width} y2={options.y + headerHeight} />
      <text className="entity-key-preview-logical-table-title" x={options.x + options.width / 2} y={options.y + 28} textAnchor="middle">
        {options.title}
      </text>

      {options.columns.length > 0 ? options.columns.map((column, index) => {
        const rowY = options.y + headerHeight + index * rowHeight;
        return (
          <g
            key={column.id}
            className={[
              "entity-key-preview-logical-row",
              column.isPrimaryKey ? "entity-key-preview-logical-row-primary" : "",
            ].filter(Boolean).join(" ")}
          >
            <rect x={options.x} y={rowY} width={options.width} height={rowHeight} />
            {renderSvgBadges(column, options.x + 12, rowY + 8)}
            <text className="entity-key-preview-logical-column-name" x={options.x + 102} y={rowY + 22}>
              {column.label}
            </text>
          </g>
        );
      }) : (
        <text className="entity-key-preview-empty" x={options.x + options.width / 2} y={options.y + headerHeight + 23} textAnchor="middle">
          Nessuna colonna disponibile
        </text>
      )}
    </g>
  );
}

export function EntityKeyChoicePreview(props: EntityKeyChoicePreviewProps) {
  const preview = useMemo(
    () => buildEntityKeyChoicePreviewData({ diagram: props.diagram, request: props.request, choice: props.choice }),
    [props.choice, props.diagram, props.request],
  );
  const sourceEntities = preview.entities.filter((entity) => entity.role === "source");
  const hostX = preview.kind === "external" ? 42 : 184;
  const hostY = preview.kind === "external" ? 84 : 74;
  const sourceX = 378;

  return (
    <div className="entity-key-preview" aria-label={`Preview della chiave primaria per ${preview.hostEntityLabel}`}>
      <div className="entity-key-preview-diagram">
        <svg className="entity-key-preview-svg" viewBox="0 0 640 360" role="img" aria-label={preview.summary}>
          <defs>
            <marker id="entity-key-preview-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
              <path d="M0,0 L10,4 L0,8 Z" />
            </marker>
          </defs>
          <rect className="entity-key-preview-surface" x="0" y="0" width="640" height="360" rx="0" />

          {renderLogicalTableSvg({
            id: preview.hostEntityId || "host",
            x: hostX,
            y: hostY,
            width: 276,
            title: preview.logicalTable.name,
            columns: preview.logicalTable.columns,
            role: "host",
          })}

          {preview.kind === "external"
            ? sourceEntities.map((sourceEntity, sourceIndex) => {
                const sourceY = sourceEntities.length > 1 ? 52 + sourceIndex * 132 : 96;
                const relationship = preview.relationships[sourceIndex] ?? preview.relationships[0];
                const sourceColumns: PreviewColumn[] = sourceEntity.attributes.map((attribute) => ({
                  id: `${sourceEntity.id}-${attribute.id}`,
                  label: attribute.label,
                  isPrimaryKey: true,
                  isForeignKey: false,
                  isUniqueAlternative: false,
                }));

                return (
                  <g key={sourceEntity.id}>
                    <path
                      className="entity-key-preview-logical-fk"
                      d={`M${hostX + 276},${hostY + 62 + sourceIndex * 24} H350 V${sourceY + 62} H${sourceX}`}
                    />
                    <text className="entity-key-preview-logical-fk-label" x="354" y={sourceY + 52}>
                      {relationship?.label ?? "FK"}
                    </text>
                    {renderLogicalTableSvg({
                      id: sourceEntity.id,
                      x: sourceX,
                      y: sourceY,
                      width: 220,
                      title: sourceEntity.label,
                      columns: sourceColumns,
                      role: "source",
                    })}
                  </g>
                );
              })
            : null}

          {preview.kind === "none" ? (
            <text className="entity-key-preview-empty" x="320" y="178" textAnchor="middle">
              {preview.summary}
            </text>
          ) : null}
        </svg>
      </div>

      <div className="entity-key-preview-table">
        <div className="entity-key-preview-table-head">
          <span>{props.confirmed ? "Alternativa selezionata" : "Anteprima provvisoria"}</span>
          <strong>{preview.logicalTable.name}</strong>
        </div>
        {preview.logicalTable.columns.length > 0 ? (
          <div className="entity-key-preview-table-rows">
            {preview.logicalTable.columns.map((column) => (
              <div
                key={column.id}
                className={[
                  "entity-key-preview-table-row",
                  column.isPrimaryKey ? "entity-key-preview-table-row-primary" : "",
                ].filter(Boolean).join(" ")}
              >
                {renderAttributeBadges(column.isPrimaryKey, column.isForeignKey, column.isUniqueAlternative)}
                <span>{column.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="entity-key-preview-empty-text">{preview.summary}</p>
        )}
      </div>
    </div>
  );
}
