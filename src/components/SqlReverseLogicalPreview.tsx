import { useRef } from "react";
import { LogicalTransformationCanvas } from "../logical/LogicalTransformationCanvas";
import type { DiagramDocument, Viewport } from "../types/diagram";
import type { LogicalSelection, LogicalWorkspaceDocument } from "../types/logical";

interface SqlReverseLogicalPreviewProps {
  sourceDiagram: DiagramDocument;
  workspace: LogicalWorkspaceDocument;
  viewport: Viewport;
  selection: LogicalSelection;
  fitRequestToken: number;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: LogicalSelection) => void;
}

export function SqlReverseLogicalPreview({
  sourceDiagram,
  workspace,
  viewport,
  selection,
  fitRequestToken,
  onViewportChange,
  onSelectionChange,
}: SqlReverseLogicalPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  return (
    <LogicalTransformationCanvas
      sourceDiagram={sourceDiagram}
      workspace={workspace}
      selection={selection}
      viewport={viewport}
      svgRef={svgRef}
      typeMode={false}
      fitRequestToken={fitRequestToken}
      autoFitOnMount
      activeTargetKeys={[]}
      focusedTargetKey={null}
      viewMode="schema"
      readOnly
      onViewportChange={onViewportChange}
      onSelectionChange={onSelectionChange}
      onPreviewModel={() => undefined}
      onCommitModel={() => undefined}
      onRenameTable={() => undefined}
      onRenameColumn={() => undefined}
      onUpdateColumnSql={() => undefined}
    />
  );
}
