import { useRef } from "react";
import { DiagramCanvas } from "../canvas/DiagramCanvas";
import type {
  DiagramDocument,
  SelectionState,
  ValidationIssue,
  ToolKind,
  VersionDiagramHighlights,
  Viewport,
} from "../types/diagram";

interface ErWorkspaceViewProps {
  diagram: DiagramDocument;
  selection: SelectionState;
  viewport: Viewport;
  issues: ValidationIssue[];
  statusMessage: string;
  readOnly?: boolean;
  compareMode?: boolean;
  versionHighlights?: VersionDiagramHighlights;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: SelectionState) => void;
}

export function ErWorkspaceView({
  diagram,
  selection,
  viewport,
  issues,
  statusMessage,
  readOnly = false,
  compareMode = false,
  versionHighlights,
  onViewportChange,
  onSelectionChange,
}: ErWorkspaceViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tool: ToolKind = "select";

  return (
    <div
      className={["designer-workspace", compareMode ? "designer-workspace-compare" : ""].filter(Boolean).join(" ")}
      data-testid="er-workspace-view"
    >
      <div className="designer-canvas-region" data-testid="er-workspace-canvas-region">
        <DiagramCanvas
          diagram={diagram}
          selection={selection}
          tool={tool}
          mode="edit"
          viewport={viewport}
          issues={issues}
          statusMessage={statusMessage}
          svgRef={svgRef}
          readOnly={readOnly}
          versionHighlights={versionHighlights}
          onViewportChange={onViewportChange}
          onSelectionChange={onSelectionChange}
          onPreviewDiagram={() => undefined}
          onCommitDiagram={() => undefined}
          onCreateNode={() => ""}
          onCreateEdge={() => ({ success: false, message: statusMessage })}
          onOpenCardinality={() => undefined}
          onOpenInheritanceType={() => undefined}
          onToolChange={() => undefined}
          onDeleteNode={() => undefined}
          onDeleteEdge={() => undefined}
          onDeleteSelection={() => undefined}
          onDeleteExternalIdentifier={() => undefined}
          onRenameNode={() => undefined}
          onRenameEdge={() => undefined}
          onStatusMessageChange={() => undefined}
        />
      </div>
    </div>
  );
}
