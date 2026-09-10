import { useEffect, useRef, useState, type FormEvent } from "react";
import { StudioIcon } from "../../components/icons/StudioIcon";
import { Button, Field, Modal } from "../../components/ui";
import { useI18n } from "../../i18n/useI18n";
import { normalizeSqlPlaygroundError } from "../../utils/sqlPlayground";
import { SqlPlaygroundClientError } from "./SqlPlaygroundManager";
import type { SqlPlaygroundErrorPayload } from "./sqlPlaygroundProtocol";
import {
  parseSqlPopulationRows,
  parseSqlPopulationSeed,
} from "./sqlDataPopulation";
import {
  SQL_POPULATION_DEFAULT_ROWS,
  SQL_POPULATION_DEFAULT_SEED,
  SQL_POPULATION_MAX_ROWS,
  SQL_POPULATION_MAX_SEED,
  SQL_POPULATION_MIN_ROWS,
  type SqlPopulationApplyResult,
  type SqlPopulationConfig,
  type SqlPopulationPlanPreview,
} from "./sqlDataPopulationTypes";

type PopulationDialogPhase = "config" | "planning" | "preview" | "applying" | "confirm-reset" | "success" | "error";

interface SqlDataPopulationDialogProps {
  open: boolean;
  onClose: () => void;
  onPlan: (config: SqlPopulationConfig) => Promise<SqlPopulationPlanPreview>;
  onApply: (planId: string) => Promise<SqlPopulationApplyResult>;
  onRecreate: () => Promise<boolean>;
}

function normalizePopulationError(operation: "plan-population" | "apply-population" | "reset", error: unknown) {
  return error instanceof SqlPlaygroundClientError
    ? error.payload
    : normalizeSqlPlaygroundError(operation, error);
}

export function SqlDataPopulationDialog({
  open,
  onClose,
  onPlan,
  onApply,
  onRecreate,
}: SqlDataPopulationDialogProps) {
  const { t } = useI18n();
  const rowsInputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<PopulationDialogPhase>("config");
  const [rowsValue, setRowsValue] = useState(String(SQL_POPULATION_DEFAULT_ROWS));
  const [seedValue, setSeedValue] = useState(String(SQL_POPULATION_DEFAULT_SEED));
  const [submitted, setSubmitted] = useState(false);
  const [plan, setPlan] = useState<SqlPopulationPlanPreview | null>(null);
  const [result, setResult] = useState<SqlPopulationApplyResult | null>(null);
  const [error, setError] = useState<SqlPlaygroundErrorPayload | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("config");
    setRowsValue(String(SQL_POPULATION_DEFAULT_ROWS));
    setSeedValue(String(SQL_POPULATION_DEFAULT_SEED));
    setSubmitted(false);
    setPlan(null);
    setResult(null);
    setError(null);
  }, [open]);

  const rows = parseSqlPopulationRows(rowsValue);
  const seed = parseSqlPopulationSeed(seedValue);
  const busy = phase === "planning" || phase === "applying";

  function presentError(payload: SqlPlaygroundErrorPayload): void {
    setError(payload);
    setPhase("error");
  }

  async function handlePlan(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    setSubmitted(true);
    if (rows === null || seed === null) return;
    const config = { rowsPerTable: rows, seed };
    setError(null);
    setPhase("planning");
    try {
      const nextPlan = await onPlan(config);
      setPlan(nextPlan);
      setPhase("preview");
    } catch (planningError) {
      const payload = normalizePopulationError("plan-population", planningError);
      if (payload.code === "population-database-not-empty") {
        setError(payload);
        setPhase("confirm-reset");
      } else {
        presentError(payload);
      }
    }
  }

  async function handleApply(): Promise<void> {
    if (!plan) return;
    setError(null);
    setPhase("applying");
    try {
      const applied = await onApply(plan.planId);
      setResult(applied);
      setPhase("success");
    } catch (applyError) {
      presentError(normalizePopulationError("apply-population", applyError));
    }
  }

  async function handleRecreateAndApply(): Promise<void> {
    if (rows === null || seed === null) {
      setPhase("config");
      setSubmitted(true);
      return;
    }
    setError(null);
    setPhase("applying");
    const recreated = await onRecreate();
    if (!recreated) {
      presentError(normalizePopulationError("reset", new Error("The database could not be recreated.")));
      return;
    }
    try {
      const nextPlan = await onPlan({ rowsPerTable: rows, seed });
      setPlan(nextPlan);
      const applied = await onApply(nextPlan.planId);
      setResult(applied);
      setPhase("success");
    } catch (populationError) {
      presentError(normalizePopulationError("apply-population", populationError));
    }
  }

  function errorMessage(payload: SqlPlaygroundErrorPayload): string {
    switch (payload.code) {
      case "population-database-not-empty":
        return t("sqlPlayground.population.errors.databaseNotEmpty");
      case "population-schema-stale":
        return t("sqlPlayground.population.errors.schemaStale");
      case "population-plan-stale":
        return t("sqlPlayground.population.errors.planStale");
      case "population-unresolved-foreign-key":
      case "population-invalid-foreign-key-target":
        return t("sqlPlayground.population.errors.foreignKey");
      case "population-unsatisfiable-unique":
        return t("sqlPlayground.population.errors.unique");
      case "population-unsupported-generated-key":
      case "population-unsupported-unique-index":
        return t("sqlPlayground.population.errors.unsupportedConstraint");
      case "population-foreign-key-check-failed":
        return t("sqlPlayground.population.errors.foreignKeyCheck");
      case "population-session-not-generated":
        return t("sqlPlayground.population.errors.generatedOnly");
      default:
        return payload.message || t("sqlPlayground.population.errors.generic");
    }
  }

  const footer = phase === "config" ? (
    <>
      <Button variant="secondary" onClick={onClose}>{t("common.actions.cancel")}</Button>
      <Button variant="primary" iconLeft="sparkles" onClick={() => void handlePlan()}>
        {t("sqlPlayground.population.generatePreview")}
      </Button>
    </>
  ) : phase === "preview" ? (
    <>
      <Button variant="secondary" onClick={() => setPhase("config")}>{t("sqlPlayground.population.back")}</Button>
      <Button variant="primary" iconLeft="database" onClick={() => void handleApply()}>
        {t("sqlPlayground.population.generateAndInsert")}
      </Button>
    </>
  ) : phase === "confirm-reset" ? (
    <>
      <Button variant="secondary" onClick={onClose}>{t("common.actions.cancel")}</Button>
      <Button variant="danger" iconLeft="refresh" onClick={() => void handleRecreateAndApply()}>
        {t("sqlPlayground.population.recreateAndGenerate")}
      </Button>
    </>
  ) : phase === "success" ? (
    <Button variant="primary" onClick={onClose}>{t("common.actions.close")}</Button>
  ) : phase === "error" ? (
    <>
      <Button variant="secondary" onClick={onClose}>{t("common.actions.close")}</Button>
      <Button variant="primary" onClick={() => setPhase("config")}>{t("sqlPlayground.population.tryAgain")}</Button>
    </>
  ) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("sqlPlayground.population.title")}
      subtitle={t("sqlPlayground.population.subtitle")}
      size="lg"
      className="sql-population-dialog"
      backdropClassName="sql-population-dialog-backdrop"
      initialFocusRef={rowsInputRef}
      busy={busy}
      footer={footer}
      testId="sql-population-dialog"
    >
      <div className="sql-population-dialog__body">
        <div className="sql-population-dialog__status" aria-live="polite" aria-atomic="true">
          {phase === "planning" ? t("sqlPlayground.population.planning") : null}
          {phase === "applying" ? t("sqlPlayground.population.applying") : null}
          {phase === "success" ? t("sqlPlayground.population.successLive") : null}
        </div>

        {phase === "config" ? (
          <form className="sql-population-config" onSubmit={(event) => void handlePlan(event)}>
            <p>{t("sqlPlayground.population.configDescription")}</p>
            <div className="sql-population-config__fields">
              <Field
                label={t("sqlPlayground.population.rows.label")}
                help={t("sqlPlayground.population.rows.help", { min: SQL_POPULATION_MIN_ROWS, max: SQL_POPULATION_MAX_ROWS })}
                error={submitted && rows === null ? t("sqlPlayground.population.rows.error") : undefined}
              >
                {({ id, invalid, describedBy }) => (
                  <input
                    ref={rowsInputRef}
                    id={id}
                    data-autofocus
                    type="number"
                    inputMode="numeric"
                    min={SQL_POPULATION_MIN_ROWS}
                    max={SQL_POPULATION_MAX_ROWS}
                    step={1}
                    value={rowsValue}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    onChange={(event) => setRowsValue(event.target.value)}
                  />
                )}
              </Field>
              <Field
                label={t("sqlPlayground.population.seed.label")}
                help={t("sqlPlayground.population.seed.help")}
                error={submitted && seed === null ? t("sqlPlayground.population.seed.error", { max: SQL_POPULATION_MAX_SEED }) : undefined}
              >
                {({ id, invalid, describedBy }) => (
                  <input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={SQL_POPULATION_MAX_SEED}
                    step={1}
                    value={seedValue}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    onChange={(event) => setSeedValue(event.target.value)}
                  />
                )}
              </Field>
            </div>
            <p className="sql-population-dialog__privacy">
              <StudioIcon name="info" aria-hidden="true" />
              {t("sqlPlayground.population.privacy")}
            </p>
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
        ) : null}

        {phase === "planning" || phase === "applying" ? (
          <div className="sql-population-dialog__busy" role="status">
            <span className="ui-button__spinner" aria-hidden="true" />
            <strong>{phase === "planning" ? t("sqlPlayground.population.planning") : t("sqlPlayground.population.applying")}</strong>
            <span>{t("sqlPlayground.population.busyDescription")}</span>
          </div>
        ) : null}

        {phase === "preview" && plan ? (
          <div className="sql-population-preview">
            <dl className="sql-population-preview__totals">
              <div><dt>{t("sqlPlayground.population.summary.tables")}</dt><dd>{plan.tableCount}</dd></div>
              <div><dt>{t("sqlPlayground.population.summary.rows")}</dt><dd>{plan.totalRows}</dd></div>
              <div><dt>{t("sqlPlayground.population.seed.label")}</dt><dd>{plan.seed}</dd></div>
            </dl>
            <div className="sql-population-summary-scroll" tabIndex={0} aria-label={t("sqlPlayground.population.summary.label")}>
              <table className="sql-population-summary">
                <thead>
                  <tr>
                    <th scope="col">{t("sqlPlayground.population.summary.table")}</th>
                    <th scope="col">{t("sqlPlayground.population.summary.requested")}</th>
                    <th scope="col">{t("sqlPlayground.population.summary.generated")}</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.tables.map((table) => (
                    <tr key={table.tableName}>
                      <th scope="row">{table.tableName}</th>
                      <td>{table.requestedRows}</td>
                      <td>{table.generatedRows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {plan.warnings.length > 0 ? (
              <section className="sql-population-warnings" aria-labelledby="sql-population-warnings-title">
                <h3 id="sql-population-warnings-title">{t("sqlPlayground.population.warnings.title")}</h3>
                {plan.warnings.map((warning) => (
                  <div key={`${warning.code}:${warning.tableName}`} className="sql-population-warning" role="status">
                    <StudioIcon name="warning" aria-hidden="true" />
                    <span>{t("sqlPlayground.population.warnings.rowLimit", {
                      table: warning.tableName,
                      requested: warning.messageContext.requestedRows,
                      generated: warning.messageContext.generatedRows,
                    })}</span>
                  </div>
                ))}
              </section>
            ) : null}
            <section className="sql-population-preview__sql" aria-labelledby="sql-population-preview-sql-title">
              <h3 id="sql-population-preview-sql-title">{t("sqlPlayground.population.previewSql")}</h3>
              <pre tabIndex={0} aria-label={t("sqlPlayground.population.previewSqlLabel")}><code>{plan.previewSql}</code></pre>
            </section>
          </div>
        ) : null}

        {phase === "confirm-reset" ? (
          <div className="sql-population-reset" role="alert">
            <StudioIcon name="warning" aria-hidden="true" />
            <div>
              <h3>{t("sqlPlayground.population.reset.title")}</h3>
              <p>{t("sqlPlayground.population.reset.message")}</p>
              <p>{t("sqlPlayground.population.reset.loss")}</p>
            </div>
          </div>
        ) : null}

        {phase === "success" && result ? (
          <div className="sql-population-success" role="status">
            <StudioIcon name="success" aria-hidden="true" />
            <div>
              <h3>{t("sqlPlayground.population.success.title")}</h3>
              <p>{t("sqlPlayground.population.success.message", { rows: result.rowsInserted, tables: result.tableCount })}</p>
            </div>
          </div>
        ) : null}

        {phase === "error" && error ? (
          <div className="sql-population-error" role="alert">
            <StudioIcon name="error" aria-hidden="true" />
            <div>
              <h3>{t("sqlPlayground.population.errors.title")}</h3>
              <p>{errorMessage(error)}</p>
              {error.technicalDetail ? <details><summary>{t("sqlPlayground.population.errors.details")}</summary><code>{error.technicalDetail}</code></details> : null}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
