import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyDiagram, createNode, validateDiagram } from "../src/utils/diagram.ts";

test("validateDiagram non segnala entita isolate come disconnected", () => {
  const diagram = createEmptyDiagram("Test");
  const entity = createNode("entity", { x: 160, y: 120 }, diagram);
  const issues = validateDiagram({
    ...diagram,
    nodes: [entity],
  });

  assert.equal(issues.some((issue) => issue.id.startsWith("entity-disconnected-")), false);
});
