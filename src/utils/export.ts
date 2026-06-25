type ExportFormat = "svg" | "png" | "jpeg";
type ExportBackground = "transparent" | "white";
type ExportStyleMode = "normal" | "print";

interface SvgExportOptions {
  format?: ExportFormat;
  background?: ExportBackground;
  styleMode?: ExportStyleMode;
  scale?: number;
  padding?: number;
}

interface PreparedSvgExport {
  markup: string;
  width: number;
  height: number;
}

const DEFAULT_EXPORT_PADDING = 20;
const DEFAULT_RASTER_SCALE = 2;
const JPEG_QUALITY = 0.92;

const SVG_EXPORT_CUSTOM_PROPERTIES = [
  "--diagram-canvas-fill",
  "--diagram-node-fill",
  "--diagram-stroke",
  "--diagram-text",
  "--diagram-focus",
  "--diagram-pending",
  "--diagram-drag",
  "--diagram-drag-fill",
  "--diagram-warning",
  "--diagram-warning-fill",
  "--diagram-error",
  "--diagram-error-fill",
  "--diagram-selection-stroke",
  "--diagram-selection-fill",
  "--diagram-translation-pending",
  "--diagram-translation-blocked",
  "--logical-edge-stroke",
  "--logical-table-stroke",
  "--logical-table-fill",
  "--logical-table-header-fill",
  "--logical-table-stroke-width",
] as const;

const SVG_EXPORT_STYLE_PROPERTIES = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "paint-order",
  "vector-effect",
  "marker-start",
  "marker-mid",
  "marker-end",
] as const;

function downloadBlob(blob: Blob, fileName: string) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function applyResolvedCustomProperties(source: SVGSVGElement, target: SVGSVGElement) {
  const sourceStyles = window.getComputedStyle(source);
  const rootStyles = window.getComputedStyle(document.documentElement);

  SVG_EXPORT_CUSTOM_PROPERTIES.forEach((propertyName) => {
    const value = sourceStyles.getPropertyValue(propertyName).trim() || rootStyles.getPropertyValue(propertyName).trim();
    if (value) {
      target.style.setProperty(propertyName, value);
    }
  });
}

function resolveFontFamily(svgElement: SVGSVGElement): string {
  const svgFont = window.getComputedStyle(svgElement).fontFamily.trim();
  const documentFont = window.getComputedStyle(document.documentElement).fontFamily.trim();
  return svgFont || documentFont || "system-ui, sans-serif";
}

function getElementPairs(source: SVGSVGElement, clone: SVGSVGElement): Array<[SVGElement, SVGElement]> {
  const sourceElements = [source, ...Array.from(source.querySelectorAll("*"))].filter(
    (element): element is SVGElement => element instanceof SVGElement,
  );
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll("*"))].filter(
    (element): element is SVGElement => element instanceof SVGElement,
  );
  const pairCount = Math.min(sourceElements.length, cloneElements.length);
  const pairs: Array<[SVGElement, SVGElement]> = [];

  for (let index = 0; index < pairCount; index += 1) {
    pairs.push([sourceElements[index], cloneElements[index]]);
  }

  return pairs;
}

function copyComputedSvgStyles(source: SVGSVGElement, clone: SVGSVGElement, fontFamily: string) {
  getElementPairs(source, clone).forEach(([sourceElement, cloneElement]) => {
    const computedStyle = window.getComputedStyle(sourceElement);

    SVG_EXPORT_STYLE_PROPERTIES.forEach((propertyName) => {
      const attributeName = propertyName === "marker-start"
        ? "marker-start"
        : propertyName === "marker-mid"
          ? "marker-mid"
          : propertyName === "marker-end"
            ? "marker-end"
            : null;
      const isMarkerProperty = attributeName !== null;
      const value = attributeName
        ? sourceElement.getAttribute(attributeName) || computedStyle.getPropertyValue(propertyName)
        : computedStyle.getPropertyValue(propertyName);
      const normalizedValue = value.trim();

      if (normalizedValue && normalizedValue !== "normal" && (!isMarkerProperty || normalizedValue !== "none")) {
        cloneElement.style.setProperty(propertyName, normalizedValue);
      }
    });
  });

  clone.style.fontFamily = fontFamily;
}

function appendStandaloneFontStyle(clone: SVGSVGElement, fontFamily: string) {
  const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleElement.textContent = `svg, text { font-family: ${fontFamily}; }`;

  const firstChild = clone.firstChild;
  if (firstChild) {
    clone.insertBefore(styleElement, firstChild);
  } else {
    clone.appendChild(styleElement);
  }
}

function getExportWorldGroup(svgElement: SVGSVGElement): SVGGElement | null {
  const explicitGroup = svgElement.querySelector("[data-export-world=\"true\"]");
  if (explicitGroup instanceof SVGGElement) {
    return explicitGroup;
  }

  return Array.from(svgElement.children).find(
    (child): child is SVGGElement => child instanceof SVGGElement && child.hasAttribute("transform"),
  ) ?? null;
}

function withoutExportBackgrounds<T>(svgElement: SVGSVGElement, callback: () => T): T {
  const backgrounds = Array.from(svgElement.querySelectorAll<SVGElement>("[data-export-background=\"true\"]"));
  const previousDisplays = backgrounds.map((background) => background.style.display);

  backgrounds.forEach((background) => {
    background.style.display = "none";
  });

  try {
    return callback();
  } finally {
    backgrounds.forEach((background, index) => {
      background.style.display = previousDisplays[index];
    });
  }
}

function getSvgFallbackBounds(svgElement: SVGSVGElement): DOMRect {
  const viewBox = svgElement.viewBox.baseVal;
  if (viewBox.width > 0 && viewBox.height > 0) {
    return new DOMRect(viewBox.x, viewBox.y, viewBox.width, viewBox.height);
  }

  const rect = svgElement.getBoundingClientRect();
  return new DOMRect(0, 0, Math.max(1, rect.width), Math.max(1, rect.height));
}

function getContentBounds(svgElement: SVGSVGElement): DOMRect {
  const worldGroup = getExportWorldGroup(svgElement);

  if (!worldGroup) {
    return getSvgFallbackBounds(svgElement);
  }

  return withoutExportBackgrounds(svgElement, () => {
    try {
      const bounds = worldGroup.getBBox();
      if (bounds.width > 0 && bounds.height > 0) {
        return new DOMRect(bounds.x, bounds.y, bounds.width, bounds.height);
      }
    } catch {
      // Fall back below when the browser cannot calculate a group bbox.
    }

    return getSvgFallbackBounds(svgElement);
  });
}

function removeExportBackgrounds(clone: SVGSVGElement) {
  clone.querySelectorAll("[data-export-background=\"true\"]").forEach((element) => element.remove());
}

function removeExportOnlyUi(clone: SVGSVGElement) {
  clone
    .querySelectorAll(
      [
        ".diagram-validation-badge",
        ".diagram-validation-halo",
        ".diagram-edge-hit-target",
      ].join(","),
    )
    .forEach((element) => element.remove());
}

function isTransparentPaint(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized === "transparent" ||
    normalized === "rgba(0, 0, 0, 0)" ||
    normalized === "rgba(0,0,0,0)" ||
    normalized.endsWith(", 0)") ||
    normalized.endsWith(",0)")
  );
}

function applyPrintExportStyle(clone: SVGSVGElement) {
  clone.style.setProperty("--diagram-canvas-fill", "#ffffff");
  clone.style.setProperty("--diagram-node-fill", "transparent");
  clone.style.setProperty("--diagram-stroke", "#000000");
  clone.style.setProperty("--diagram-text", "#000000");
  clone.style.setProperty("--diagram-focus", "#000000");
  clone.style.setProperty("--diagram-pending", "#000000");
  clone.style.setProperty("--diagram-drag", "#000000");
  clone.style.setProperty("--diagram-drag-fill", "transparent");
  clone.style.setProperty("--diagram-warning", "#000000");
  clone.style.setProperty("--diagram-warning-fill", "transparent");
  clone.style.setProperty("--diagram-error", "#000000");
  clone.style.setProperty("--diagram-error-fill", "transparent");
  clone.style.setProperty("--diagram-selection-stroke", "#000000");
  clone.style.setProperty("--diagram-selection-fill", "transparent");
  clone.style.setProperty("--diagram-translation-pending", "#000000");
  clone.style.setProperty("--diagram-translation-blocked", "#000000");
}

function shouldPreservePrintFill(element: SVGElement): boolean {
  return (
    element.classList.contains("attribute-identifier-marker") ||
    element.classList.contains("external-identifier-marker") ||
    element.classList.contains("external-identifier-terminal-marker")
  );
}

function normalizePrintExportElements(clone: SVGSVGElement) {
  clone.querySelectorAll<SVGElement>("rect, polygon, ellipse, circle, path, line, polyline").forEach((element) => {
    const preserveFill = shouldPreservePrintFill(element);

    if (preserveFill) {
      element.style.setProperty("fill", "#000000");
      element.setAttribute("fill", "#000000");
    } else {
      element.style.setProperty("fill", "none");
      element.setAttribute("fill", "none");
    }

    const currentStroke = element.style.getPropertyValue("stroke") || element.getAttribute("stroke");
    if (isTransparentPaint(currentStroke)) {
      element.style.setProperty("stroke", "none");
      element.setAttribute("stroke", "none");
    } else if (currentStroke && currentStroke !== "none") {
      element.style.setProperty("stroke", "#000000");
      element.setAttribute("stroke", "#000000");
    }
  });

  clone.querySelectorAll<SVGTextElement>("text").forEach((text) => {
    text.style.setProperty("fill", "#000000");
    text.setAttribute("fill", "#000000");
    text.style.removeProperty("stroke");
    text.removeAttribute("stroke");
  });
}

function neutralizeWorldTransform(clone: SVGSVGElement) {
  getExportWorldGroup(clone)?.removeAttribute("transform");
}

export function prepareSvgExport(svgElement: SVGSVGElement, options: SvgExportOptions = {}): PreparedSvgExport {
  const format = options.format ?? "svg";
  const background = options.background ?? (format === "jpeg" ? "white" : "transparent");
  const styleMode = options.styleMode ?? (format === "jpeg" ? "print" : "normal");
  const padding = options.padding ?? DEFAULT_EXPORT_PADDING;
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  const fontFamily = resolveFontFamily(svgElement);
  const bounds = getContentBounds(svgElement);
  const viewBoxX = bounds.x - padding;
  const viewBoxY = bounds.y - padding;
  const exportWidth = Math.ceil(bounds.width + padding * 2);
  const exportHeight = Math.ceil(bounds.height + padding * 2);

  applyResolvedCustomProperties(svgElement, clone);
  copyComputedSvgStyles(svgElement, clone, fontFamily);
  removeExportBackgrounds(clone);
  removeExportOnlyUi(clone);
  if (styleMode === "print") {
    applyPrintExportStyle(clone);
    normalizePrintExportElements(clone);
  }
  neutralizeWorldTransform(clone);
  appendStandaloneFontStyle(clone, fontFamily);

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("viewBox", `${viewBoxX} ${viewBoxY} ${exportWidth} ${exportHeight}`);
  clone.setAttribute("width", exportWidth.toString());
  clone.setAttribute("height", exportHeight.toString());
  clone.style.background = background === "white" ? "#ffffff" : "transparent";

  return {
    markup: `<?xml version="1.0" encoding="UTF-8"?>\n${clone.outerHTML}`,
    width: exportWidth,
    height: exportHeight,
  };
}

export function serializeSvg(svgElement: SVGSVGElement, options: SvgExportOptions = {}): string {
  return prepareSvgExport(svgElement, {
    ...options,
    format: options.format ?? "svg",
    background: options.background ?? "transparent",
  }).markup;
}

export function downloadSvg(svgElement: SVGSVGElement, fileName: string) {
  const svgMarkup = serializeSvg(svgElement, { format: "svg", background: "transparent" });
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, fileName);
}

async function rasterizeSvg(
  svgElement: SVGSVGElement,
  fileName: string,
  options: Required<Pick<SvgExportOptions, "format" | "background">> & Pick<SvgExportOptions, "scale" | "styleMode">,
) {
  const scale = options.scale ?? DEFAULT_RASTER_SCALE;
  const { markup, width, height } = prepareSvgExport(svgElement, {
    format: options.format,
    background: options.background,
    styleMode: options.styleMode,
    scale,
  });
  const svgBlob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossibile rasterizzare il canvas SVG."));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D non disponibile.");
    }

    context.scale(scale, scale);

    if (options.background === "white") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(image, 0, 0, width, height);

    const mimeType = options.format === "jpeg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (rasterBlob) => {
          if (!rasterBlob) {
            reject(new Error(options.format === "jpeg" ? "Impossibile generare il JPEG." : "Impossibile generare il PNG."));
            return;
          }

          resolve(rasterBlob);
        },
        mimeType,
        options.format === "jpeg" ? JPEG_QUALITY : undefined,
      );
    });

    downloadBlob(blob, fileName);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPng(svgElement: SVGSVGElement, fileName: string) {
  await rasterizeSvg(svgElement, fileName, { format: "png", background: "transparent" });
}

export async function downloadJpeg(svgElement: SVGSVGElement, fileName: string) {
  await rasterizeSvg(svgElement, fileName, { format: "jpeg", background: "white", styleMode: "print" });
}
