import { useMemo } from "react";
import type { DiagramDocument } from "../types/diagram";
import type { LogicalTranslationChoice } from "../types/logical";
import type { LogicalEntityKeySelectionRequest } from "../utils/logicalTranslation";
import {
  buildEntityKeyChoicePreviewData,
  type EntityKeyPreviewColumn,
} from "../utils/logicalKeyPreview";

interface EntityKeyChoicePreviewProps {
  diagram: DiagramDocument;
  request: LogicalEntityKeySelectionRequest;
  choice: LogicalTranslationChoice | null;
  confirmed: boolean;
}

function getPreviewColumnQualifiers(column: EntityKeyPreviewColumn): string[] {
  const qualifiers: string[] = [];
  if (column.isPrimaryKey) {
    qualifiers.push("PK");
  }
  if (column.isForeignKey) {
    qualifiers.push("FK");
  }
  if (!column.isNullable && !column.isPrimaryKey) {
    qualifiers.push("NN");
  }
  if (column.isUniqueAlternative && !column.isPrimaryKey) {
    qualifiers.push("U");
  }
  return qualifiers;
}

function renderTextBadges(column: EntityKeyPreviewColumn) {
  return (
    <span className="entity-key-preview-table-badges">
      {getPreviewColumnQualifiers(column).map((qualifier) => (
        <span key={qualifier} className={`logical-column-qualifier-badge-${qualifier.toLowerCase()}`}>
          {qualifier}
        </span>
      ))}
    </span>
  );
}

function renderSvgBadges(column: EntityKeyPreviewColumn, x: number, y: number) {
  return (
    <g className="logical-column-label" pointerEvents="none">
      {getPreviewColumnQualifiers(column).map((qualifier, index) => {
        const width = qualifier.length > 2 ? 26 : 22;
        const offset = index * 28;
        return (
          <g key={qualifier} transform={`translate(${x + offset}, ${y})`}>
            <rect
              x={0}
              y={-9}
              width={width}
              height={18}
              rx={8}
              ry={8}
              className={`logical-column-qualifier-badge logical-column-qualifier-badge-${qualifier.toLowerCase()}`}
            />
            <text
              x={width / 2}
              y={0}
              dominantBaseline="middle"
              textAnchor="middle"
              className={`logical-column-qualifier logical-column-qualifier-${qualifier.toLowerCase()}`}
            >
              {qualifier}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function renderLogicalTableSvg(options: {
  id: string;
  x: number;
  y: number;
  width: number;
  title: string;
  columns: EntityKeyPreviewColumn[];
  role: "host" | "referenced";
}) {
  const rowHeight = 34;
  const headerHeight = 44;
  const rowCount = Math.max(1, options.columns.length);
  const height = headerHeight + rowCount * rowHeight;

  return (
    <g
      key={options.id}
      className={[
        "logical-table",
        "entity-key-preview-logical-table",
        options.role === "host" ? "entity-key-preview-logical-table-host" : "entity-key-preview-logical-table-source",
      ].join(" ")}
    >
      <rect className="logical-table-body" x={options.x} y={options.y} width={options.width} height={height} rx="0" />
      <rect className="logical-table-header" x={options.x} y={options.y} width={options.width} height={headerHeight} rx="0" />
      <line className="logical-table-divider" x1={options.x} y1={options.y + headerHeight} x2={options.x + options.width} y2={options.y + headerHeight} />
      <text className="logical-table-title" x={options.x + options.width / 2} y={options.y + 28} textAnchor="middle">
        {options.title}
      </text>

      {options.columns.length > 0 ? options.columns.map((column, index) => {
        const rowY = options.y + headerHeight + index * rowHeight;
        const qualifiers = getPreviewColumnQualifiers(column);
        const textX = options.x + (qualifiers.length > 0 ? 74 : 18);
        return (
          <g key={column.id} className="logical-column-row">
            <rect className="logical-column-hit" x={options.x} y={rowY} width={options.width} height={rowHeight} />
            <line className="logical-column-divider" x1={options.x} y1={rowY} x2={options.x + options.width} y2={rowY} />
            {renderSvgBadges(column, options.x + 12, rowY + 17)}
            <text className="logical-column-name" x={textX} y={rowY + 18} dominantBaseline="middle">
              {column.name}
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
  const hostTable = preview.tables.find((table) => table.role === "host");
  const referencedTables = preview.tables.filter((table) => table.role === "referenced");
  const hostX = referencedTables.length > 0 ? 42 : 184;
  const hostY = referencedTables.length > 0 ? 84 : 74;
  const sourceX = 378;

  return (
    <div className="entity-key-preview" aria-label={`Preview della chiave primaria per ${preview.hostEntityLabel}`}>
      <div className="entity-key-preview-summary">
        <div className="entity-key-preview-status">
          <strong>{props.confirmed ? "Scelta confermata" : "Anteprima non confermata"}</strong>
          <span>
            {props.confirmed
              ? "Questa configurazione verra usata quando applichi Fix Entities."
              : "Seleziona questa alternativa a sinistra per usarla come PK."}
          </span>
        </div>
        <div className="entity-key-preview-current-choice">
          <span>Scelta corrente</span>
          <strong>{preview.title}</strong>
          <small>{preview.kindLabel}</small>
        </div>
      </div>

      <div className="entity-key-preview-effect">
        <strong>Effetto sulla tabella {preview.hostEntityLabel}</strong>
        <ul>
          {preview.effectLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="entity-key-preview-diagram entity-key-preview-logical-stage">
        <svg className="entity-key-preview-svg" viewBox="0 0 640 360" role="img" aria-label={preview.summary}>
          <defs>
            <marker id="entity-key-preview-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
              <path d="M0,0 L10,4 L0,8 Z" />
            </marker>
          </defs>
          <rect className="entity-key-preview-surface" x="0" y="0" width="640" height="360" rx="0" />

          {hostTable ? renderLogicalTableSvg({
            id: hostTable.id,
            x: hostX,
            y: hostY,
            width: 276,
            title: hostTable.name,
            columns: hostTable.columns,
            role: "host",
          }) : null}

          {referencedTables.map((table, index) => {
            const sourceY = referencedTables.length > 1 ? 52 + index * 132 : 96;
            const foreignKey = preview.foreignKeys[index] ?? preview.foreignKeys[0];
            return (
              <g key={table.id}>
                <path
                  className="logical-edge entity-key-preview-logical-edge"
                  d={`M${hostX + 276},${hostY + 62 + index * 24} H350 V${sourceY + 62} H${sourceX}`}
                />
                <text className="logical-edge-label entity-key-preview-logical-edge-label" x="354" y={sourceY + 52}>
                  {foreignKey?.relationshipName ?? "FK"}
                </text>
                {renderLogicalTableSvg({
                  id: table.id,
                  x: sourceX,
                  y: sourceY,
                  width: 220,
                  title: table.name,
                  columns: table.columns,
                  role: "referenced",
                })}
              </g>
            );
          })}

          {preview.kind === "none" ? (
            <text className="entity-key-preview-empty" x="320" y="178" textAnchor="middle">
              {preview.summary}
            </text>
          ) : null}
        </svg>
      </div>

      {preview.alternativeKeys.length > 0 ? (
        <div className="entity-key-preview-alternatives">
          <strong>Chiavi candidate non scelte</strong>
          <ul>
            {preview.alternativeKeys.map((key) => (
              <li key={key.label}>{key.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="entity-key-preview-table">
        <div className="entity-key-preview-table-head">
          <span>Colonne risultanti</span>
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
                {renderTextBadges(column)}
                <span>{column.name}</span>
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
