import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Invarianti visive della chrome del workspace (header, activity rail,
 * Explorer, tab, barra di contesto) e del livello di movimento.
 *
 * Sono difetti gia visti tornare indietro perche vivono su fogli diversi che
 * si sovrascrivono a vicenda: qui restano ancorati al CSS che li risolve.
 */

/** I fogli sono su checkout Windows: i corpi delle regole si leggono a LF. */
const normalize = (text: string): string => text.replace(/\r\n/gu, "\n");

const readStyle = (name: string): string =>
  normalize(readFileSync(new URL(`../src/styles/${name}`, import.meta.url), "utf8"));

const readSource = (path: string): string =>
  normalize(readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8"));

/** Estrae il corpo della prima regola il cui selettore contiene `selector`. */
function ruleBody(css: string, selector: string): string {
  const index = css.indexOf(selector);
  assert.notEqual(index, -1, `selettore assente: ${selector}`);
  const open = css.indexOf("{", index);
  const close = css.indexOf("}", open);
  assert.ok(open !== -1 && close !== -1, `regola malformata: ${selector}`);
  return css.slice(open + 1, close);
}

test("la rail scura non porta anelli chiari sul pulsante attivo", () => {
  const rail = readStyle("activity-rail.css");
  const active = ruleBody(rail, '.project-activity-button.active,\n.project-activity-button[aria-pressed="true"]');

  // L'anello chiaro ereditato da project-explorer.css tagliava il nero della
  // rail subito sotto l'header e lo faceva sembrare disallineato.
  assert.match(active, /box-shadow:\s*none;/);
  assert.match(active, /border-color:\s*transparent;/);
});

test("le righe dell'Explorer non hanno barretta a sinistra ne riquadro sui tre puntini", () => {
  const workspace = readStyle("panels-workspace.css");

  assert.doesNotMatch(ruleBody(workspace, ".project-explorer-item {"), /border-left/);
  assert.doesNotMatch(ruleBody(workspace, ".project-explorer-item.selected {"), /border-left/);
  assert.doesNotMatch(ruleBody(workspace, ".project-explorer-item.active {"), /border-left/);
  assert.doesNotMatch(ruleBody(workspace, ".project-explorer-item.active.selected {"), /border-left/);

  const actions = ruleBody(workspace, ".project-explorer-item__actions button {");
  assert.match(actions, /background:\s*transparent;/);
  assert.match(actions, /border-color:\s*transparent;/);
  assert.doesNotMatch(ruleBody(workspace, ".project-explorer-item__actions {"), /linear-gradient/);
});

test("l'indicatore della tab attiva sta sul bordo basso e ha una sola origine", () => {
  const tabs = readStyle("editor-tabs.css");
  const indicator = ruleBody(tabs, ".project-file-tab.active::before {");

  assert.match(indicator, /bottom:\s*0;/);
  assert.match(indicator, /top:\s*auto;/);
  // Il vecchio inset shadow su project-explorer.css raddoppiava il segnale.
  assert.doesNotMatch(readStyle("project-explorer.css"), /inset 0 -2px 0 var\(--studio-accent\)/);
});

test("la barra di contesto porta solo azioni, allineate a sinistra", () => {
  const shell = readStyle("workspace-shell.css");
  const contextBar = ruleBody(shell, ".editor-context-bar {");
  assert.match(contextBar, /justify-content:\s*flex-start;/);

  const header = readSource("components/workspace/WorkspaceEditorHeader.tsx");
  assert.doesNotMatch(header, /editor-breadcrumb/);
  assert.doesNotMatch(header, /onReveal/);
  assert.doesNotMatch(header, /workspaceChrome\.reveal"/);
  assert.match(header, /editor-view-switcher/);

  // Nessun foglio deve conservare stili per una briciola che non esiste piu.
  for (const sheet of ["workspace-shell.css", "responsive.css", "panels-workspace.css"]) {
    assert.doesNotMatch(readStyle(sheet), /editor-breadcrumb/, `${sheet} cita ancora il breadcrumb`);
  }
});

test("il livello di movimento usa i token e rispetta prefers-reduced-motion", () => {
  const motion = readStyle("motion.css");
  const main = readSource("main.tsx");

  // Importato per ultimo: aggiunge movimento senza riscrivere il look.
  const imports = main.match(/^import ".*\.css";$/gmu) ?? [];
  assert.equal(imports.at(-1), 'import "./styles/motion.css";');

  const durations = motion.match(/animation:[^;]+;|transition:[\s\S]*?;/gu) ?? [];
  assert.ok(durations.length > 0, "il livello di movimento non dichiara animazioni");
  for (const declaration of durations) {
    assert.doesNotMatch(
      declaration,
      /\b\d+(?:\.\d+)?m?s\b/u,
      `durata hardcoded nel livello di movimento: ${declaration.trim()}`,
    );
  }

  const reduced = motion.slice(motion.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.ok(reduced.length > 0, "manca il blocco prefers-reduced-motion");
  for (const selector of [
    ".ui-modal-backdrop",
    ".ui-modal",
    ".command-modal.command-palette",
    ".app-topbar-menu__panel",
    ".project-activity-content > *",
    ".project-file-tab.active::before",
    ".editor-view-switcher button",
    // Animazioni preesistenti che erano rimaste senza guardia.
    ".project-explorer-context-menu",
    ".project-file-tab-menu",
    ".workspace-toast-viewport .workspace-toast",
    ".logical-view-layout",
  ]) {
    assert.ok(reduced.includes(selector), `${selector} resta animato con reduced motion`);
  }
});
