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
        { id: "file", label: "Explorer", icon: "openProject" },
        { id: "code", label: "Code", icon: "code" },
        { id: "version", label: "Source Control", icon: "history", badge: 2 },
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
  assert.match(markup, /project-activity-button active/);
  assert.match(markup, /project-activity-badge/);
  assert.doesNotMatch(source, /project-activity-collapse/);
});

test("ProjectActivityPanel collapsed keeps rail and hides content", () => {
  const markup = renderToStaticMarkup(
    <ProjectActivityPanel
      items={[
        { id: "file", label: "Explorer", icon: "openProject" },
        { id: "code", label: "Code", icon: "code" },
        { id: "reverse", label: "Reverse", icon: "databaseReverse" },
        { id: "errors", label: "Errors", icon: "warning" },
        { id: "version", label: "Source Control", icon: "history" },
        { id: "export", label: "Export", icon: "export" },
      ]}
      activeId="file"
      open={false}
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

  assert.match(markup, /project-activity-panel--collapsed/);
  assert.match(markup, /aria-label="Explorer"/);
  assert.match(markup, /aria-label="Code"/);
  assert.match(markup, /aria-label="Reverse"/);
  assert.match(markup, /aria-label="Errors"/);
  assert.match(markup, /aria-label="Source Control"/);
  assert.match(markup, /aria-label="Export"/);
  assert.doesNotMatch(markup, /Panel content/);
  assert.doesNotMatch(markup, /project-activity-badge/);
});
