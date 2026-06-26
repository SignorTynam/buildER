import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAutoPairEdit,
  applyTabEdit,
  buildLineNumbers,
  getCodeLineCount,
  shouldSyncCodeDraftFromDiagram,
} from "../src/utils/codeEditor.ts";

test("code editor: line count handles empty and trailing newline input", () => {
  assert.equal(getCodeLineCount(""), 1);
  assert.equal(getCodeLineCount("a"), 1);
  assert.equal(getCodeLineCount("a\nb\n"), 3);
  assert.deepEqual(buildLineNumbers("a\nb\n"), ["1", "2", "3"]);
});

test("code editor: tab inserts two spaces and preserves unselected text", () => {
  const edit = applyTabEdit("abc", 1, 1);

  assert.equal(edit.value, "a  bc");
  assert.equal(edit.selectionStart, 3);
  assert.equal(edit.selectionEnd, 3);
});

test("code editor: tab replaces only selected text", () => {
  const edit = applyTabEdit("abcdef", 2, 4);

  assert.equal(edit.value, "ab  ef");
  assert.equal(edit.selectionStart, 4);
  assert.equal(edit.selectionEnd, 4);
});

test("code editor: auto-pair inserts parentheses and keeps cursor inside", () => {
  const edit = applyAutoPairEdit("abc", 1, 1, "(");

  assert.ok(edit);
  assert.equal(edit.value, "a()bc");
  assert.equal(edit.selectionStart, 2);
  assert.equal(edit.selectionEnd, 2);
});

test("code editor: auto-pair wraps selected text", () => {
  const edit = applyAutoPairEdit("abcdef", 2, 5, "(");

  assert.ok(edit);
  assert.equal(edit.value, "ab(cde)f");
  assert.equal(edit.selectionStart, 3);
  assert.equal(edit.selectionEnd, 6);
});

test("code editor: edit helpers do not remove unselected text", () => {
  const tabEdit = applyTabEdit("before-after", 6, 6);
  const pairEdit = applyAutoPairEdit("before-after", 6, 6, "{");

  assert.equal(tabEdit.value.startsWith("before"), true);
  assert.equal(tabEdit.value.endsWith("-after"), true);
  assert.ok(pairEdit);
  assert.equal(pairEdit.value.startsWith("before"), true);
  assert.equal(pairEdit.value.endsWith("-after"), true);
});

test("code editor: diagram serialization does not sync over active editing", () => {
  assert.equal(shouldSyncCodeDraftFromDiagram({ focused: true, dirty: false, source: "external" }), false);
  assert.equal(shouldSyncCodeDraftFromDiagram({ focused: true, dirty: true, source: "external" }), false);
  assert.equal(shouldSyncCodeDraftFromDiagram({ focused: false, dirty: false, source: "code-parse" }), false);
  assert.equal(shouldSyncCodeDraftFromDiagram({ focused: false, dirty: false, source: "external" }), true);
  assert.equal(shouldSyncCodeDraftFromDiagram({ focused: false, dirty: true, source: "external" }), true);
});
