import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const exportSource = readFileSync(new URL("../src/utils/export.ts", import.meta.url), "utf8");
const diagramNodeSource = readFileSync(new URL("../src/canvas/DiagramNode.tsx", import.meta.url), "utf8");
const diagramEdgeSource = readFileSync(new URL("../src/canvas/DiagramEdge.tsx", import.meta.url), "utf8");
const diagramCanvasSource = readFileSync(new URL("../src/canvas/DiagramCanvas.tsx", import.meta.url), "utf8");

function functionBody(name: string): string {
  const start = exportSource.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const bodyStart = exportSource.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < exportSource.length; index += 1) {
    const char = exportSource[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return exportSource.slice(bodyStart, index + 1);
      }
    }
  }

  throw new Error(`Unable to read ${name} body`);
}

function localFunctionBody(name: string): string {
  const start = exportSource.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const bodyStart = exportSource.indexOf("{", start);
  let depth = 0;

  for (let index = bodyStart; index < exportSource.length; index += 1) {
    const char = exportSource[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return exportSource.slice(bodyStart, index + 1);
      }
    }
  }

  throw new Error(`Unable to read ${name} body`);
}

test("image export no longer enforces viewport-sized minimums", () => {
  assert.doesNotMatch(exportSource, /Math\.max\([^)]*1280/);
  assert.doesNotMatch(exportSource, /Math\.max\([^)]*720/);
  assert.doesNotMatch(exportSource, /1280\s*[x,]\s*720|720\s*[x,]\s*1280/);
});

test("PNG export is transparent and does not paint a white raster background", () => {
  const downloadPngBody = functionBody("downloadPng");

  assert.match(downloadPngBody, /format:\s*"png"/);
  assert.match(downloadPngBody, /background:\s*"transparent"/);
  assert.doesNotMatch(downloadPngBody, /fillStyle\s*=\s*["']#ffffff["']/i);
  assert.doesNotMatch(downloadPngBody, /fillRect\(/);
});

test("JPEG export exists, uses JPEG MIME, and paints a white background", () => {
  const downloadJpegBody = functionBody("downloadJpeg");

  assert.match(downloadJpegBody, /format:\s*"jpeg"/);
  assert.match(downloadJpegBody, /background:\s*"white"/);
  assert.match(downloadJpegBody, /styleMode:\s*"print"/);
  assert.match(exportSource, /image\/jpeg/);
  assert.match(exportSource, /JPEG_QUALITY\s*=\s*0\.92/);
  assert.match(exportSource, /fillStyle\s*=\s*["']#ffffff["']/i);
  assert.match(exportSource, /fillRect\(0,\s*0,\s*width,\s*height\)/);
});

test("SVG export defaults to transparent output", () => {
  assert.match(exportSource, /downloadSvg[\s\S]*background:\s*"transparent"/);
  assert.match(exportSource, /serializeSvg[\s\S]*background:\s*options\.background\s*\?\?\s*"transparent"/);
});

test("export removes validation UI from cloned SVG", () => {
  assert.match(diagramNodeSource, /className="diagram-validation-halo node-validation-halo"/);
  assert.match(diagramEdgeSource, /className="diagram-validation-halo edge-validation-halo"/);
  assert.match(exportSource, /function removeExportOnlyUi/);
  assert.match(exportSource, /\.diagram-validation-badge/);
  assert.match(exportSource, /\.diagram-validation-halo/);
  assert.match(exportSource, /\.diagram-edge-hit-target/);
  assert.match(exportSource, /removeExportOnlyUi\(clone\)/);
});

test("JPEG print mode forces monochrome transparent fills", () => {
  assert.match(exportSource, /styleMode\s*=\s*options\.styleMode\s*\?\?\s*\(format\s*===\s*"jpeg"\s*\?\s*"print"\s*:\s*"normal"\)/);
  assert.match(exportSource, /function applyPrintExportStyle/);
  assert.match(exportSource, /--diagram-node-fill",\s*"transparent"/);
  assert.match(exportSource, /--diagram-stroke",\s*"#000000"/);
  assert.match(exportSource, /--diagram-text",\s*"#000000"/);
  assert.match(exportSource, /--diagram-selection-fill",\s*"transparent"/);
  assert.match(exportSource, /--diagram-warning-fill",\s*"transparent"/);
  assert.match(exportSource, /--diagram-error-fill",\s*"transparent"/);
  assert.match(exportSource, /function normalizePrintExportElements/);
  assert.match(diagramEdgeSource, /className="diagram-edge-hit-target"/);
  assert.match(exportSource, /function isTransparentPaint/);
  assert.match(exportSource, /setProperty\("stroke",\s*"none"\)/);
  assert.match(exportSource, /setProperty\("fill",\s*"none"\)/);
  assert.match(exportSource, /setAttribute\("stroke",\s*"#000000"\)/);
  assert.match(exportSource, /querySelectorAll<SVGTextElement>\("text"\)/);
});

test("simple attribute identifiers expose a print-preservable marker class", () => {
  assert.match(diagramNodeSource, /attribute-identifier-marker/);
  assert.match(diagramNodeSource, /isIdentifier\s*\?\s*"attribute-marker attribute-identifier-marker"\s*:\s*"attribute-marker"/);
});

test("JPEG print mode preserves semantic identifier marker fills", () => {
  const preserveFillBody = localFunctionBody("shouldPreservePrintFill");
  const normalizeBody = localFunctionBody("normalizePrintExportElements");

  assert.match(exportSource, /function shouldPreservePrintFill/);
  assert.match(preserveFillBody, /classList\.contains\("attribute-identifier-marker"\)/);
  assert.match(preserveFillBody, /classList\.contains\("external-identifier-marker"\)/);
  assert.match(preserveFillBody, /classList\.contains\("external-identifier-terminal-marker"\)/);
  assert.match(normalizeBody, /const preserveFill = shouldPreservePrintFill\(element\)/);
  assert.match(normalizeBody, /if \(preserveFill\)/);
  assert.match(normalizeBody, /setProperty\("fill",\s*"#000000"\)/);
  assert.match(normalizeBody, /setAttribute\("fill",\s*"#000000"\)/);
  assert.match(normalizeBody, /else\s*\{\s*element\.style\.setProperty\("fill",\s*"none"\)/);
  assert.match(normalizeBody, /element\.setAttribute\("fill",\s*"none"\)/);
});

test("external identifier marker classes remain available for print fill preservation", () => {
  assert.match(diagramCanvasSource, /className="external-identifier-terminal-marker"/);
  assert.match(diagramCanvasSource, /className=\{`external-identifier-marker external-identifier-marker-\$\{layout\.kind\}`\}/);
});

test("PNG and SVG do not request print style by default", () => {
  const downloadPngBody = functionBody("downloadPng");
  const downloadSvgStart = exportSource.indexOf("export function downloadSvg");
  assert.notEqual(downloadSvgStart, -1, "downloadSvg should exist");
  const downloadSvgEnd = exportSource.indexOf("async function rasterizeSvg", downloadSvgStart);
  const downloadSvgBody = exportSource.slice(downloadSvgStart, downloadSvgEnd);

  assert.doesNotMatch(downloadPngBody, /styleMode:\s*"print"/);
  assert.doesNotMatch(downloadSvgBody, /styleMode:\s*"print"/);
});

test("standalone style export covers logical diagram variables", () => {
  assert.match(exportSource, /--diagram-text/);
  assert.match(exportSource, /--diagram-selection-stroke/);
  assert.match(exportSource, /--diagram-drag-fill/);
  assert.match(exportSource, /--logical-edge-stroke/);
  assert.match(exportSource, /--logical-table-fill/);
  assert.match(exportSource, /--logical-table-header-fill/);
});
