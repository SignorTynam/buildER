import React, { useMemo } from "react";
import type { DiagramDocument } from "../types/diagram";
import type { LogicalTranslationChoice } from "../types/logical";
import { t } from "../i18n";
import type { LogicalEntityKeySelectionRequest } from "../utils/logicalTranslation";
import {
  buildEntityKeyChoicePreviewData,
  type EntityKeyPreviewColumn,
} from "../utils/logicalKeyPreview";
import {
  getDesignerLogicalColumnNameUnderlineLayout,
  getDesignerLogicalColumnQualifierLabels,
  getDesignerLogicalColumnQualifierLayout,
} from "./LogicalTransformationCanvas";

interface EntityKeyChoicePreviewProps {
  diagram: DiagramDocument;
  request: LogicalEntityKeySelectionRequest;
  choice: LogicalTranslationChoice | null;
  confirmed: boolean;
}

function toDesignerPreviewColumn(column: EntityKeyPreviewColumn) {
  return {
    id: column.id,
    name: column.name,
    isPrimaryKey: column.isPrimaryKey,
    isForeignKey: column.isForeignKey,
    isUnique: column.isUniqueAlternative,
    isNullable: column.isNullable,
    references: [],
  };
}

function renderSvgColumnLabel(column: EntityKeyPreviewColumn, x: number, y: number) {
  const designerColumn = toDesignerPreviewColumn(column);
  const qualifiers = getDesignerLogicalColumnQualifierLabels(designerColumn);
  const layout = getDesignerLogicalColumnQualifierLayout(qualifiers);
  const underline = getDesignerLogicalColumnNameUnderlineLayout(designerColumn);

  return (
    <g className="logical-column-label" transform={`translate(${x}, ${y})`} pointerEvents="none">
      {layout.items.map((item) => {
        const qualifier = item.label;
        return (
          <g key={qualifier} transform={`translate(${item.x}, 0)`}>
            <rect
              x={0}
              y={-9}
              width={item.width}
              height={18}
              rx={8}
              ry={8}
              className={`logical-column-qualifier-badge logical-column-qualifier-badge-${qualifier.toLowerCase()}`}
            />
            <text
              x={item.width / 2}
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
      <text className="logical-column-name" x={layout.textOffset} y={0} dominantBaseline="middle">
        {column.name}
      </text>
      {underline.visible ? (
        <line
          x1={underline.x1}
          y1={underline.y}
          x2={underline.x2}
          y2={underline.y}
          className="logical-column-name-underline"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
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
        return (
          <g key={column.id} className="logical-column-row">
            <rect className="logical-column-hit" x={options.x} y={rowY} width={options.width} height={rowHeight} />
            <line className="logical-column-divider" x1={options.x} y1={rowY} x2={options.x + options.width} y2={rowY} />
            {renderSvgColumnLabel(column, options.x + 12, rowY + 17)}
          </g>
        );
      }) : (
        <text className="entity-key-preview-empty" x={options.x + options.width / 2} y={options.y + headerHeight + 23} textAnchor="middle">
          {t("logical.entityKeyModal.noColumns")}
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
  const hasReferences = referencedTables.length > 0;
  const hostWidth = hasReferences ? 240 : 300;
  const sourceWidth = 200;
  const hostX = hasReferences ? 24 : 170;
  const hostY = hasReferences ? 84 : 74;
  const sourceX = 420;
  const edgeMidX = (hostX + hostWidth + sourceX) / 2;

  return (
    <div className="entity-key-preview" aria-label={t("logical.entityKeyModal.previewAria", { entity: preview.hostEntityLabel })}>
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
            width: hostWidth,
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
                  d={`M${hostX + hostWidth},${hostY + 62 + index * 24} H${edgeMidX} V${sourceY + 62} H${sourceX}`}
                />
                {renderLogicalTableSvg({
                  id: table.id,
                  x: sourceX,
                  y: sourceY,
                  width: sourceWidth,
                  title: table.name,
                  columns: table.columns,
                  role: "referenced",
                })}
                <text
                  className="logical-edge-label entity-key-preview-logical-edge-label"
                  x={edgeMidX}
                  y={sourceY + 52}
                  textAnchor="middle"
                >
                  {foreignKey?.relationshipName ?? "FK"}
                </text>
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
    </div>
  );
}
