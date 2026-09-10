import type {
  SqlPlaygroundRequestPayload,
  SqlPlaygroundResponse,
  SqlPlaygroundResponsePayload,
} from "./sqlPlaygroundProtocol";
import { isSqlPlaygroundResponse } from "./sqlPlaygroundProtocol";
import type { SqlPlaygroundSessionState } from "./sqlPlaygroundState";
import type { SqlExplorerMetadata } from "./sqlExplorerTypes";
import type { ImportedDatabaseOpenResult } from "../database-workspace/databaseWorkspaceTypes";
import type {
  SqlPopulationApplyResult,
  SqlPopulationConfig,
  SqlPopulationPlanPreview,
} from "./sqlDataPopulationTypes";

export type SqlPlaygroundManagerEvent =
  | { type: "session-created"; sessionId: string }
  | { type: "session-state-changed"; sessionId: string }
  | { type: "database-opened"; sessionId: string }
  | { type: "database-restored"; sessionId: string }
  | { type: "schema-ready"; sessionId: string }
  | { type: "execution-complete"; sessionId: string; schemaChanged: boolean }
  | { type: "population-planned"; sessionId: string; planId: string }
  | { type: "population-applied"; sessionId: string; planId: string }
  | { type: "schema-changed"; sessionId: string }
  | { type: "session-closed"; sessionId: string }
  | { type: "disposed" };

export type SqlPlaygroundManagerListener = (event: SqlPlaygroundManagerEvent) => void;

export class SqlPlaygroundClientError extends Error {
  readonly payload;

  constructor(payload: Extract<SqlPlaygroundResponsePayload, { type: "error" }>["error"]) {
    super(payload.message);
    this.name = "SqlPlaygroundClientError";
    this.payload = payload;
  }
}

export class SqlPlaygroundManager {
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<
    string,
    { resolve: (response: SqlPlaygroundResponse) => void; reject: (error: Error) => void }
  >();
  private readonly sessionStates = new Map<string, SqlPlaygroundSessionState>();
  private readonly listeners = new Set<SqlPlaygroundManagerListener>();
  private initialization: Promise<string> | null = null;

  getSessionState(sessionId: string): SqlPlaygroundSessionState | undefined {
    return this.sessionStates.get(sessionId);
  }

  setSessionState(state: SqlPlaygroundSessionState): void {
    const created = !this.sessionStates.has(state.sessionId);
    this.sessionStates.set(state.sessionId, state);
    if (created) this.emit({ type: "session-created", sessionId: state.sessionId });
    this.emit({ type: "session-state-changed", sessionId: state.sessionId });
  }

  getSessionStates(): SqlPlaygroundSessionState[] {
    return [...this.sessionStates.values()];
  }

  subscribe(listener: SqlPlaygroundManagerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SqlPlaygroundManagerEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  private getWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./sqlite.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isSqlPlaygroundResponse(event.data)) return;
      const pending = this.pending.get(event.data.requestId);
      if (!pending) return;
      this.pending.delete(event.data.requestId);
      if (event.data.type === "error") {
        pending.reject(new SqlPlaygroundClientError(event.data.error));
      } else {
        pending.resolve(event.data);
      }
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || "SQLite worker failed.");
      this.pending.forEach(({ reject }) => reject(error));
      this.pending.clear();
    };
    this.worker = worker;
    return worker;
  }

  private send(payload: SqlPlaygroundRequestPayload, transfer: Transferable[] = []): Promise<SqlPlaygroundResponse> {
    const requestId = `sql-playground-${this.nextRequestId++}`;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.getWorker().postMessage({ ...payload, requestId }, transfer);
    });
  }

  initialize(): Promise<string> {
    if (!this.initialization) {
      this.initialization = this.send({ type: "initialize" }).then((response) => {
        if (response.type !== "initialized") throw new Error("Unexpected SQLite initialization response.");
        return response.sqliteVersion;
      });
    }
    return this.initialization;
  }

  async createSchema(sessionId: string, sql: string, schemaChecksum: string, reset: boolean): Promise<void> {
    await this.initialize();
    const response = await this.send({
      type: reset ? "reset" : "create-schema",
      sessionId,
      sql,
      schemaChecksum,
    });
    if (response.type !== "schema-ready") throw new Error("Unexpected SQLite schema response.");
    this.emit({ type: "schema-ready", sessionId });
  }

  async openDatabase(input: {
    sessionId: string;
    fileName: string;
    fileSize: number;
    bytes: ArrayBuffer;
  }): Promise<ImportedDatabaseOpenResult> {
    await this.initialize();
    const response = await this.send({ type: "open-database", ...input }, [input.bytes]);
    if (response.type !== "database-opened") throw new Error("Unexpected SQLite open response.");
    this.emit({ type: "database-opened", sessionId: input.sessionId });
    return response;
  }

  async execute(sessionId: string, sql: string, maxRows: number) {
    const response = await this.send({ type: "execute", sessionId, sql, maxRows });
    if (response.type !== "execution-complete") throw new Error("Unexpected SQLite execution response.");
    this.emit({ type: "execution-complete", sessionId, schemaChanged: response.schemaChanged });
    if (response.schemaChanged) this.emit({ type: "schema-changed", sessionId });
    return response;
  }

  async inspectSchema(sessionId: string): Promise<SqlExplorerMetadata> {
    const response = await this.send({ type: "inspect-schema", sessionId });
    if (response.type !== "schema-inspected") throw new Error("Unexpected SQLite schema inspection response.");
    return response.metadata;
  }

  async planPopulation(sessionId: string, config: SqlPopulationConfig): Promise<SqlPopulationPlanPreview> {
    const response = await this.send({ type: "plan-population", sessionId, ...config });
    if (response.type !== "population-planned") throw new Error("Unexpected SQLite population planning response.");
    this.emit({ type: "population-planned", sessionId, planId: response.planId });
    return response;
  }

  async applyPopulation(sessionId: string, planId: string): Promise<SqlPopulationApplyResult> {
    const response = await this.send({ type: "apply-population", sessionId, planId });
    if (response.type !== "population-applied") throw new Error("Unexpected SQLite population apply response.");
    this.emit({ type: "population-applied", sessionId, planId });
    return response;
  }

  async reverseDatabase(sessionId: string): Promise<{
    metadata: SqlExplorerMetadata;
    schemaSignature: string;
  }> {
    const response = await this.send({ type: "reverse-database", sessionId });
    if (response.type !== "database-reversed") throw new Error("Unexpected SQLite reverse response.");
    return { metadata: response.metadata, schemaSignature: response.schemaSignature };
  }

  async restoreDatabase(sessionId: string): Promise<{
    metadata: SqlExplorerMetadata;
    schemaSignature: string;
  }> {
    const response = await this.send({ type: "restore-database", sessionId });
    if (response.type !== "database-restored") throw new Error("Unexpected SQLite restore response.");
    this.emit({ type: "database-restored", sessionId });
    this.emit({ type: "schema-changed", sessionId });
    return { metadata: response.metadata, schemaSignature: response.schemaSignature };
  }

  async exportDatabase(sessionId: string): Promise<ArrayBuffer> {
    const response = await this.send({ type: "export", sessionId });
    if (response.type !== "export-complete") throw new Error("Unexpected SQLite export response.");
    return response.bytes;
  }

  async closeSession(sessionId: string): Promise<void> {
    this.sessionStates.delete(sessionId);
    if (!this.worker) {
      this.emit({ type: "session-closed", sessionId });
      return;
    }
    const response = await this.send({ type: "close-session", sessionId });
    if (response.type !== "session-closed") throw new Error("Unexpected SQLite close response.");
    this.emit({ type: "session-closed", sessionId });
  }

  async closeGeneratedSessions(projectId?: string): Promise<void> {
    const sessionIds = this.getSessionStates()
      .filter((state) => state.source.kind === "generated-schema"
        && (projectId === undefined || state.source.projectId === projectId))
      .map((state) => state.sessionId);
    await Promise.all(sessionIds.map((sessionId) => this.closeSession(sessionId)));
  }

  async dispose(): Promise<void> {
    this.sessionStates.clear();
    const worker = this.worker;
    if (!worker) {
      this.emit({ type: "disposed" });
      this.listeners.clear();
      return;
    }
    try {
      await this.send({ type: "dispose" });
    } finally {
      worker.terminate();
      this.worker = null;
      this.initialization = null;
      const error = new Error("SQLite worker disposed.");
      this.pending.forEach(({ reject }) => reject(error));
      this.pending.clear();
      this.emit({ type: "disposed" });
      this.listeners.clear();
    }
  }
}
