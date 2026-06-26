import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_NOTICE_HISTORY,
  NOTICE_DURATION_MS,
  getWorkspaceNoticeDeduplicationKey,
} from "../src/hooks/useWorkspaceNotices.ts";

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
