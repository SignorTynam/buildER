import type { WorkspaceView } from "../types/translation";

type WorkflowTone = "neutral" | "warning" | "success";

interface WorkspaceStageBarProps {
  currentView: WorkspaceView;
  sqlActive: boolean;
  erIssuesCount: number;
  translationPendingCount: number;
  logicalPendingCount: number;
  logicalTableCount: number;
  logicalOutOfDate: boolean;
  onOpenEr: () => void;
  onOpenTranslation: () => void;
  onOpenLogical: () => void;
}

interface StageDescriptor {
  id: "er" | "translation" | "logical";
  label: string;
  meta: string;
  tone: WorkflowTone;
  active: boolean;
  onSelect: () => void;
}

function getStageTone(metaCount: number, neutralWhenZero = false): WorkflowTone {
  if (metaCount > 0) {
    return "warning";
  }

  return neutralWhenZero ? "neutral" : "success";
}

function getSummary(props: WorkspaceStageBarProps): { tone: WorkflowTone; label: string; detail: string } {
  if (props.currentView === "er") {
    return props.erIssuesCount > 0
      ? {
          tone: "warning",
          label: "Model validation active",
          detail: `${props.erIssuesCount} warning o errori nel diagramma ER.`,
        }
      : {
          tone: "success",
          label: "Model ready",
          detail: "Il canvas ER e pronto per la fase successiva.",
        };
  }

  if (props.currentView === "translation") {
    return props.translationPendingCount > 0
      ? {
          tone: "warning",
          label: "Translation in progress",
          detail: `${props.translationPendingCount} decisioni ancora aperte.`,
        }
      : {
          tone: "success",
          label: "Translation aligned",
          detail: "Puoi procedere verso lo schema logico.",
        };
  }

  if (props.sqlActive) {
    return props.logicalOutOfDate
      ? {
          tone: "warning",
          label: "SQL out of date",
          detail: "Rigenera prima il modello logico.",
        }
      : {
          tone: "neutral",
          label: "SQL preview",
          detail: "Verifica il codice generato dal modello corrente.",
        };
  }

  return props.logicalOutOfDate
    ? {
        tone: "warning",
        label: "Schema out of sync",
        detail: "Il modello logico richiede riallineamento.",
      }
    : {
        tone: props.logicalPendingCount > 0 ? "warning" : "success",
        label: props.logicalPendingCount > 0 ? "Schema review" : "Schema stable",
        detail:
          props.logicalPendingCount > 0
            ? `${props.logicalPendingCount} fix logici ancora aperti.`
            : `${props.logicalTableCount} tabelle disponibili nel modello logico.`,
      };
}

export function WorkspaceStageBar(props: WorkspaceStageBarProps) {
  const stages: StageDescriptor[] = [
    {
      id: "er",
      label: "MODEL",
      meta: props.erIssuesCount > 0 ? `${props.erIssuesCount} issues` : "ready",
      tone: getStageTone(props.erIssuesCount),
      active: props.currentView === "er",
      onSelect: props.onOpenEr,
    },
    {
      id: "translation",
      label: "TRANSLATION",
      meta: props.translationPendingCount > 0 ? `${props.translationPendingCount} open` : "aligned",
      tone: getStageTone(props.translationPendingCount),
      active: props.currentView === "translation",
      onSelect: props.onOpenTranslation,
    },
    {
      id: "logical",
      label: "SCHEMA",
      meta: props.logicalOutOfDate
        ? "out of sync"
        : props.logicalPendingCount > 0
          ? `${props.logicalPendingCount} open`
          : props.logicalTableCount > 0
            ? `${props.logicalTableCount} tables`
            : "empty",
      tone: props.logicalOutOfDate ? "warning" : getStageTone(props.logicalPendingCount, props.logicalTableCount === 0),
      active: props.currentView === "logical",
      onSelect: props.onOpenLogical,
    },
  ];

  const summary = getSummary(props);

  return (
    <section className="workspace-mode-strip" aria-label="Workflow di modellazione">
      <div className="workspace-mode-switcher" role="tablist" aria-label="Fasi del workflow">
        {stages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            className={
              stage.active
                ? `workspace-mode-button active tone-${stage.tone}`
                : `workspace-mode-button tone-${stage.tone}`
            }
            onClick={stage.onSelect}
            role="tab"
            aria-selected={stage.active}
          >
            <strong>{stage.label}</strong>
            <span>{stage.meta}</span>
          </button>
        ))}
      </div>

      <div className={`workspace-mode-status tone-${summary.tone}`}>
        <strong>{summary.label}</strong>
        <span>{summary.detail}</span>
      </div>
    </section>
  );
}
