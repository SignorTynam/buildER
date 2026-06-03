import { useRef } from "react";
import { DiagramCanvas } from "../canvas/DiagramCanvas";
import type { DiagramDocument, SelectionState, Viewport } from "../types/diagram";

interface SqlReverseErPreviewProps {
  diagram: DiagramDocument;
  viewport: Viewport;
  selection: SelectionState;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: SelectionState) => void;
}

export function SqlReverseErPreview({
  diagram,
  viewport,
  selection,
  onViewportChange,
  onSelectionChange,
}: SqlReverseErPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  return (
    <DiagramCanvas
      diagram={diagram}
      selection={selection}
      tool="select"
      mode="edit"
      viewport={viewport}
      issues={[]}
      statusMessage="Preview ER pronta."
      svgRef={svgRef}
      readOnly
      onViewportChange={onViewportChange}
      onSelectionChange={onSelectionChange}
      onPreviewDiagram={() => undefined}
      onCommitDiagram={() => undefined}
      onCreateNode={() => ""}
      onCreateEdge={() => ({ success: false, message: "Preview read-only." })}
      onOpenCardinality={() => undefined}
      onOpenInheritanceType={() => undefined}
      onToolChange={() => undefined}
      onCreateExternalIdentifier={() => ({ success: false, message: "Preview read-only." })}
      onDeleteNode={() => undefined}
      onDeleteEdge={() => undefined}
      onDeleteSelection={() => undefined}
      onDeleteExternalIdentifier={() => undefined}
      onRenameNode={() => undefined}
      onRenameEdge={() => undefined}
      onStatusMessageChange={() => undefined}
    />
  );
}
