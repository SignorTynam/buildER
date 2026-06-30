import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MAX_NOTICE_HISTORY,
  NOTICE_DURATION_MS,
  getWorkspaceNoticeDeduplicationKey,
} from "../src/hooks/useWorkspaceNotices.ts";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const workspaceNoticesSource = readFileSync(new URL("../src/hooks/useWorkspaceNotices.ts", import.meta.url), "utf8");

function getFunctionBody(source: string, functionName: string): string {
  const signatureIndex = source.indexOf(`function ${functionName}`);
  assert.notEqual(signatureIndex, -1, `${functionName} should exist`);

  const bodyStart = source.indexOf("{", signatureIndex);
  assert.notEqual(bodyStart, -1, `${functionName} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(bodyStart + 1, index);
      }
    }
  }

  assert.fail(`${functionName} body should be closed`);
}

test("workspace notices define toast durations for every tone", () => {
  assert.equal(NOTICE_DURATION_MS.success, 3200);
  assert.equal(NOTICE_DURATION_MS.info, 3600);
  assert.equal(NOTICE_DURATION_MS.warning, 4400);
  assert.equal(NOTICE_DURATION_MS.error, 6200);
});

test("workspace notices keep a bounded history for toast stacks", () => {
  assert.equal(MAX_NOTICE_HISTORY, 8);
});

test("workspace notices dedupe by tone, title, message and target", () => {
  const base = getWorkspaceNoticeDeduplicationKey({
    tone: "warning",
    title: "Collegamento non valido",
    message: "Questi due elementi non possono essere collegati direttamente.",
    targetId: "edge-1",
  });
  const duplicate = getWorkspaceNoticeDeduplicationKey({
    tone: "warning",
    title: "Collegamento non valido",
    message: "Questi due elementi non possono essere collegati direttamente.",
    targetId: "edge-1",
  });
  const differentTarget = getWorkspaceNoticeDeduplicationKey({
    tone: "warning",
    title: "Collegamento non valido",
    message: "Questi due elementi non possono essere collegati direttamente.",
    targetId: "edge-2",
  });

  assert.equal(base, duplicate);
  assert.notEqual(base, differentTarget);
});

test("validation warnings are not promoted to toast notices", () => {
  assert.doesNotMatch(appSource, /showSelectionWarningNotice/);
  assert.doesNotMatch(appSource, /selectedWarningIssue/);
  assert.doesNotMatch(appSource, /showSelectionWarningNotice\(selectedWarningIssue\)/);
});

test("validation issue click does not show toast", () => {
  const handleIssueNoticeBody = getFunctionBody(appSource, "handleIssueNotice");

  assert.match(handleIssueNoticeBody, /setStatusMessage\(getLocalizedValidationIssueMessage\(issue\)\)/);
  assert.match(handleIssueNoticeBody, /selectIssueTarget\(issue\)/);
  assert.doesNotMatch(handleIssueNoticeBody, /showWarningNotice\(issue\.message\)/);
  assert.doesNotMatch(handleIssueNoticeBody, /showErrorNotice\(formattedIssue\)/);
  assert.doesNotMatch(handleIssueNoticeBody, /showNotice\(/);
  assert.doesNotMatch(handleIssueNoticeBody, /show(?:Warning|Error|Success|Info)?Notice/);
});

test("workspace notices do not expose selection validation sticky toasts", () => {
  assert.doesNotMatch(workspaceNoticesSource, /function showSelectionWarningNotice/);
  assert.doesNotMatch(workspaceNoticesSource, /selection-warning/);
  assert.doesNotMatch(workspaceNoticesSource, /stickyType:\s*"selection-warning"/);
  assert.doesNotMatch(workspaceNoticesSource, /Avviso di validazione/);
  assert.match(workspaceNoticesSource, /stickyType\?: "source-selection"/);
  assert.match(
    workspaceNoticesSource,
    /validateDiagram issues stay in Errors, canvas diagnostics, and status text/,
  );
});
