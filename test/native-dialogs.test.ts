import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * I dialoghi nativi del browser non appartengono alla shell.
 *
 * `window.confirm`/`prompt`/`alert` ignorano tema, focus trap, ripristino del
 * focus e traduzioni; alcuni browser possono sopprimerli del tutto, e in quel
 * caso l'azione resta silenziosamente inerte. Le conferme piu costose dell'app
 * — scartare il lavoro di ristrutturazione, chiudere le note non salvate,
 * rinominare tabelle e colonne — passavano tutte di li.
 *
 * L'app ha le proprie superfici (`useAppDialogs` + la shell `Modal`): questo
 * test impedisce che qualcuna torni indietro.
 */

// `fileURLToPath` e non `.pathname`: il percorso del repo contiene uno spazio,
// che nell'URL resta codificato come %20 e romperebbe la lettura su disco.
const SOURCE_ROOT = fileURLToPath(new URL("../src/", import.meta.url));
const SOURCE_EXTENSIONS = [".ts", ".tsx"];
// Le occorrenze dentro commenti spiegano proprio perche non si usano.
const NATIVE_DIALOG_CALL = /\bwindow\.(confirm|prompt|alert)\s*\(/;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      return collectSourceFiles(fullPath);
    }
    return SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension)) ? [fullPath] : [];
  });
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("no source file calls a native browser dialog", () => {
  const offenders = collectSourceFiles(SOURCE_ROOT).flatMap((filePath) => {
    const code = stripComments(readFileSync(filePath, "utf8"));
    return NATIVE_DIALOG_CALL.test(code) ? [relative(SOURCE_ROOT, filePath)] : [];
  });

  assert.deepEqual(
    offenders,
    [],
    `usano un dialogo nativo invece delle superfici dell'app: ${offenders.join(", ")}`,
  );
});

test("the surfaces that replaced them route through the app dialogs", () => {
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const logicalSource = readFileSync(
    new URL("../src/logical/LogicalTranslationWorkspace.tsx", import.meta.url),
    "utf8",
  );

  // Azzeramento della ristrutturazione: scarta lavoro applicato.
  assert.match(appSource, /function confirmResetTranslationWork/);
  assert.match(appSource, /dialogs\.resetTranslation\.title/);

  // Rinomina di tabelle e colonne nella vista logica.
  assert.match(logicalSource, /onRequestRename/);
  assert.match(appSource, /onRequestRename=/);
});

test("the rename prompt uses translated strings", () => {
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  // Erano tre stringhe italiane cablate, con le chiavi gia tradotte e mai usate.
  assert.match(appSource, /t\("dialogs\.prompt\.renameElementTitle"\)/);
  assert.match(appSource, /t\("dialogs\.prompt\.renameElementLabel"\)/);
  assert.match(appSource, /t\("dialogs\.prompt\.renameElementRequired"\)/);
  assert.doesNotMatch(appSource, /"Rinomina elemento"/);
  assert.doesNotMatch(appSource, /"Nuovo nome elemento"/);
});
