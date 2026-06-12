import type { DiagramEdge, EdgeKind } from "../types/diagram";

interface ManualRoutingEdgeLike {
  type: EdgeKind;
  manualOffset?: number;
}

export function canEdgeUseManualRouting(edge: Pick<DiagramEdge, "type">): boolean {
  return edge.type !== "connector";
}

export function getEffectiveManualOffset(edge: ManualRoutingEdgeLike): number {
  return canEdgeUseManualRouting(edge as Pick<DiagramEdge, "type">) ? edge.manualOffset ?? 0 : 0;
}

export function removeDisallowedManualRouting<T extends ManualRoutingEdgeLike>(edge: T): T {
  if (canEdgeUseManualRouting(edge as Pick<DiagramEdge, "type">) || edge.manualOffset === undefined) {
    return edge;
  }

  const { manualOffset: _manualOffset, ...edgeWithoutManualOffset } = edge;
  return edgeWithoutManualOffset as T;
}
