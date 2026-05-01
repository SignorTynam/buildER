import type { DiagramDocument } from "./diagram";

export type WorkspaceView = "er" | "translation" | "logical";

export type ErTranslationStep = "generalizations" | "composite-attributes" | "review";
export type ErTranslationTargetType = "generalization" | "attribute";
export type ErTranslationDecisionStatus = "applied" | "invalid";
export type ErTranslationItemStatus = "pending" | "blocked";
export type ErTranslationIssueLevel = "warning" | "error";
export type ErTranslationRuleKind =
  | "generalization-collapse-up"
  | "generalization-collapse-down"
  | "generalization-substitution"
  | "composite-split"
  | "composite-merge";

export interface ErTranslationChoice {
  id: string;
  step: ErTranslationStep;
  rule: ErTranslationRuleKind;
  label: string;
  description: string;
  summary: string;
  previewLines?: string[];
  recommended?: boolean;
  disabledReason?: string;
  warning?: string;
  configuration?: Record<string, string | boolean | number | null | undefined>;
}

export interface ErTranslationItem {
  id: string;
  targetType: ErTranslationTargetType;
  step: ErTranslationStep;
  label: string;
  description: string;
  status: ErTranslationItemStatus;
  blockedReason?: string;
  choiceIds: string[];
}

export interface ErTranslationDecision {
  id: string;
  targetType: ErTranslationTargetType;
  targetId: string;
  step: ErTranslationStep;
  rule: ErTranslationRuleKind;
  summary: string;
  appliedAt: string;
  status: ErTranslationDecisionStatus;
  configuration?: Record<string, string | boolean | number | null | undefined>;
}

export type ErTranslationArtifactKind = "node" | "edge";

export interface ErTranslationArtifactRef {
  kind: ErTranslationArtifactKind;
  id: string;
  label: string;
}

export interface ErTranslationMapping {
  decisionId: string;
  targetType: ErTranslationTargetType;
  targetId: string;
  summary: string;
  artifacts: ErTranslationArtifactRef[];
}

export interface ErTranslationConflict {
  id: string;
  targetType: ErTranslationTargetType;
  targetId: string;
  level: ErTranslationIssueLevel;
  message: string;
  decisionId?: string;
}

export interface ErTranslationState {
  meta: {
    createdAt: string;
    updatedAt: string;
    sourceSignature: string;
  };
  decisions: ErTranslationDecision[];
  mappings: ErTranslationMapping[];
  conflicts: ErTranslationConflict[];
}

export interface ErTranslationWorkspaceDocument {
  sourceDiagram: DiagramDocument;
  translatedDiagram: DiagramDocument;
  translation: ErTranslationState;
}

export interface ErTranslationStepState {
  id: ErTranslationStep;
  label: string;
  description: string;
  total: number;
  pending: number;
  applied: number;
  blocked: boolean;
  completed: boolean;
  blockReason?: string;
}

export interface ErTranslationOverview {
  steps: ErTranslationStepState[];
  itemsByStep: Record<ErTranslationStep, ErTranslationItem[]>;
  isComplete: boolean;
  logicalBlockReason?: string;
}
