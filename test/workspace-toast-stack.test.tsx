import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import type { WorkspaceNotice } from "../src/hooks/useWorkspaceNotices.ts";
import {
  MAX_VISIBLE_WORKSPACE_TOASTS,
  WorkspaceToastStack,
  formatNoticeRelativeTime,
  getDefaultNoticeTitle,
  getVisibleWorkspaceToasts,
} from "../src/components/WorkspaceToastStack.tsx";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function notice(overrides: Partial<WorkspaceNotice> = {}): WorkspaceNotice {
  return {
    id: 1,
    title: "Operazione non valida",
    message: "Non puoi collegare questi elementi direttamente.",
    tone: "warning",
    createdAt: 1_000,
    ...overrides,
  };
}

function renderToastStack(notices: WorkspaceNotice[]): string {
  return renderToStaticMarkup(
    <I18nProvider>
      <WorkspaceToastStack notices={notices} onDismissNotice={() => undefined} />
    </I18nProvider>,
  );
}

test("workspace toast stack renders all visible notices, not only the first", () => {
  const markup = renderToastStack([
    notice({ id: 1, message: "Primo messaggio", createdAt: 1_000 }),
    notice({ id: 2, tone: "error", title: "Errore", message: "Secondo messaggio", createdAt: 2_000 }),
  ]);

  assert.match(markup, /Primo messaggio/);
  assert.match(markup, /Secondo messaggio/);
});

test("workspace toast stack renders title, message, close button and tone class", () => {
  const markup = renderToastStack([
    notice({ id: 3, tone: "error", title: "Errore nel codice ERS", message: "Sintassi ERS non valida." }),
  ]);

  assert.match(markup, /Errore nel codice ERS/);
  assert.match(markup, /Sintassi ERS non valida\./);
  assert.match(markup, /workspace-toast tone-error/);
  assert.match(markup, /aria-label="(?:Dismiss notification|Chiudi notifica|Mbyll njoftimin)"/);
  assert.match(markup, /role="alert"/);
});

test("workspace toast stack limits visible notices to the newest four", () => {
  const notices = Array.from({ length: 6 }, (_, index) =>
    notice({ id: index + 1, message: `Messaggio ${index + 1}`, createdAt: index + 1 }),
  );
  const visible = getVisibleWorkspaceToasts(notices);
  const markup = renderToastStack(notices);

  assert.equal(visible.length, MAX_VISIBLE_WORKSPACE_TOASTS);
  assert.deepEqual(visible.map((item) => item.id), [6, 5, 4, 3]);
  assert.match(markup, /Messaggio 6/);
  assert.doesNotMatch(markup, /Messaggio 1/);
});

test("workspace toast helpers provide default titles and relative time", () => {
  assert.equal(getDefaultNoticeTitle("warning"), "Operazione non valida");
  assert.equal(getDefaultNoticeTitle("info"), "Informazione");
  assert.equal(formatNoticeRelativeTime(1_000, 4_000), "ora");
  assert.equal(formatNoticeRelativeTime(1_000, 12_000), "11 sec fa");
  assert.equal(formatNoticeRelativeTime(1_000, 121_000), "2 min fa");
});
