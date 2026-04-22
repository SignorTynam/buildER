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
  onOpenSql: () => void;
}

interface StageDescriptor {
  id: "er" | "translation" | "logical" | "sql";
  title: string;
  status: string;
  tone: WorkflowTone;
  active: boolean;
  state: "complete" | "current" | "upcoming";
  onSelect: () => void;
}

interface WorkflowGuidance {
  label: string;
  detail: string;
}

function getErStatus(issueCount: number): { status: string; tone: WorkflowTone } {
  if (issueCount > 0) {
    return {
      status: `${issueCount} warning o errori nel modello`,
      tone: "warning",
    };
  }

  return {
    status: "Schema concettuale pronto",
    tone: "success",
  };
}

function getTranslationStatus(pendingCount: number): { status: string; tone: WorkflowTone } {
  if (pendingCount > 0) {
    return {
      status: `${pendingCount} decisioni di traduzione aperte`,
      tone: "warning",
    };
  }

  return {
    status: "Traduzione ER allineata",
    tone: "success",
  };
}

function getLogicalStatus(
  pendingCount: number,
  tableCount: number,
  outOfDate: boolean,
): { status: string; tone: WorkflowTone } {
  if (outOfDate) {
    return {
      status: "Schema logico da riallineare",
      tone: "warning",
    };
  }

  if (pendingCount > 0) {
    return {
      status: `${pendingCount} decisioni logiche aperte`,
      tone: "warning",
    };
  }

  if (tableCount > 0) {
    return {
      status: `${tableCount} tabelle materializzate`,
      tone: "success",
    };
  }

  return {
    status: "Genera prima lo schema logico",
    tone: "neutral",
  };
}

function getSqlStatus(tableCount: number, outOfDate: boolean): { status: string; tone: WorkflowTone } {
  if (outOfDate) {
    return {
      status: "Anteprima SQL non aggiornata",
      tone: "warning",
    };
  }

  if (tableCount > 0) {
    return {
      status: "Anteprima SQL disponibile",
      tone: "success",
    };
  }

  return {
    status: "Genera prima lo schema logico",
    tone: "neutral",
  };
}

function getWorkflowGuidance(props: WorkspaceStageBarProps): WorkflowGuidance {
  if (props.currentView === "er") {
    if (props.erIssuesCount > 0) {
      return {
        label: "Correggi il modello ER",
        detail: "Risolvi warning e incoerenze prima di avviare la traduzione.",
      };
    }

    return {
      label: "Avvia la traduzione ER",
      detail: "Il modello concettuale e pronto per passare alla fase guidata successiva.",
    };
  }

  if (props.currentView === "translation") {
    if (props.translationPendingCount > 0) {
      return {
        label: "Completa le decisioni di traduzione",
        detail: "Chiudi i punti ancora aperti per poter materializzare lo schema logico.",
      };
    }

    return {
      label: "Genera lo schema logico",
      detail: "La traduzione ER e allineata: puoi passare alla fase logica.",
    };
  }

  if (props.sqlActive) {
    if (props.logicalOutOfDate) {
      return {
        label: "Riallinea prima il logico",
        detail: "L'anteprima SQL e superata: rigenera o riallinea il modello logico corrente.",
      };
    }

    return {
      label: "Rivedi o esporta SQL",
      detail: "Usa il pannello SQL per controllare, copiare o scaricare il codice generato.",
    };
  }

  if (props.logicalOutOfDate) {
    return {
      label: "Riallinea lo schema logico",
      detail: "Il modello sorgente e cambiato: aggiorna prima la trasformazione logica.",
    };
  }

  if (props.logicalPendingCount > 0) {
    return {
      label: "Completa i fix logici",
      detail: "Applica le decisioni rimanenti prima di passare alla generazione SQL.",
    };
  }

  if (props.logicalTableCount > 0) {
    return {
      label: "Apri l'anteprima SQL",
      detail: "Lo schema logico e stabile: il prossimo passo consigliato e verificare il codice SQL.",
    };
  }

  return {
    label: "Genera lo schema logico",
    detail: "Non sono ancora presenti tabelle logiche materializzate.",
  };
}

export function WorkspaceStageBar(props: WorkspaceStageBarProps) {
  const erStatus = getErStatus(props.erIssuesCount);
  const translationStatus = getTranslationStatus(props.translationPendingCount);
  const logicalStatus = getLogicalStatus(
    props.logicalPendingCount,
    props.logicalTableCount,
    props.logicalOutOfDate,
  );
  const sqlStatus = getSqlStatus(props.logicalTableCount, props.logicalOutOfDate);

  const stages: StageDescriptor[] = [
    {
      id: "er",
      title: "Schema ER",
      status: erStatus.status,
      tone: erStatus.tone,
      active: props.currentView === "er",
      state: props.currentView === "er" ? "current" : "complete",
      onSelect: props.onOpenEr,
    },
    {
      id: "translation",
      title: "Traduzione",
      status: translationStatus.status,
      tone: translationStatus.tone,
      active: props.currentView === "translation",
      state: props.currentView === "er" ? "upcoming" : props.currentView === "translation" ? "current" : "complete",
      onSelect: props.onOpenTranslation,
    },
    {
      id: "logical",
      title: "Schema logico",
      status: logicalStatus.status,
      tone: logicalStatus.tone,
      active: props.currentView === "logical" && !props.sqlActive,
      state:
        props.currentView === "logical" && !props.sqlActive
          ? "current"
          : props.currentView === "logical" && props.sqlActive
            ? "complete"
            : props.currentView === "er" || props.currentView === "translation"
              ? "upcoming"
              : "complete",
      onSelect: props.onOpenLogical,
    },
    {
      id: "sql",
      title: "SQL",
      status: sqlStatus.status,
      tone: sqlStatus.tone,
      active: props.currentView === "logical" && props.sqlActive,
      state: props.currentView === "logical" && props.sqlActive ? "current" : "upcoming",
      onSelect: props.onOpenSql,
    },
  ];
  const activeStage = stages.find((stage) => stage.active) ?? stages[0];
  const activeIndex = stages.findIndex((stage) => stage.id === activeStage.id);
  const guidance = getWorkflowGuidance(props);
  const progressPercent = ((activeIndex + 1) / stages.length) * 100;

  return (
    <section className="workspace-stage-bar" aria-label="Workflow di progettazione">
      <div className={`workspace-stage-meta tone-${activeStage.tone}`}>
        <div className="workspace-stage-meta-head">
          <span className="workspace-stage-bar-eyebrow">Workflow</span>
          <span className="workspace-stage-progress-label">{activeIndex + 1} / {stages.length}</span>
        </div>
        <strong>{activeStage.title}</strong>
        <span className="workspace-stage-meta-status">{activeStage.status}</span>
        <div className="workspace-stage-progress" aria-hidden="true">
          <span className="workspace-stage-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="workspace-stage-guidance">
        <span className="workspace-stage-guidance-label">Prossimo obiettivo</span>
        <strong>{guidance.label}</strong>
        <p>{guidance.detail}</p>
      </div>

      <div className="workspace-stage-list" role="list">
        {stages.map((stage, index) => (
          <button
            key={stage.id}
            type="button"
            className={
              stage.active
                ? `workspace-stage-card active tone-${stage.tone} state-${stage.state}`
                : `workspace-stage-card tone-${stage.tone} state-${stage.state}`
            }
            onClick={stage.onSelect}
            role="listitem"
          >
            <span className="workspace-stage-index">{index + 1}</span>
            <span className="workspace-stage-copy">
              <span className="workspace-stage-title">{stage.title}</span>
              <span className="workspace-stage-status">{stage.status}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
