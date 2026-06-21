import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const diagramCanvasSource = readFileSync(
  new URL("../src/canvas/DiagramCanvas.tsx", import.meta.url),
  "utf8",
);

test("DiagramCanvas does not expose the legacy implicit external identifier click flow", () => {
  assert.equal(diagramCanvasSource.includes("onCreateExternalIdentifier"), false);
  assert.equal(diagramCanvasSource.includes("canStartExternalIdentifier"), false);
  assert.equal(diagramCanvasSource.includes("externalIdentifierFlowActive"), false);
  assert.equal(diagramCanvasSource.includes("Step 2 di 2 - Identificatore esterno"), false);
});

test("DiagramCanvas does not keep legacy edge pointer-drag interaction code", () => {
  const legacyInteractionKind = ["edge", "drag"].join("-");

  assert.equal(diagramCanvasSource.includes(`"${legacyInteractionKind}"`), false);
  assert.equal(diagramCanvasSource.includes(`interaction.kind === "${legacyInteractionKind}"`), false);
  assert.equal(diagramCanvasSource.includes(`kind: "${legacyInteractionKind}"`), false);
});
