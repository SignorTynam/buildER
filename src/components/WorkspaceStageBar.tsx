import type { WorkspaceView } from "../types/translation";
import { PanelCard, PanelStepCard } from "./panels";

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
          label: "Review modello",
          detail: `${props.erIssuesCount} warning o errori richiedono attenzione.`,
        }
      : {
          tone: "success",
          label: "Modello pronto",
          detail: "Nessun warning aperto nel canvas ER.",
        };
  }

  if (props.currentView === "translation") {
    return props.translationPendingCount > 0
      ? {
          tone: "warning",
          label: "Traduzione in corso",
          detail: `${props.translationPendingCount} decisioni ancora aperte.`,
        }
      : {
          tone: "success",
          label: "Traduzione allineata",
          detail: "Puoi procedere verso lo schema logico.",
        };
  }

  if (props.sqlActive) {
    return props.logicalOutOfDate
      ? {
          tone: "warning",
          label: "SQL non aggiornato",
          detail: "Rigenera prima il modello logico.",
        }
      : {
          tone: "neutral",
          label: "Anteprima SQL",
          detail: "Verifica il codice generato dal modello corrente.",
        };
  }

  return props.logicalOutOfDate
    ? {
        tone: "warning",
        label: "Schema da riallineare",
        detail: "Il modello logico richiede riallineamento.",
      }
    : {
        tone: props.logicalPendingCount > 0 ? "warning" : "success",
        label: props.logicalPendingCount > 0 ? "Review schema" : "Schema stabile",
        detail:
          props.logicalPendingCount > 0
            ? `${props.logicalPendingCount} fix logici ancora aperti.`
            : "Modello logico allineato.",
      };
}

export function WorkspaceStageBar(props: WorkspaceStageBarProps) {
  const stages: StageDescriptor[] = [
    {
      id: "er",
      label: "Modello ER",
      meta: props.erIssuesCount > 0 ? "Da rivedere" : "Pronto",
      tone: getStageTone(props.erIssuesCount),
      active: props.currentView === "er",
      onSelect: props.onOpenEr,
    },
    {
      id: "translation",
      label: "Traduzione",
      meta: props.translationPendingCount > 0 ? `${props.translationPendingCount} aperte` : "Allineata",
      tone: getStageTone(props.translationPendingCount),
      active: props.currentView === "translation",
      onSelect: props.onOpenTranslation,
    },
    {
      id: "logical",
      label: "Schema logico",
      meta: props.logicalOutOfDate
        ? "Da riallineare"
        : props.logicalPendingCount > 0
          ? `${props.logicalPendingCount} aperti`
          : "Allineato",
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
          <PanelStepCard
            key={stage.id}
            className={`workspace-mode-button tone-${stage.tone}`}
            active={stage.active}
            tone={stage.tone}
            onClick={stage.onSelect}
            ariaLabel={stage.label}
          >
            <strong>{stage.label}</strong>
            <span>{stage.meta}</span>
          </PanelStepCard>
        ))}
      </div>

      <PanelCard className={`workspace-mode-status tone-${summary.tone}`} tone={summary.tone} title={summary.label} status={summary.detail} />
    </section>
  );
}
