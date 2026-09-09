import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page } from "@playwright/test";
import { ensureDrawerClosed, seedProjectWithSchema } from "./utils/erSchemaProject";

const REFERENCE_SCHEMA = `entity STUDENTE {
    identifier(idStudente),
    NomeStudente,
    DataNascitaStudente,
    attribute Recapito card "0..N"
}

entity UNIVERSITA {
    identifier(IdUniversita),
    NomeUniversita,
    IndirizzoUniversita
}

relationship ISCRIZIONE (
    STUDENTE: zero..one,
    UNIVERSITA: zero..many
)`;

async function seedReferenceDiagram(page: Page): Promise<void> {
  await seedProjectWithSchema(page, { width: 1440, height: 900 });
  await ensureDrawerClosed(page);

  const codeButton = page.locator(".project-activity-rail").getByRole("button", { name: "Code", exact: true });
  await codeButton.click();
  await page.getByRole("textbox", { name: /Editor/i }).fill(REFERENCE_SCHEMA);
  await expect(page.locator(".diagram-node")).toHaveCount(10);
  await codeButton.click();
  await page.getByRole("button", { name: "Fit the whole diagram" }).click();
}

async function exportRaster(page: Page, format: "PNG" | "JPEG"): Promise<Download> {
  await page
    .getByRole("navigation", { name: "ER toolbar" })
    .getByRole("button", { name: "Export", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menu", { name: "Export ER" }).getByRole("menuitem", { name: format, exact: true }).click();
  return downloadPromise;
}

async function downloadDataUrl(download: Download, mimeType: string): Promise<string> {
  const path = await download.path();
  if (!path) throw new Error(`${download.suggestedFilename()} non ha prodotto un file locale`);
  const bytes = await readFile(path);
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

test("PNG shape interiors are transparent and JPEG renders the same diagram on white", async ({ page }) => {
  test.slow();
  await seedReferenceDiagram(page);

  const rasterSamples = await page.evaluate(() => {
    const world = document.querySelector<SVGGElement>('[data-export-world="true"]');
    const shape = world?.querySelector<SVGGraphicsElement>(".diagram-node rect");
    const background = world?.querySelector<SVGGraphicsElement>('[data-export-background="true"]');
    if (!world || !shape) throw new Error("Geometria export non disponibile");
    const previousTransform = world.getAttribute("transform");
    const previousDisplay = background?.style.display;
    world.removeAttribute("transform");
    if (background) background.style.display = "none";
    const worldBounds = world.getBBox();
    const shapeBounds = shape.getBBox();
    const collectCardinalitySample = (selector: string) => {
      const edge = world.querySelector<SVGGElement>(`.diagram-edge:has(${selector})`);
      const label = edge?.querySelector<SVGTextElement>(selector);
      const chipElement = label?.previousElementSibling;
      const path = Array.from(edge?.querySelectorAll<SVGPathElement>("path") ?? []).find(
        (candidate) => candidate.getAttribute("stroke") !== "transparent",
      );
      if (!(chipElement instanceof SVGRectElement) || !path) {
        throw new Error(`Cardinalita export non disponibile: ${selector}`);
      }

      const chip = {
        x: Number(chipElement.getAttribute("x")),
        y: Number(chipElement.getAttribute("y")),
        width: Number(chipElement.getAttribute("width")),
        height: Number(chipElement.getAttribute("height")),
      };
      const lineGapPoints: Array<{ x: number; y: number }> = [];
      const pathLength = path.getTotalLength();
      for (let index = 0; index <= 2_000; index += 1) {
        const point = path.getPointAtLength((pathLength * index) / 2_000);
        const insideCutout =
          point.x >= chip.x + 3 &&
          point.x <= chip.x + chip.width - 3 &&
          point.y >= chip.y + 3 &&
          point.y <= chip.y + chip.height - 3;
        if (insideCutout) lineGapPoints.push(point);
      }

      return { chipElement, lineGapPoints };
    };
    const connectorSample = collectCardinalitySample(".connector-label");
    const attributeSample = collectCardinalitySample(".attribute-cardinality-label");
    if (previousTransform === null) world.removeAttribute("transform");
    else world.setAttribute("transform", previousTransform);
    if (background) background.style.display = previousDisplay ?? "";
    const toRasterPoint = (point: { x: number; y: number }) => ({
      x: Math.round((point.x - (worldBounds.x - 20)) * 2),
      y: Math.round((point.y - (worldBounds.y - 20)) * 2),
    });
    const toUniqueRasterPoints = (points: Array<{ x: number; y: number }>) =>
      points
        .map(toRasterPoint)
        .filter((point, index, source) => source.findIndex((other) => other.x === point.x && other.y === point.y) === index);
    return {
      shapeInterior: toRasterPoint({ x: shapeBounds.x + 12, y: shapeBounds.y + 12 }),
      connectorLineGap: toUniqueRasterPoints(connectorSample.lineGapPoints),
      attributeLineGap: toUniqueRasterPoints(attributeSample.lineGapPoints),
      attributeChip: {
        fill: attributeSample.chipElement.getAttribute("fill"),
        stroke: attributeSample.chipElement.getAttribute("stroke"),
        strokeWidth: attributeSample.chipElement.getAttribute("stroke-width"),
      },
    };
  });

  const pngDownload = await exportRaster(page, "PNG");
  const transformBeforeViewportChange = await page.locator('[data-export-world="true"]').getAttribute("transform");
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Pan the viewport" }).click();
  const canvasBounds = await page.locator(".diagram-canvas").boundingBox();
  if (!canvasBounds) throw new Error("Canvas ER non disponibile");
  await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.62, canvasBounds.y + canvasBounds.height * 0.72);
  await page.mouse.down();
  await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.62 + 72, canvasBounds.y + canvasBounds.height * 0.72 + 38);
  await page.mouse.up();
  await expect
    .poll(() => page.locator('[data-export-world="true"]').getAttribute("transform"))
    .not.toBe(transformBeforeViewportChange);
  const jpegDownload = await exportRaster(page, "JPEG");
  const pngUrl = await downloadDataUrl(pngDownload, "image/png");
  const jpegUrl = await downloadDataUrl(jpegDownload, "image/jpeg");

  const comparison = await page.evaluate(async ({ pngUrl: pngSource, jpegUrl: jpegSource, rasterSamples: samples }) => {
    async function decode(url: string) {
      const bitmap = await createImageBitmap(await (await fetch(url)).blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas 2D non disponibile");
      context.drawImage(bitmap, 0, 0);
      return {
        width: bitmap.width,
        height: bitmap.height,
        pixels: context.getImageData(0, 0, bitmap.width, bitmap.height).data,
      };
    }

    function contentBounds(
      pixels: Uint8ClampedArray,
      width: number,
      height: number,
      isContent: (red: number, green: number, blue: number, alpha: number) => boolean,
    ) {
      let left = width;
      let top = height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const offset = (y * width + x) * 4;
          if (!isContent(pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3])) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
      return { left, top, right, bottom };
    }

    const png = await decode(pngSource);
    const jpeg = await decode(jpegSource);
    const pngCorner = Array.from(png.pixels.slice(0, 4));
    const jpegCorner = Array.from(jpeg.pixels.slice(0, 4));
    const shapeOffset = (samples.shapeInterior.y * png.width + samples.shapeInterior.x) * 4;
    const pngShapeInterior = Array.from(png.pixels.slice(shapeOffset, shapeOffset + 4));
    const jpegShapeInterior = Array.from(jpeg.pixels.slice(shapeOffset, shapeOffset + 4));
    const pngLineGap = (points: Array<{ x: number; y: number }>) => points.map((point) => {
      const offset = (point.y * png.width + point.x) * 4;
      return png.pixels[offset + 3];
    });
    const jpegLineGap = (points: Array<{ x: number; y: number }>) => points.map((point) => {
      const offset = (point.y * jpeg.width + point.x) * 4;
      return Math.min(jpeg.pixels[offset], jpeg.pixels[offset + 1], jpeg.pixels[offset + 2]);
    });
    const pngBounds = contentBounds(png.pixels, png.width, png.height, (_r, _g, _b, alpha) => alpha > 0);
    const jpegBounds = contentBounds(
      jpeg.pixels,
      jpeg.width,
      jpeg.height,
      (red, green, blue) => Math.min(red, green, blue) < 245,
    );

    let absoluteDifference = 0;
    const comparablePixels = Math.min(png.width * png.height, jpeg.width * jpeg.height);
    for (let index = 0; index < comparablePixels; index += 1) {
      const offset = index * 4;
      const alpha = png.pixels[offset + 3] / 255;
      for (let channel = 0; channel < 3; channel += 1) {
        const pngOnWhite = Math.round(png.pixels[offset + channel] * alpha + 255 * (1 - alpha));
        absoluteDifference += Math.abs(pngOnWhite - jpeg.pixels[offset + channel]);
      }
    }

    return {
      png: {
        width: png.width,
        height: png.height,
        corner: pngCorner,
        shapeInterior: pngShapeInterior,
        connectorLineGap: pngLineGap(samples.connectorLineGap),
        attributeLineGap: pngLineGap(samples.attributeLineGap),
        bounds: pngBounds,
      },
      jpeg: {
        width: jpeg.width,
        height: jpeg.height,
        corner: jpegCorner,
        shapeInterior: jpegShapeInterior,
        connectorLineGap: jpegLineGap(samples.connectorLineGap),
        attributeLineGap: jpegLineGap(samples.attributeLineGap),
        bounds: jpegBounds,
      },
      meanAbsoluteDifference: absoluteDifference / Math.max(1, comparablePixels * 3),
    };
  }, { pngUrl, jpegUrl, rasterSamples });

  expect(comparison.png.corner[3], "il pixel esterno PNG deve avere alpha zero").toBe(0);
  expect(comparison.jpeg.corner.slice(0, 3).every((channel) => channel >= 250), "il pixel esterno JPEG deve essere bianco").toBe(true);
  expect(comparison.png.shapeInterior[3], "l'interno di uno shape PNG deve essere trasparente").toBe(0);
  expect(
    comparison.jpeg.shapeInterior.slice(0, 3).every((channel) => channel >= 245),
    "l'interno di uno shape JPEG deve essere bianco",
  ).toBe(true);
  expect(rasterSamples.attributeChip).toEqual({
    fill: "var(--diagram-canvas-fill)",
    stroke: "none",
    strokeWidth: "0",
  });
  for (const kind of ["connectorLineGap", "attributeLineGap"] as const) {
    expect(comparison.png[kind].length).toBeGreaterThan(4);
    expect(
      comparison.png[kind].filter((alpha) => alpha <= 5).length / comparison.png[kind].length,
      `la linea non deve attraversare ${kind} nel PNG`,
    ).toBeGreaterThan(0.5);
    expect(
      comparison.jpeg[kind].filter((channel) => channel >= 245).length / comparison.jpeg[kind].length,
      `la linea non deve attraversare ${kind} nel JPEG`,
    ).toBeGreaterThan(0.5);
  }
  expect(comparison.jpeg.width).toBe(comparison.png.width);
  expect(comparison.jpeg.height).toBe(comparison.png.height);
  expect(comparison.png.width).toBeLessThan(4_000);
  expect(comparison.png.height).toBeLessThan(4_000);

  for (const side of ["left", "top", "right", "bottom"] as const) {
    expect(
      Math.abs(comparison.png.bounds[side] - comparison.jpeg.bounds[side]),
      `bounds PNG/JPEG diversi sul lato ${side}`,
    ).toBeLessThanOrEqual(2);
  }
  expect(comparison.meanAbsoluteDifference, "PNG compositato sul bianco e JPEG divergono visivamente").toBeLessThan(4);
});
