import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * Skin unica per le `<select>`.
 *
 * Ce n'erano tre diverse — `.settings-select`, il dialetto del pannello Codice,
 * la sessione di SQL Explorer — e nessuna spegneva `appearance`: il controllo
 * restava disegnato dal sistema operativo dentro un'interfaccia interamente
 * custom, con altezze e font diversi da campo a campo. Due delle cinque select
 * non avevano nemmeno una classe.
 *
 * Il controllo e sulla sorgente perche una select non renderizzata non la vede
 * nessun test di runtime: qui si tiene l'invariante che ogni `<select>` nasca
 * gia con la skin condivisa.
 */

const srcDir = fileURLToPath(new URL("../src", import.meta.url));
const uiCssSource = readFileSync(new URL("../src/styles/ui.css", import.meta.url), "utf8");

function collectSources(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectSources(full));
    } else if (entry.endsWith(".tsx")) {
      files.push(full);
    }
  }
  return files;
}

/** Apertura del tag `<select`, con tutti i suoi attributi fino a `>`. */
function selectTags(source: string): string[] {
  return [...source.matchAll(/<select\b[^>]*>/g)].map((match) => match[0]);
}

test("every rendered select carries the shared skin", () => {
  const offenders: string[] = [];

  for (const file of collectSources(srcDir)) {
    const source = readFileSync(file, "utf8");
    for (const tag of selectTags(source)) {
      if (!/className=\{?["'`][^"'`]*\bui-select\b/.test(tag)) {
        offenders.push(`${file.slice(srcDir.length + 1)}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `queste <select> non usano .ui-select e tornerebbero al widget di sistema:\n${offenders.join("\n")}`,
  );
});

test("the shared select skin replaces the native widget instead of decorating it", () => {
  const block = uiCssSource.match(/\.ui-select\s*\{[\s\S]*?\}/);
  assert.ok(block, ".ui-select deve esistere in ui.css");

  // Senza `appearance: none` il resto della skin si limita a incorniciare il
  // controllo di sistema, che era esattamente il difetto di partenza.
  assert.match(block[0], /appearance:\s*none/);
  assert.match(block[0], /-webkit-appearance:\s*none/);
  // Il chevron sostituisce quello nativo che `appearance: none` porta via.
  assert.match(block[0], /background-image:\s*var\(--ui-select-chevron\)/);
  // Stessa altezza degli altri campi, invece di dipendere dal padding.
  assert.match(block[0], /min-height:\s*var\(--size-input\)/);
  assert.match(block[0], /font-size:\s*var\(--font-size-sm\)/);

  assert.match(uiCssSource, /\.ui-select:focus-visible\s*\{[\s\S]*?box-shadow:\s*var\(--focus-ring\)/);
});

test("the superseded per-panel select skins are gone", () => {
  const settingsCss = readFileSync(new URL("../src/styles/settings.css", import.meta.url), "utf8");
  const explorerCss = readFileSync(new URL("../src/styles/project-explorer.css", import.meta.url), "utf8");

  assert.doesNotMatch(settingsCss, /\.settings-select\s*\{/);
  // Il wrapper resta (lo verifica editor-layout.test.ts); a sparire sono le
  // dichiarazioni visive che ora arrivano dalla skin condivisa.
  const dialect = explorerCss.match(/\.code-activity-panel__dialect select\s*\{[\s\S]*?\}/);
  assert.ok(dialect, "la regola di larghezza del dialetto deve restare");
  assert.doesNotMatch(dialect[0], /background:/);
  assert.doesNotMatch(dialect[0], /border:/);
});
