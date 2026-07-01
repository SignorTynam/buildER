import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProjectActivityPanel } from "../src/components/project/ProjectActivityPanel.tsx";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("ProjectActivityPanel keeps rail actions and removes bottom collapse control", () => {
  const markup = renderToStaticMarkup(
    <ProjectActivityPanel
      items={[
        { id: "file", label: "Explorer", icon: "folder" },
        { id: "code", label: "Code", icon: "code" },
      ]}
      activeId="file"
      open
      width={260}
      title="Workspace"
      closeLabel="Close panel"
      openLabel="Open panel"
      commandMenuLabel="Command menu"
      keyboardShortcutsLabel="Keyboard shortcuts"
      onSelect={() => undefined}
      onToggleOpen={() => undefined}
      onOpenCommandMenu={() => undefined}
      onOpenShortcuts={() => undefined}
      onResizeStart={() => undefined}
    >
      <section>Panel content</section>
    </ProjectActivityPanel>,
  );
  const source = readFileSync(new URL("../src/components/project/ProjectActivityPanel.tsx", import.meta.url), "utf8");

  assert.match(markup, /Command menu/);
  assert.match(markup, /Keyboard shortcuts/);
  assert.match(markup, /project-activity-rail__bottom/);
  assert.doesNotMatch(source, /project-activity-collapse/);
});
