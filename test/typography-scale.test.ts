import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * La scala tipografica e l'unica sorgente delle dimensioni di testo del chrome.
 *
 * Esisteva in `tokens.css` ma quasi nessuno ci passava: su 847 dichiarazioni
 * `font-size` solo 104 usavano un token. 287 letterali coincidevano esattamente
 * con un token, altri 376 stavano fuori scala di 0.01-0.08rem — ed erano questi
 * a produrre le dieci dimensioni distinte, quasi tutte frazionarie, che si
 * misuravano su una singola schermata: superfici accostate che non si allineano
 * mai per meta pixel.
 *
 * Il controllo e sulla sorgente perche una regola CSS non renderizzata non la
 * vede nessun test di runtime.
 */

const SRC_ROOT = fileURLToPath(new URL("../src", import.meta.url));
const tokensCss = readFileSync(join(SRC_ROOT, "styles", "tokens.css"), "utf8");

/**
 * Dove il valore letterale resta legittimo.
 *
 * L'editor di codice e i pannelli codice/note del diagramma sono superfici
 * monospazio la cui misura e una decisione loro, non una voce della scala del
 * chrome: agganciarle creerebbe un token col nome di un valore, che
 * `TOKEN-DEBT.md` elenca fra i residui intenzionali.
 */
const LITERAL_ALLOWED = /code-editor|diagram-code|diagram-notes|code-mode-panel|cm-|gutter/i;

/** Intervallo del testo di chrome: fuori restano titoli e testo del diagramma. */
const CHROME_MIN_REM = 0.6;
const CHROME_MAX_REM = 1.05;

function listCss(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listCss(full));
    else if (entry.endsWith(".css")) files.push(full);
  }
  return files;
}

test("the type scale keeps its six steps", () => {
  for (const [name, value] of [
    ["2xs", "0.68rem"],
    ["xs", "0.72rem"],
    ["sm", "0.76rem"],
    ["md", "0.82rem"],
    ["lg", "0.9rem"],
    ["xl", "1rem"],
  ]) {
    assert.match(
      tokensCss,
      new RegExp(`--font-size-${name}:\\s*${value.replace(".", "\\.")};`),
      `--font-size-${name} deve valere ${value}`,
    );
  }
});

test("no chrome font size sits off the scale", () => {
  const ruleRe = /([^{}]*?)\{([^{}]*)\}/gs;
  const fontRe = /font-size:\s*([\d.]+)rem/g;
  const offenders: string[] = [];

  for (const file of listCss(SRC_ROOT)) {
    const source = readFileSync(file, "utf8");
    for (const rule of source.matchAll(ruleRe)) {
      const [, selector, body] = rule;
      for (const declaration of body.matchAll(fontRe)) {
        const value = Number.parseFloat(declaration[1]);
        if (value < CHROME_MIN_REM || value > CHROME_MAX_REM) continue;
        if (LITERAL_ALLOWED.test(selector)) continue;
        offenders.push(
          `${relative(SRC_ROOT, file)}: ${value}rem in "${selector.trim().replace(/\s+/g, " ").slice(-70)}"`,
        );
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `queste dimensioni non passano dalla scala e riportano il disallineamento a meta pixel:\n${offenders.join("\n")}`,
  );
});
