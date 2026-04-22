import type { WorkspaceView } from "../types/translation";

type WorkflowTone = "neutral" | "warning" | "success";

interface WorkspaceStageBarProps {
  currentView: WorkspaceView;
  sqlActive: boolean;
  codeActive: boolean;
  erIssuesCount: number;
  translationPendingCount: number;
  logicalPendingCount: number;
  logicalTableCount: number;
  logicalOutOfDate: boolean;
  onOpenEr: () => void;
  onOpenTranslation: () => void;
  onOpenLogical: () => void;
  onOpenSql: () => void;
  onOpenCode: () => void;
}

interface StageDescriptor {
  id: "er" | "translation" | "logical" | "sql";
  title: string;
  status: string;
  tone: WorkflowTone;
  active: boolean;
  onSelect: () => void;
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
      active: props.currentView === "er" && !props.codeActive,
      onSelect: props.onOpenEr,
    },
    {
      id: "translation",
      title: "Traduzione",
      status: translationStatus.status,
      tone: translationStatus.tone,
      active: props.currentView === "translation",
      onSelect: props.onOpenTranslation,
    },
    {
      id: "logical",
      title: "Schema logico",
      status: logicalStatus.status,
      tone: logicalStatus.tone,
      active: props.currentView === "logical" && !props.sqlActive,
      onSelect: props.onOpenLogical,
    },
    {
      id: "sql",
      title: "SQL",
      status: sqlStatus.status,
      tone: sqlStatus.tone,
      active: props.currentView === "logical" && props.sqlActive,
      onSelect: props.onOpenSql,
    },
  ];
  const activeStage = stages.find((stage) => stage.active) ?? stages[0];

  return (
    <section className="workspace-stage-bar" aria-label="Workflow di progettazione">
      <div className={`workspace-stage-meta tone-${activeStage.tone}`}>
        <span className="workspace-stage-bar-eyebrow">Workflow</span>
        <strong>{activeStage.title}</strong>
        <span className="workspace-stage-meta-status">{activeStage.status}</span>
      </div>

      <div className="workspace-stage-list" role="list">
        {stages.map((stage, index) => (
          <button
            key={stage.id}
            type="button"
            className={
              stage.active
                ? `workspace-stage-card active tone-${stage.tone}`
                : `workspace-stage-card tone-${stage.tone}`
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

      <div className="workspace-stage-utility">
        <button
          type="button"
          className={props.codeActive ? "workspace-stage-utility-button active" : "workspace-stage-utility-button"}
          onClick={props.onOpenCode}
        >
          Diagram code
        </button>
      </div>
    </section>
  );
}
