import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const exportSource = readFileSync(new URL("../src/utils/export.ts", import.meta.url), "utf8");

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
  assert.match(exportSource, /image\/jpeg/);
  assert.match(exportSource, /JPEG_QUALITY\s*=\s*0\.92/);
  assert.match(exportSource, /fillStyle\s*=\s*["']#ffffff["']/i);
  assert.match(exportSource, /fillRect\(0,\s*0,\s*width,\s*height\)/);
});

test("SVG export defaults to transparent output", () => {
  assert.match(exportSource, /downloadSvg[\s\S]*background:\s*"transparent"/);
  assert.match(exportSource, /serializeSvg[\s\S]*background:\s*options\.background\s*\?\?\s*"transparent"/);
});

test("standalone style export covers logical diagram variables", () => {
  assert.match(exportSource, /--diagram-text/);
  assert.match(exportSource, /--diagram-selection-stroke/);
  assert.match(exportSource, /--diagram-drag-fill/);
  assert.match(exportSource, /--logical-edge-stroke/);
  assert.match(exportSource, /--logical-table-fill/);
  assert.match(exportSource, /--logical-table-header-fill/);
});
