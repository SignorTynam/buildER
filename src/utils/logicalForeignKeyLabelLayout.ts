import type { Bounds, Point } from "../types/diagram";
import { boundsIntersect } from "./edgeLabelLayout";

export interface LogicalFkLabelReservedBox extends Bounds {
  id: string;
  kind: "table" | "label" | "route" | "shape";
}

export interface LogicalFkLabelLines {
  fullLabel: string;
  lines: string[];
  displayLabel: string;
  truncated: boolean;
}

export interface LogicalFkLabelPlacement {
  point: Point;
  bounds: Bounds;
  width: number;
  height: number;
  lines: string[];
  fullLabel: string;
  truncated: boolean;
}

export interface ChooseLogicalFkLabelPlacementOptions {
  edgeId: string;
  routePoints: Point[];
  defaultPoint: Point;
  fullLabel: string;
  reservedBoxes: LogicalFkLabelReservedBox[];
  alreadyPlacedBoxes: LogicalFkLabelReservedBox[];
  maxWidth?: number;
  maxLines?: number;
}

const DEFAULT_MAX_CHARS_PER_LINE = 28;
const DEFAULT_MAX_LINES = 2;
const DEFAULT_MAX_WIDTH = 240;
const MIN_WIDTH = 88;
const HORIZONTAL_PADDING = 9;
const BADGE_WIDTH = 28;
const BADGE_GAP = 8;
const BADGE_HEIGHT = 18;
const MIN_HEIGHT = 26;
const LINE_HEIGHT = 13;
const VERTICAL_PADDING = 6;
const TEXT_CHAR_WIDTH = 7.8;
const CANDIDATE_PROGRESSES = [0.5, 0.42, 0.58, 0.34, 0.66, 0.25, 0.75, 0.18, 0.82, 0.1, 0.9];
const CANDIDATE_OFFSETS = [0, -18, 18, -34, 34, -52, 52, -74, 74, -96, 96, -124, 124, -156, 156, -192, 192];
const RADIAL_CANDIDATE_RADII = [42, 68, 96, 128, 164, 208];
const RADIAL_CANDIDATE_DIRECTIONS: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0.7071, y: -0.7071 },
  { x: 0.7071, y: 0.7071 },
  { x: -0.7071, y: 0.7071 },
  { x: -0.7071, y: -0.7071 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(left: Point, right: Point): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function distanceSquared(left: Point, right: Point): number {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  return dx * dx + dy * dy;
}

function normalizeVector(vector: Point, fallback: Point): Point {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0.001) {
    return fallback;
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function ellipsize(value: string, maxLength: number): { value: string; truncated: boolean } {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return { value: normalized, truncated: false };
  }

  if (maxLength <= 1) {
    return { value: "…", truncated: true };
  }

  return { value: `${normalized.slice(0, maxLength - 1).trimEnd()}…`, truncated: true };
}

function tokenizeLogicalFkLabel(label: string): string[] {
  return label
    .replace(/->/g, " → ")
    .replace(/→/g, " → ")
    .replace(/,/g, ", ")
    .replace(/\(/g, " (")
    .replace(/\)/g, ") ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function splitOversizedLogicalFkToken(token: string, maxCharsPerLine: number): string[] {
  if (token.length <= maxCharsPerLine) {
    return [token];
  }

  const pieces: string[] = [];
  let currentPiece = "";
  Array.from(token).forEach((character) => {
    currentPiece += character;
    if ((character === "_" || character === ".") && currentPiece.length > 1) {
      pieces.push(currentPiece);
      currentPiece = "";
    }
  });
  if (currentPiece) {
    pieces.push(currentPiece);
  }

  const chunks: string[] = [];
  let currentChunk = "";
  pieces.forEach((piece) => {
    if (piece.length > maxCharsPerLine) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }
      for (let index = 0; index < piece.length; index += maxCharsPerLine) {
        chunks.push(piece.slice(index, index + maxCharsPerLine));
      }
      return;
    }

    const nextChunk = `${currentChunk}${piece}`;
    if (nextChunk.length <= maxCharsPerLine || currentChunk.length === 0) {
      currentChunk = nextChunk;
      return;
    }

    chunks.push(currentChunk);
    currentChunk = piece;
  });

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [token];
}

export function wrapLogicalForeignKeyLabel(
  fullLabel: string,
  options: {
    maxCharsPerLine?: number;
    maxLines?: number;
  } = {},
): LogicalFkLabelLines {
  const normalizedFullLabel = fullLabel.trim();
  const maxCharsPerLine = Math.max(8, options.maxCharsPerLine ?? DEFAULT_MAX_CHARS_PER_LINE);
  const maxLines = Math.max(1, options.maxLines ?? DEFAULT_MAX_LINES);
  const displaySource = normalizedFullLabel.replace(/->/g, "→");
  const tokens = tokenizeLogicalFkLabel(displaySource).flatMap((token) =>
    splitOversizedLogicalFkToken(token, maxCharsPerLine),
  );
  const lines: string[] = [];
  let currentLine = "";
  let truncated = false;

  tokens.forEach((token) => {
    const nextLine = currentLine ? `${currentLine} ${token}` : token;
    if (nextLine.length <= maxCharsPerLine || currentLine.length === 0) {
      currentLine = nextLine;
      return;
    }

    lines.push(currentLine);
    currentLine = token;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  const normalizedLines = lines.length > 0 ? lines : [displaySource];
  if (normalizedLines.length <= maxLines) {
    const fittedLines = normalizedLines.map((line, index) => {
      const isLastLine = index === normalizedLines.length - 1;
      const fitted = isLastLine ? ellipsize(line, maxCharsPerLine) : { value: line, truncated: false };
      truncated = truncated || fitted.truncated;
      return fitted.value;
    });

    return {
      fullLabel: normalizedFullLabel,
      lines: fittedLines,
      displayLabel: fittedLines.join(" "),
      truncated,
    };
  }

  const keptLines = normalizedLines.slice(0, maxLines - 1);
  const overflowLine = normalizedLines.slice(maxLines - 1).join(" ");
  const fittedOverflow = ellipsize(overflowLine, maxCharsPerLine);
  truncated = true;

  return {
    fullLabel: normalizedFullLabel,
    lines: [...keptLines, fittedOverflow.value],
    displayLabel: [...keptLines, fittedOverflow.value].join(" "),
    truncated: truncated || fittedOverflow.truncated,
  };
}

function estimateLogicalFkLabelTextWidth(line: string): number {
  return line.length * TEXT_CHAR_WIDTH;
}

function getLogicalFkLabelSize(lines: string[], maxWidth = DEFAULT_MAX_WIDTH): { width: number; height: number } {
  const textWidth = Math.max(0, ...lines.map(estimateLogicalFkLabelTextWidth));
  const width = clamp(
    HORIZONTAL_PADDING * 2 + BADGE_WIDTH + BADGE_GAP + textWidth,
    MIN_WIDTH,
    maxWidth,
  );
  const height = Math.max(
    MIN_HEIGHT,
    VERTICAL_PADDING * 2 + Math.max(BADGE_HEIGHT, lines.length * LINE_HEIGHT),
  );

  return { width: Math.ceil(width), height: Math.ceil(height) };
}

function buildLogicalFkLabelBounds(point: Point, width: number, height: number): Bounds {
  return {
    x: point.x - width / 2,
    y: point.y - height / 2,
    width,
    height,
  };
}

function getPointAlongPolyline(points: Point[], progress: number): Point {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  if (points.length === 1) {
    return points[0];
  }

  const segmentLengths = points.slice(1).map((point, index) => distance(points[index], point));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (totalLength <= 0.001) {
    return points[0];
  }

  const targetLength = totalLength * clamp(progress, 0, 1);
  let travelled = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = Math.max(segmentLengths[index - 1], 0.001);
    if (travelled + segmentLength >= targetLength) {
      const segmentProgress = (targetLength - travelled) / segmentLength;
      return {
        x: start.x + (end.x - start.x) * segmentProgress,
        y: start.y + (end.y - start.y) * segmentProgress,
      };
    }

    travelled += segmentLength;
  }

  return points[points.length - 1];
}

function getNearestSegmentInfo(points: Point[], point: Point): { distance: number; normal: Point; progress: number } {
  if (points.length < 2) {
    return {
      distance: 0,
      normal: { x: 0, y: -1 },
      progress: 0.5,
    };
  }

  let totalLength = 0;
  const segmentLengths = points.slice(1).map((end, index) => {
    const segmentLength = distance(points[index], end);
    totalLength += segmentLength;
    return segmentLength;
  });
  let travelled = 0;
  let best = {
    distance: Number.POSITIVE_INFINITY,
    normal: { x: 0, y: -1 },
    progress: 0.5,
  };

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = Math.max(segmentLengths[index - 1], 0.001);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (segmentLength * segmentLength), 0, 1);
    const projection = {
      x: start.x + dx * t,
      y: start.y + dy * t,
    };
    const candidateDistance = distance(point, projection);
    if (candidateDistance < best.distance) {
      let normal = normalizeVector({ x: -dy, y: dx }, { x: 0, y: -1 });
      if (Math.abs(dx) >= Math.abs(dy) && normal.y > 0) {
        normal = { x: -normal.x, y: -normal.y };
      }
      if (Math.abs(dy) > Math.abs(dx) && normal.x < 0) {
        normal = { x: -normal.x, y: -normal.y };
      }

      best = {
        distance: candidateDistance,
        normal,
        progress: totalLength <= 0.001 ? 0.5 : (travelled + segmentLength * t) / totalLength,
      };
    }

    travelled += segmentLength;
  }

  return best;
}

function buildCandidatePoints(routePoints: Point[], defaultPoint: Point): Point[] {
  const candidates: Point[] = [defaultPoint];

  CANDIDATE_PROGRESSES.forEach((progress) => {
    const basePoint = getPointAlongPolyline(routePoints, progress);
    const segmentInfo = getNearestSegmentInfo(routePoints, basePoint);
    CANDIDATE_OFFSETS.forEach((offset) => {
      candidates.push({
        x: basePoint.x + segmentInfo.normal.x * offset,
        y: basePoint.y + segmentInfo.normal.y * offset,
      });
    });
  });

  RADIAL_CANDIDATE_RADII.forEach((radius) => {
    RADIAL_CANDIDATE_DIRECTIONS.forEach((direction) => {
      candidates.push({
        x: defaultPoint.x + direction.x * radius,
        y: defaultPoint.y + direction.y * radius,
      });
    });
  });

  return candidates.filter(
    (candidate, index, source) =>
      Number.isFinite(candidate.x) &&
      Number.isFinite(candidate.y) &&
      source.findIndex((other) => distanceSquared(candidate, other) <= 1) === index,
  );
}

function getOverlapArea(left: Bounds, right: Bounds): number {
  const overlapWidth = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const overlapHeight = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  return overlapWidth * overlapHeight;
}

export function chooseLogicalForeignKeyLabelPlacement(
  options: ChooseLogicalFkLabelPlacementOptions,
): LogicalFkLabelPlacement {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxCharsPerLine = Math.max(
    14,
    Math.min(
      DEFAULT_MAX_CHARS_PER_LINE,
      Math.floor((maxWidth - HORIZONTAL_PADDING * 2 - BADGE_WIDTH - BADGE_GAP) / TEXT_CHAR_WIDTH),
    ),
  );
  const labelLines = wrapLogicalForeignKeyLabel(options.fullLabel, {
    maxCharsPerLine,
    maxLines: options.maxLines ?? DEFAULT_MAX_LINES,
  });
  const { width, height } = getLogicalFkLabelSize(labelLines.lines, maxWidth);
  const candidates = buildCandidatePoints(options.routePoints, options.defaultPoint);
  let best: LogicalFkLabelPlacement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    const bounds = buildLogicalFkLabelBounds(candidate, width, height);
    const tableCollisions = options.reservedBoxes.filter((box) => boundsIntersect(bounds, box));
    const labelCollisions = options.alreadyPlacedBoxes.filter((box) => boundsIntersect(bounds, box));
    const overlapArea =
      tableCollisions.reduce((sum, box) => sum + getOverlapArea(bounds, box), 0) +
      labelCollisions.reduce((sum, box) => sum + getOverlapArea(bounds, box), 0);
    const segmentInfo = getNearestSegmentInfo(options.routePoints, candidate);
    const tableCollisionCount = tableCollisions.filter((box) => box.kind === "table" || box.kind === "shape").length;
    const labelCollisionCount = labelCollisions.length;
    const score =
      tableCollisionCount * 180000 +
      labelCollisionCount * 90000 +
      overlapArea * 180 +
      distance(candidate, options.defaultPoint) * 1.4 +
      segmentInfo.distance * 2;

    if (score < bestScore) {
      bestScore = score;
      best = {
        point: candidate,
        bounds,
        width,
        height,
        lines: labelLines.lines,
        fullLabel: labelLines.fullLabel,
        truncated: labelLines.truncated,
      };
    }
  });

  return (
    best ?? {
      point: options.defaultPoint,
      bounds: buildLogicalFkLabelBounds(options.defaultPoint, width, height),
      width,
      height,
      lines: labelLines.lines,
      fullLabel: labelLines.fullLabel,
      truncated: labelLines.truncated,
    }
  );
}
