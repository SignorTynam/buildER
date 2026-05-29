import type {
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EdgeKind,
  ExternalIdentifier,
  EntityRelationshipParticipation,
  GeneralizationGroup,
  InternalIdentifier,
  IsaCompleteness,
  IsaDisjointness,
  LineStyle,
  NodeKind,
} from "../types/diagram";
import {
  CONNECTOR_CARDINALITY_PLACEHOLDER,
  getAttributeCardinalityOwner,
  getConnectorParticipation,
  getConnectorParticipationContext,
  isSupportedCardinality,
  normalizeSupportedCardinality,
} from "./cardinality";
import {
  canConnect,
  getMultivaluedAttributeSize,
  cleanupGeneralizationReferences,
  normalizeGeneralizationGroups,
  validateDiagram,
} from "./diagram";
import { GRID_SIZE, snapValue } from "./geometry";

const DEFAULT_NODE_SIZES: Record<NodeKind, { width: number; height: number }> = {
  entity: { width: 140, height: 64 },
  relationship: { width: 130, height: 78 },
  attribute: { width: 150, height: 28 },
};

const NODE_ORDER: NodeKind[] = ["entity", "relationship", "attribute"];
const EDGE_ORDER: EdgeKind[] = ["connector", "attribute", "inheritance"];
const LEGACY_NODE_DIRECTIVES = new Set([
  "label",
  "at",
  "size",
  "card",
  "identifier",
  "compositeInternal",
  "external",
  "sourceAttribute",
  "targetEntity",
  "targetAttribute",
  "offset",
  "markerOffset",
]);

interface RelationshipExternalSpec {
  hostEntityAlias?: string;
  importedAttributeAliases: string[];
  localAttributeAliases: string[];
  offset?: number;
  markerOffsetX?: number;
  markerOffsetY?: number;
}

interface ParsedNodeSpec {
  line: number;
  alias: string;
  node: DiagramNode;
  externalSpec?: RelationshipExternalSpec;
}

interface ParsedEdgeSpec {
  line: number;
  type: EdgeKind;
  sourceAlias: string;
  targetAlias: string;
  label: string;
  lineStyle: LineStyle;
  manualOffset?: number;
  cardinality?: string;
  role?: string;
  isaDisjointness?: IsaDisjointness;
  isaCompleteness?: IsaCompleteness;
  isExternalIdentifierHost?: boolean;
  generalizationGroupAlias?: string;
}

interface ParsedInternalIdentifierSpec {
  line: number;
  entityAlias: string;
  attributeAliases: string[];
}

interface ParsedExternalIdentifierSpec {
  line: number;
  relationshipAlias: string;
  hostEntityAlias: string;
  importedAttributeAliases: string[];
  localAttributeAliases: string[];
  offset?: number;
  markerOffsetX?: number;
  markerOffsetY?: number;
}

interface ParsedDesignerIdentifierSpec {
  line: number;
  entityAlias: string;
  itemAliases: string[];
}

interface ParsedDesignerExternalAttributeSpec {
  line: number;
  entityAlias: string;
  attributeAlias: string;
}

interface ParsedGeneralizationGroupSpec {
  line: number;
  alias: string;
  supertypeAlias: string;
  subtypeAliases: string[];
  isaCompleteness?: IsaCompleteness;
  isaDisjointness?: IsaDisjointness;
  label?: string;
}

interface StructuredExpansion {
  source: string;
  lineMap: number[];
}

interface StructuredAttributeSpec {
  alias: string;
  label: string;
  isIdentifier: boolean;
  isCompositeInternal: boolean;
  isMultivalued: boolean;
  cardinality?: string;
  line: number;
}

interface StructuredAttributeFlags {
  isIdentifier: boolean;
  isCompositeInternal: boolean;
  isMultivalued: boolean;
}

interface StructuredConnectionSpec {
  entityAlias: string;
  cardinality?: string;
  role?: string;
  line: number;
}

class ErsParseError extends Error {
  readonly line: number;
  readonly detail: string;

  constructor(line: number, message: string) {
    super(`ERS linea ${line}: ${message}`);
    this.line = line;
    this.detail = message;
    this.name = "ErsParseError";
  }
}

function humanizeAlias(alias: string): string {
  return alias
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return Number.parseFloat(value.toFixed(2)).toString();
}

function quoteValue(value: string): string {
  return JSON.stringify(value);
}

function createGeneratedId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

function isGeneratedNodeId(value: string): boolean {
  return /^(entity|relationship|attribute|connector|inheritance)-/i.test(value);
}

function normalizeAliasCandidate(value: string, allowDot: boolean): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(allowDot ? /[^a-zA-Z0-9_.-]+/g : /[^a-zA-Z0-9_-]+/g, "_")
    .replace(allowDot ? /^[._-]+|[._-]+$/g : /^[_-]+|[_-]+$/g, "");

  if (normalized.length > 0 && !/^\d/.test(normalized)) {
    return normalized;
  }

  return "";
}

function buildAliasSeed(node: DiagramNode): string {
  const normalizedLabel = normalizeAliasCandidate(node.label, true);
  if (normalizedLabel.length > 0) {
    return normalizedLabel;
  }

  if (!isGeneratedNodeId(node.id)) {
    const normalizedId = normalizeAliasCandidate(node.id, true);
    if (normalizedId.length > 0) {
      return normalizedId;
    }
  }

  return `${node.type}_node`;
}

function buildLocalAttributeAliasSeed(node: DiagramNode, hostAlias: string): string {
  const normalizedLabel = normalizeAliasCandidate(node.label, false);
  if (normalizedLabel.length > 0) {
    return normalizedLabel;
  }

  if (!isGeneratedNodeId(node.id)) {
    const qualifiedPrefix = `${hostAlias}.`;
    if (node.id.startsWith(qualifiedPrefix)) {
      const scopedId = normalizeAliasCandidate(node.id.slice(qualifiedPrefix.length), false);
      if (scopedId.length > 0) {
        return scopedId;
      }
    }

    const tail = node.id.includes(".") ? node.id.slice(node.id.lastIndexOf(".") + 1) : node.id;
    const normalizedTail = normalizeAliasCandidate(tail, false);
    if (normalizedTail.length > 0) {
      return normalizedTail;
    }
  }

  return "attribute";
}

function buildAttributeHostMap(diagram: DiagramDocument): Map<string, string> {
  const hostByAttributeId = new Map<string, string>();

  diagram.edges.forEach((edge) => {
    if (edge.type !== "attribute") {
      return;
    }

    const sourceNode = diagram.nodes.find((node) => node.id === edge.sourceId);
    const targetNode = diagram.nodes.find((node) => node.id === edge.targetId);

    if (
      sourceNode?.type === "attribute" &&
      (targetNode?.type === "entity" || targetNode?.type === "relationship" || targetNode?.type === "attribute")
    ) {
      hostByAttributeId.set(sourceNode.id, targetNode.id);
      return;
    }

    if (
      targetNode?.type === "attribute" &&
      (sourceNode?.type === "entity" || sourceNode?.type === "relationship")
    ) {
      hostByAttributeId.set(targetNode.id, sourceNode.id);
    }
  });

  return hostByAttributeId;
}

function assignNodeAliases(diagram: DiagramDocument): Map<string, string> {
  const hostByAttributeId = buildAttributeHostMap(diagram);
  const aliasByNodeId = new Map<string, string>();
  const usedTopLevelAliases = new Set<string>();

  const topLevelNodes = diagram.nodes.filter(
    (node) => node.type !== "attribute" || !hostByAttributeId.has(node.id),
  );

  [...topLevelNodes]
    .sort(compareNodes)
    .forEach((node) => {
      const baseAlias = buildAliasSeed(node);
      let alias = baseAlias;
      let suffix = 2;

      while (usedTopLevelAliases.has(alias)) {
        alias = `${baseAlias}_${suffix}`;
        suffix += 1;
      }

      usedTopLevelAliases.add(alias);
      aliasByNodeId.set(node.id, alias);
    });

  const localAliasesByHost = new Map<string, Set<string>>();

  [...diagram.nodes]
    .filter((node): node is Extract<DiagramNode, { type: "attribute" }> => node.type === "attribute")
    .sort(compareNodes)
    .forEach((node) => {
      const hostId = hostByAttributeId.get(node.id);
      if (!hostId) {
        return;
      }

      const hostAlias = aliasByNodeId.get(hostId) ?? hostId;
      const usedLocalAliases = localAliasesByHost.get(hostId) ?? new Set<string>();
      const baseLocalAlias = buildLocalAttributeAliasSeed(node, hostAlias);
      let localAlias = baseLocalAlias;
      let suffix = 2;

      while (usedLocalAliases.has(localAlias)) {
        localAlias = `${baseLocalAlias}_${suffix}`;
        suffix += 1;
      }

      usedLocalAliases.add(localAlias);
      localAliasesByHost.set(hostId, usedLocalAliases);
      aliasByNodeId.set(node.id, `${hostAlias}.${localAlias}`);
    });

  return aliasByNodeId;
}

function compareNodes(left: DiagramNode, right: DiagramNode): number {
  const kindDelta = NODE_ORDER.indexOf(left.type) - NODE_ORDER.indexOf(right.type);
  if (kindDelta !== 0) {
    return kindDelta;
  }

  const labelDelta = left.label.localeCompare(right.label, "it", { sensitivity: "base" });
  if (labelDelta !== 0) {
    return labelDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareEdges(left: DiagramEdge, right: DiagramEdge, aliasByNodeId: Map<string, string>): number {
  const kindDelta = EDGE_ORDER.indexOf(left.type) - EDGE_ORDER.indexOf(right.type);
  if (kindDelta !== 0) {
    return kindDelta;
  }

  const leftKey = `${aliasByNodeId.get(left.sourceId) ?? left.sourceId}:${aliasByNodeId.get(left.targetId) ?? left.targetId}`;
  const rightKey = `${aliasByNodeId.get(right.sourceId) ?? right.sourceId}:${aliasByNodeId.get(right.targetId) ?? right.targetId}`;
  const edgeDelta = leftKey.localeCompare(rightKey, "it", { sensitivity: "base" });
  if (edgeDelta !== 0) {
    return edgeDelta;
  }

  return left.id.localeCompare(right.id);
}

function normalizeCommentFreeLine(line: string): string {
  let inString = false;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const current = line[index];
    const next = line[index + 1];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (current === "\\") {
      escaped = true;
      continue;
    }

    if (current === "\"") {
      inString = !inString;
      continue;
    }

    if (!inString && current === "#") {
      return line.slice(0, index).trim();
    }

    if (!inString && current === "/" && next === "/") {
      return line.slice(0, index).trim();
    }
  }

  return line.trim();
}

function tokenizeLine(line: string): string[] {
  const tokens = line.match(/->|"(?:\\.|[^"\\])*"|[^\s]+/g);
  return tokens ?? [];
}

function tokenizeStructuredLine(line: string): string[] {
  const tokens = line.match(/\{|\}|->|"(?:\\.|[^"\\])*"|[^\s{}]+/g);
  return tokens ?? [];
}

function isBlockCommentLine(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("/*") && trimmed.endsWith("*/");
}

function stripDesignerTrailingComma(value: string): string {
  return value.trim().replace(/,+\s*$/g, "").trim();
}

function normalizeDesignerCardinality(value: string): string | undefined {
  const withoutExternal = value
    .replace(/\bexternal\b/gi, "")
    .replace(/\bidentifier\b/gi, "")
    .trim();
  const cleaned = stripDesignerTrailingComma(withoutExternal);
  const wordMatch = cleaned.match(/^([a-z]+|\d+|N)\s*(?:\.\.\.|\.\.)\s*([a-z]+|\d+|N)$/i);

  if (wordMatch) {
    const normalizeBound = (bound: string): string => {
      const lower = bound.toLowerCase();
      if (lower === "zero") {
        return "0";
      }
      if (lower === "one") {
        return "1";
      }
      if (lower === "many" || lower === "n") {
        return "N";
      }
      return bound;
    };
    return normalizeSupportedCardinality(`(${normalizeBound(wordMatch[1])},${normalizeBound(wordMatch[2])})`);
  }

  return normalizeSupportedCardinality(cleaned);
}

function formatDesignerCardinality(value: string | undefined): string {
  const normalized = normalizeSupportedCardinality(value) ?? CONNECTOR_CARDINALITY_PLACEHOLDER;
  const match = normalized.match(/^\(([^,]+),([^)]+)\)$/);
  if (!match) {
    return normalized;
  }

  const formatBound = (bound: string): string => {
    if (bound === "0") {
      return "zero";
    }
    if (bound === "1") {
      return "one";
    }
    if (bound === "N") {
      return "many";
    }
    return bound;
  };

  return `${formatBound(match[1])}..${formatBound(match[2])}`;
}

function readToken(tokens: string[], state: { index: number }, line: number, message: string): string {
  const token = tokens[state.index];
  if (!token) {
    throw new ErsParseError(line, message);
  }

  state.index += 1;
  return token;
}

function readIdentifier(tokens: string[], state: { index: number }, line: number, message: string): string {
  const token = readToken(tokens, state, line, message);
  if (token === "->") {
    throw new ErsParseError(line, message);
  }

  return token;
}

function readStringValue(tokens: string[], state: { index: number }, line: number, message: string): string {
  const token = readToken(tokens, state, line, message);
  if (token.startsWith("\"")) {
    try {
      return JSON.parse(token) as string;
    } catch {
      throw new ErsParseError(line, "Stringa non valida.");
    }
  }

  return token;
}

function readNumberValue(tokens: string[], state: { index: number }, line: number, message: string): number {
  const token = readToken(tokens, state, line, message);
  const parsed = Number(token);

  if (!Number.isFinite(parsed)) {
    throw new ErsParseError(line, message);
  }

  return parsed;
}

function readEnumValue<T extends string>(
  tokens: string[],
  state: { index: number },
  line: number,
  allowedValues: readonly T[],
  label: string,
): T {
  const value = readIdentifier(tokens, state, line, `${label} mancante.`);
  if (!allowedValues.includes(value as T)) {
    throw new ErsParseError(line, `${label} non valido: "${value}".`);
  }

  return value as T;
}

function isQuotedToken(token: string | undefined): boolean {
  return typeof token === "string" && token.startsWith("\"");
}

function getDefaultLabelForAlias(alias: string): string {
  const normalized = alias.trim();
  return normalized.length > 0 ? normalized : humanizeAlias(alias);
}

function createNodeBase(alias: string, type: NodeKind): DiagramNode {
  const size = DEFAULT_NODE_SIZES[type];
  const base = {
    id: alias,
    type,
    label: getDefaultLabelForAlias(alias),
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
  };

  if (type === "attribute") {
    return {
      ...base,
      type,
      isIdentifier: false,
      isCompositeInternal: false,
      isMultivalued: false,
      cardinality: undefined,
    };
  }

  if (type === "entity") {
    return {
      ...base,
      type,
      isWeak: false,
      relationshipParticipations: [],
    };
  }

  return base as DiagramNode;
}

function assertUnqualifiedAlias(alias: string, line: number, label: string): void {
  if (alias.includes(".")) {
    throw new ErsParseError(line, `${label} non puo contenere ".".`);
  }
}

function readStructuredLabel(tokens: string[], state: { index: number }, alias: string, line: number): string {
  const nextToken = tokens[state.index];

  if (nextToken === "label") {
    state.index += 1;
    return readStringValue(tokens, state, line, "Label mancante.");
  }

  if (isQuotedToken(nextToken)) {
    return readStringValue(tokens, state, line, "Label mancante.");
  }

  return getDefaultLabelForAlias(alias);
}

function qualifyAttributeAlias(hostAlias: string, localAlias: string): string {
  return `${hostAlias}.${localAlias}`;
}

function consumeBracketDirectives(tokens: string[], state: { index: number }, line: number): string[] {
  const firstToken = tokens[state.index];
  if (!firstToken || !firstToken.startsWith("[")) {
    return [];
  }

  const rawTokens: string[] = [];
  while (state.index < tokens.length) {
    const token = tokens[state.index];
    rawTokens.push(token);
    state.index += 1;
    if (token.includes("]")) {
      break;
    }
  }

  const rawGroup = rawTokens.join(" ");
  const openIndex = rawGroup.indexOf("[");
  const closeIndex = rawGroup.lastIndexOf("]");
  if (openIndex < 0 || closeIndex < openIndex) {
    throw new ErsParseError(line, "Sintassi args non valida: manca ] nel blocco attributo.");
  }

  if (rawGroup.slice(closeIndex + 1).trim().length > 0) {
    throw new ErsParseError(line, "Sintassi args non valida dopo ].");
  }

  const content = rawGroup.slice(openIndex + 1, closeIndex).trim();
  if (!content) {
    return [];
  }

  return content
    .split(/[,\s]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function applyAttributeDirective(flags: StructuredAttributeFlags, directive: string, line: number): void {
  const normalized = directive.trim().toLowerCase();
  switch (normalized) {
    case "identifier":
    case "id":
      flags.isIdentifier = true;
      return;
    case "composite":
    case "compositeinternal":
      flags.isCompositeInternal = true;
      return;
    case "multivalued":
    case "multi":
      flags.isMultivalued = true;
      return;
    default:
      throw new ErsParseError(line, `Direttiva attributo non riconosciuta: "${directive}".`);
  }
}

function validateStructuredAttributeFlags(flags: StructuredAttributeFlags, line: number): void {
  if (flags.isIdentifier && flags.isCompositeInternal) {
    throw new ErsParseError(line, "Un attributo non puo essere sia identifier sia composite.");
  }

  if (flags.isMultivalued && (flags.isIdentifier || flags.isCompositeInternal)) {
    throw new ErsParseError(line, "Un attributo multivalued non puo essere anche identifier o composite.");
  }
}

function parseStructuredAttributeDeclaration(
  tokens: string[],
  line: number,
  options?: { allowQualifiedAlias?: boolean },
): StructuredAttributeSpec {
  const keyword = tokens[0];
  if (!["attribute", "identifier", "composite", "multivalued"].includes(keyword)) {
    throw new ErsParseError(line, `Istruzione non valida nel blocco: "${keyword}".`);
  }

  const state = { index: 1 };
  const alias = readIdentifier(tokens, state, line, "Nome attributo mancante.");
  if (!options?.allowQualifiedAlias) {
    assertUnqualifiedAlias(alias, line, "Il nome attributo");
  }
  const label = readStructuredLabel(tokens, state, alias, line);
  const flags: StructuredAttributeFlags = {
    isIdentifier: keyword === "identifier",
    isCompositeInternal: keyword === "composite",
    isMultivalued: keyword === "multivalued",
  };
  let cardinality: string | undefined;

  while (state.index < tokens.length) {
    if (tokens[state.index]?.startsWith("[")) {
      const directives = consumeBracketDirectives(tokens, state, line);
      directives.forEach((directive) => applyAttributeDirective(flags, directive, line));
      continue;
    }

    const directive = readIdentifier(tokens, state, line, "Direttiva attributo non valida.");
    if (directive === "card") {
      const nextCardinality = readStringValue(tokens, state, line, "Cardinalita attributo non valida.");
      const normalizedCardinality = normalizeSupportedCardinality(nextCardinality);
      if (!normalizedCardinality) {
        throw new ErsParseError(line, `Cardinalita attributo non valida: "${nextCardinality}".`);
      }
      cardinality = normalizedCardinality;
      continue;
    }

    applyAttributeDirective(flags, directive, line);
  }

  validateStructuredAttributeFlags(flags, line);
  return {
    alias,
    label,
    isIdentifier: flags.isIdentifier,
    isCompositeInternal: flags.isCompositeInternal,
    isMultivalued: flags.isMultivalued,
    cardinality,
    line,
  };
}

function isStructuredInternalIdentifierGroup(tokens: string[]): boolean {
  if (!["identifier", "composite"].includes(tokens[0])) {
    return false;
  }

  if (tokens.length < 2) {
    return false;
  }

  if (tokens.slice(1).some((token) => isQuotedToken(token))) {
    return false;
  }

  return tokens.slice(1).join(" ").includes(",");
}

function parseStructuredInternalIdentifierGroup(tokens: string[], line: number): string[] {
  if (!isStructuredInternalIdentifierGroup(tokens)) {
    throw new ErsParseError(line, "Sintassi identifier non valida.");
  }

  const rawContent = tokens.slice(1).join(" ").trim();
  const aliases = rawContent
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (aliases.length < 2) {
    throw new ErsParseError(line, "Un identificatore interno composto richiede almeno due attributi separati da virgola.");
  }

  aliases.forEach((alias) => assertUnqualifiedAlias(alias, line, "Il nome attributo"));
  return aliases;
}

function parseInternalIdentifierStatement(tokens: string[], line: number): ParsedInternalIdentifierSpec {
  const state = { index: 1 };
  const entityAlias = readIdentifier(tokens, state, line, "Nome entita identificatore interno mancante.");
  assertUnqualifiedAlias(entityAlias, line, "Il nome entita");

  const attributeAliases: string[] = [];

  while (state.index < tokens.length) {
    const attributeAlias = readIdentifier(tokens, state, line, "Attributo identificatore interno mancante.");
    attributeAliases.push(attributeAlias);
  }

  if (attributeAliases.length === 0) {
    throw new ErsParseError(line, "internal-identifier richiede almeno un attributo.");
  }

  return {
    line,
    entityAlias,
    attributeAliases,
  };
}

function parseQualifiedAliasList(value: string, line: number, label: string): string[] {
  const aliases = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (aliases.length === 0) {
    throw new ErsParseError(line, `${label} richiede almeno un riferimento qualificato.`);
  }

  aliases.forEach((alias) => {
    if (!alias.includes(".")) {
      throw new ErsParseError(line, `${label} deve usare la forma entita.attributo.`);
    }
  });

  return aliases;
}

function parseExternalIdentifierStatement(tokens: string[], line: number): ParsedExternalIdentifierSpec {
  const state = { index: 1 };
  const relationshipAlias = readIdentifier(tokens, state, line, "Relazione identificatore esterno mancante.");
  assertUnqualifiedAlias(relationshipAlias, line, "Il nome relazione");

  let hostEntityAlias: string | undefined;
  let importedAttributeAliases: string[] = [];
  let localAttributeAliases: string[] = [];
  let offset: number | undefined;
  let markerOffsetX: number | undefined;
  let markerOffsetY: number | undefined;

  while (state.index < tokens.length) {
    const directive = readIdentifier(tokens, state, line, "Direttiva identificatore esterno non valida.");

    switch (directive) {
      case "host":
      case "to":
        hostEntityAlias = readIdentifier(tokens, state, line, "Entita host identificatore esterno mancante.");
        assertUnqualifiedAlias(hostEntityAlias, line, "Il nome entita");
        break;
      case "import":
      case "fromIdentifier":
        importedAttributeAliases = parseQualifiedAliasList(
          readStringValue(tokens, state, line, "Identificatore importato mancante."),
          line,
          "fromIdentifier",
        );
        break;
      case "from":
      case "sourceAttribute":
        importedAttributeAliases = [
          readStructuredAttributeReference(tokens, state, line, "Attributo sorgente external"),
        ];
        break;
      case "local":
        localAttributeAliases = parseQualifiedAliasList(
          readStringValue(tokens, state, line, "Attributi locali identificatore esterno mancanti."),
          line,
          "local",
        );
        break;
      case "target":
      case "targetAttribute":
        localAttributeAliases = [
          readStructuredAttributeReference(tokens, state, line, "Attributo locale external"),
        ];
        break;
      case "offset":
        offset = readNumberValue(tokens, state, line, "Offset external non valido.");
        break;
      case "markerOffset":
        markerOffsetX = readNumberValue(tokens, state, line, "Marker offset X non valido.");
        markerOffsetY = readNumberValue(tokens, state, line, "Marker offset Y non valido.");
        break;
      default:
        throw new ErsParseError(line, `Direttiva identificatore esterno non riconosciuta: "${directive}".`);
    }
  }

  if (!hostEntityAlias || importedAttributeAliases.length === 0) {
    throw new ErsParseError(
      line,
      "external-identifier richiede almeno relazione, host e identificatore importato.",
    );
  }

  return {
    line,
    relationshipAlias,
    hostEntityAlias,
    importedAttributeAliases,
    localAttributeAliases,
    offset,
    markerOffsetX,
    markerOffsetY,
  };
}

function parseDesignerIdentifierStatement(tokens: string[], line: number): ParsedDesignerIdentifierSpec {
  const state = { index: 1 };
  const entityAlias = readIdentifier(tokens, state, line, "Nome entita identifier mancante.");
  assertUnqualifiedAlias(entityAlias, line, "Il nome entita");

  const itemAliases: string[] = [];
  while (state.index < tokens.length) {
    const itemAlias = readIdentifier(tokens, state, line, "Riferimento identifier mancante.");
    assertUnqualifiedAlias(itemAlias, line, "Il riferimento identifier");
    itemAliases.push(itemAlias);
  }

  if (itemAliases.length === 0) {
    throw new ErsParseError(line, "identifier richiede almeno un attributo o una relazione.");
  }

  return {
    line,
    entityAlias,
    itemAliases,
  };
}

function parseDesignerExternalAttributeStatement(
  tokens: string[],
  line: number,
): ParsedDesignerExternalAttributeSpec {
  const state = { index: 1 };
  const entityAlias = readIdentifier(tokens, state, line, "Nome entita attributo external mancante.");
  const attributeAlias = readIdentifier(tokens, state, line, "Nome attributo external mancante.");
  assertUnqualifiedAlias(entityAlias, line, "Il nome entita");
  assertUnqualifiedAlias(attributeAlias, line, "Il nome attributo");

  if (state.index < tokens.length) {
    throw new ErsParseError(line, `Sintassi attributo external non valida: "${tokens[state.index]}".`);
  }

  return {
    line,
    entityAlias,
    attributeAlias,
  };
}

function parseStructuredConnections(
  tokens: string[],
  state: { index: number },
  line: number,
): StructuredConnectionSpec[] {
  const connections: StructuredConnectionSpec[] = [];

  while (state.index < tokens.length && tokens[state.index] !== "{") {
    const entityAlias = readIdentifier(tokens, state, line, "Entita della relazione mancante.");
    assertUnqualifiedAlias(entityAlias, line, "Il nome entita");

    let cardinality: string | undefined;
    if (state.index < tokens.length && tokens[state.index] !== "{") {
      if (tokens[state.index] === "card") {
        state.index += 1;
      }

      if (state.index < tokens.length && tokens[state.index] !== "{") {
        cardinality = readStringValue(tokens, state, line, "Cardinalita relazione non valida.");
      }
    }

    connections.push({
      entityAlias,
      cardinality,
      line,
    });
  }

  return connections;
}

function readStructuredAttributeReference(tokens: string[], state: { index: number }, line: number, label: string): string {
  const reference = readIdentifier(tokens, state, line, `${label} mancante.`);
  if (!reference.includes(".")) {
    throw new ErsParseError(line, `${label} deve usare la forma entita.attributo.`);
  }
  return reference;
}

function parseStructuredExternal(tokens: string[], line: number): RelationshipExternalSpec {
  const state = { index: 1 };
  const external: RelationshipExternalSpec = {
    importedAttributeAliases: [],
    localAttributeAliases: [],
  };

  if (
    state.index < tokens.length &&
    (tokens[state.index] === "entity" || tokens[state.index] === "composite")
  ) {
    state.index += 1;
  }

  while (state.index < tokens.length) {
    const directive = readIdentifier(tokens, state, line, "Direttiva external non valida.");

    switch (directive) {
      case "import":
      case "fromIdentifier":
        external.importedAttributeAliases = parseQualifiedAliasList(
          readStringValue(tokens, state, line, "Identificatore importato external mancante."),
          line,
          "fromIdentifier",
        );
        break;
      case "from":
      case "sourceAttribute":
        external.importedAttributeAliases = [
          readStructuredAttributeReference(tokens, state, line, "Attributo sorgente external"),
        ];
        break;
      case "to":
      case "targetEntity":
      case "host":
        external.hostEntityAlias = readIdentifier(tokens, state, line, "Entita host external mancante.");
        assertUnqualifiedAlias(external.hostEntityAlias, line, "Il nome entita");
        break;
      case "local":
        external.localAttributeAliases = parseQualifiedAliasList(
          readStringValue(tokens, state, line, "Attributi locali external mancanti."),
          line,
          "local",
        );
        break;
      case "target":
      case "targetAttribute":
        external.localAttributeAliases = [
          readStructuredAttributeReference(tokens, state, line, "Attributo locale external"),
        ];
        break;
      case "offset":
        external.offset = readNumberValue(tokens, state, line, "Offset external non valido.");
        break;
      case "markerOffset":
        external.markerOffsetX = readNumberValue(tokens, state, line, "Marker offset X non valido.");
        external.markerOffsetY = readNumberValue(tokens, state, line, "Marker offset Y non valido.");
        break;
      default:
        throw new ErsParseError(line, `Direttiva external non riconosciuta: "${directive}".`);
    }
  }

  if (!external.hostEntityAlias || external.importedAttributeAliases.length === 0) {
    throw new ErsParseError(
      line,
      "Una relazione external richiede almeno un identificatore importato e l'entita host.",
    );
  }

  return external;
}

function emitLegacyAttributeLines(hostAlias: string, attribute: StructuredAttributeSpec): string[] {
  const qualifiedAlias = qualifyAttributeAlias(hostAlias, attribute.alias);
  const parts = ["attribute", qualifiedAlias, "label", quoteValue(attribute.label)];

  if (attribute.isIdentifier) {
    parts.push("identifier");
  }

  if (attribute.isCompositeInternal) {
    parts.push("compositeInternal");
  }

  if (attribute.isMultivalued) {
    parts.push("multivalued");
  }

  if (attribute.cardinality) {
    parts.push("card", quoteValue(attribute.cardinality));
  }

  return [parts.join(" "), `attribute-link ${qualifiedAlias} -> ${hostAlias}`];
}

function buildLegacyRelationshipLine(alias: string, label: string): string {
  const parts = ["relationship", alias, "label", quoteValue(label)];

  return parts.join(" ");
}

function buildLegacyExternalIdentifierLine(
  relationshipAlias: string,
  externalSpec: RelationshipExternalSpec,
): string {
  const parts = [
    "external-identifier",
    relationshipAlias,
    "host",
    externalSpec.hostEntityAlias as string,
    "fromIdentifier",
    quoteValue(externalSpec.importedAttributeAliases.join(",")),
  ];

  if (externalSpec.localAttributeAliases.length > 0) {
    parts.push("local", quoteValue(externalSpec.localAttributeAliases.join(",")));
  }

  if (typeof externalSpec.offset === "number" && externalSpec.offset !== 0) {
    parts.push("offset", formatNumber(externalSpec.offset));
  }

  if (
    typeof externalSpec.markerOffsetX === "number" ||
    typeof externalSpec.markerOffsetY === "number"
  ) {
    parts.push(
      "markerOffset",
      formatNumber(externalSpec.markerOffsetX ?? 0),
      formatNumber(externalSpec.markerOffsetY ?? 0),
    );
  }

  return parts.join(" ");
}

function parseDesignerAttributeDeclaration(
  rawValue: string,
  line: number,
): Omit<StructuredAttributeSpec, "line"> & { isExternal: boolean } {
  const value = stripDesignerTrailingComma(rawValue);
  const match = value.match(/^([A-Za-z_][\w.-]*)(?:\s*\(([^)]*)\))?$/);

  if (!match) {
    throw new ErsParseError(line, `Attributo non valido: "${rawValue}".`);
  }

  const flags = (match[2] ?? "")
    .split(/[,\s]+/g)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
  const isIdentifier = flags.some((flag) => flag === "id" || flag === "identifier");
  const isExternal = flags.includes("external");
  const isMultivalued = flags.some((flag) => flag === "multivalued" || flag === "multi");
  const cardinality = flags
    .map((flag) => normalizeDesignerCardinality(flag))
    .find((candidate): candidate is string => typeof candidate === "string");

  return {
    alias: match[1],
    label: match[1],
    isIdentifier,
    isCompositeInternal: false,
    isMultivalued,
    cardinality,
    isExternal,
  };
}

function buildDesignerAttributeLegacyLines(
  hostAlias: string,
  rawValue: string,
  line: number,
): { alias: string; emitted: string[]; isIdentifier: boolean; isExternal: boolean } {
  const attribute = parseDesignerAttributeDeclaration(rawValue, line);
  const emitted = emitLegacyAttributeLines(hostAlias, { ...attribute, line });

  return {
    alias: attribute.alias,
    emitted,
    isIdentifier: attribute.isIdentifier,
    isExternal: attribute.isExternal,
  };
}

function parseDesignerIdentifierGroup(rawValue: string, line: number): string[] | undefined {
  const match = rawValue.match(/^(?:identifier|composite)\s*\(([^)]*)\)\s*,?$/i);
  if (!match) {
    return undefined;
  }

  const aliases = match[1]
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (aliases.length === 0) {
    throw new ErsParseError(line, "identifier richiede almeno un attributo o una relazione.");
  }

  aliases.forEach((alias) => assertUnqualifiedAlias(alias, line, "Il riferimento identifier"));
  return aliases;
}

function expandDesignerEntity(
  rawLines: string[],
  startIndex: number,
): { nextIndex: number; emitted: Array<{ line: number; text: string }> } | undefined {
  const line = startIndex + 1;
  const normalized = normalizeCommentFreeLine(rawLines[startIndex]);
  const headerMatch = normalized.match(/^entity\s+([A-Za-z_][\w.-]*)(?:\s+"([^"]+)")?\s*(\{)?\s*$/);

  if (!headerMatch) {
    return undefined;
  }

  const alias = headerMatch[1];
  const label = headerMatch[2] ?? alias;
  const hasBlock = headerMatch[3] === "{";
  const emitted: Array<{ line: number; text: string }> = [
    { line, text: `entity ${alias} label ${quoteValue(label)}` },
  ];

  if (!hasBlock) {
    return { nextIndex: startIndex, emitted };
  }

  for (let index = startIndex + 1; index < rawLines.length; index += 1) {
    const current = normalizeCommentFreeLine(rawLines[index]);
    if (current === "}") {
      break;
    }
    if (/^(attribute|multivalued|composite)\b/.test(current) || /^identifier\s+(?!\()/.test(current)) {
      return undefined;
    }
  }

  let activeCompositeAlias: string | undefined;
  const qualifiedAliasByLocalAlias = new Map<string, string>();

  for (let index = startIndex + 1; index < rawLines.length; index += 1) {
    const currentLine = index + 1;
    const current = normalizeCommentFreeLine(rawLines[index]);

    if (current.length === 0 || isBlockCommentLine(current)) {
      continue;
    }

    const compact = current.trim();

    if (compact === "}" || compact === "},") {
      if (activeCompositeAlias) {
        activeCompositeAlias = undefined;
        continue;
      }

      return { nextIndex: index, emitted };
    }

    if (activeCompositeAlias) {
      const child = buildDesignerAttributeLegacyLines(
        qualifyAttributeAlias(alias, activeCompositeAlias),
        compact,
        currentLine,
      );
      qualifiedAliasByLocalAlias.set(
        child.alias,
        qualifyAttributeAlias(qualifyAttributeAlias(alias, activeCompositeAlias), child.alias),
      );
      child.emitted.forEach((text) => emitted.push({ line: currentLine, text }));
      continue;
    }

    const identifierGroup = parseDesignerIdentifierGroup(compact, currentLine);
    if (identifierGroup) {
      emitted.push({
        line: currentLine,
        text: `designer-identifier ${alias} ${identifierGroup.join(" ")}`,
      });
      continue;
    }

    if (compact.endsWith("{")) {
      const parent = buildDesignerAttributeLegacyLines(alias, compact.slice(0, -1), currentLine);
      parent.emitted.forEach((text) => emitted.push({ line: currentLine, text }));
      qualifiedAliasByLocalAlias.set(parent.alias, qualifyAttributeAlias(alias, parent.alias));
      if (parent.isIdentifier) {
        emitted.push({
          line: currentLine,
          text: `internal-identifier ${alias} ${qualifyAttributeAlias(alias, parent.alias)}`,
        });
      }
      if (parent.isExternal) {
        emitted.push({
          line: currentLine,
          text: `designer-external-attribute ${alias} ${parent.alias}`,
        });
      }
      activeCompositeAlias = parent.alias;
      continue;
    }

    const attribute = buildDesignerAttributeLegacyLines(alias, compact, currentLine);
    attribute.emitted.forEach((text) => emitted.push({ line: currentLine, text }));
    qualifiedAliasByLocalAlias.set(attribute.alias, qualifyAttributeAlias(alias, attribute.alias));
    if (attribute.isIdentifier) {
      emitted.push({
        line: currentLine,
        text: `internal-identifier ${alias} ${qualifyAttributeAlias(alias, attribute.alias)}`,
      });
    }
    if (attribute.isExternal) {
      emitted.push({
        line: currentLine,
        text: `designer-external-attribute ${alias} ${attribute.alias}`,
      });
    }
  }

  throw new ErsParseError(line, "Blocco entity non chiuso.");
}

function expandDesignerRelationship(
  rawLines: string[],
  startIndex: number,
): { nextIndex: number; emitted: Array<{ line: number; text: string }> } | undefined {
  const line = startIndex + 1;
  const normalized = normalizeCommentFreeLine(rawLines[startIndex]);
  const headerMatch = normalized.match(/^relationship\s+([A-Za-z_][\w.-]*)(?:\s+"([^"]+)")?\s*\(\s*$/);

  if (!headerMatch) {
    return undefined;
  }

  const alias = headerMatch[1];
  const label = headerMatch[2] ?? alias;
  const emitted: Array<{ line: number; text: string }> = [
    { line, text: buildLegacyRelationshipLine(alias, label) },
  ];

  for (let index = startIndex + 1; index < rawLines.length; index += 1) {
    const currentLine = index + 1;
    const current = normalizeCommentFreeLine(rawLines[index]);

    if (current.length === 0 || isBlockCommentLine(current)) {
      continue;
    }

    const compact = current.trim();
    if (compact === ")") {
      return { nextIndex: index, emitted };
    }

    const connectionMatch = stripDesignerTrailingComma(compact).match(/^([A-Za-z_][\w.-]*)\s*:\s*(.+)$/);
    if (!connectionMatch) {
      throw new ErsParseError(currentLine, `Partecipazione relazione non valida: "${compact}".`);
    }

    const roleMatch = connectionMatch[2].match(/\brole\s+(?:"([^"]*)"|([^\s]+))\s*$/i);
    const role = roleMatch?.[1] ?? roleMatch?.[2];
    const connectionDetails = (roleMatch
      ? connectionMatch[2].slice(0, roleMatch.index).trim()
      : connectionMatch[2]
    ).replace(/\bexternal\b/gi, "").trim();
    const cardinality = normalizeDesignerCardinality(connectionDetails);
    if (!cardinality) {
      throw new ErsParseError(currentLine, `Cardinalita relazione non valida: "${connectionMatch[2]}".`);
    }
    const externalSuffix = /\bexternal\b/i.test(connectionMatch[2]) ? " external" : "";
    const roleSuffix = role && role.trim().length > 0 ? ` role ${quoteValue(role.trim())}` : "";

    emitted.push({
      line: currentLine,
      text: `connector ${alias} -> ${connectionMatch[1]} card ${quoteValue(cardinality)}${externalSuffix}${roleSuffix}`,
    });
  }

  throw new ErsParseError(line, "Blocco relationship non chiuso.");
}

function expandDesignerGeneralization(
  rawLines: string[],
  startIndex: number,
): { nextIndex: number; emitted: Array<{ line: number; text: string }> } | undefined {
  const line = startIndex + 1;
  const normalized = normalizeCommentFreeLine(rawLines[startIndex]);
  const headerMatch = normalized.match(/^([A-Za-z_][\w.-]*)\s*<=\s*\{\s*$/);

  if (!headerMatch) {
    return undefined;
  }

  const parentAlias = headerMatch[1];
  const children: string[] = [];
  let isaCompleteness: IsaCompleteness = "partial";
  let isaDisjointness: IsaDisjointness = "disjoint";

  for (let index = startIndex + 1; index < rawLines.length; index += 1) {
    const currentLine = index + 1;
    const current = normalizeCommentFreeLine(rawLines[index]);

    if (current.length === 0 || isBlockCommentLine(current)) {
      continue;
    }

    const compact = current.trim();
    if (compact.startsWith("}")) {
      const constraintMatch = compact.match(/\(([^)]*)\)/);
      if (constraintMatch) {
        const parts = constraintMatch[1]
          .split(",")
          .map((item) => item.trim().toLowerCase());
        isaCompleteness = parts.includes("total") || parts.includes("t") ? "total" : "partial";
        isaDisjointness =
          parts.includes("overlap") || parts.includes("overlapping") || parts.includes("o")
            ? "overlap"
            : "disjoint";
      }
      const groupAlias = `${parentAlias}_generalization_${line}`;

      return {
        nextIndex: index,
        emitted: [
          {
            line: currentLine,
            text: `generalization-group ${groupAlias} ${parentAlias} ${isaDisjointness} ${isaCompleteness}`,
          },
          ...children.map((childAlias) => ({
            line: currentLine,
            text: `inheritance ${childAlias} -> ${parentAlias} group ${groupAlias} ${isaDisjointness} ${isaCompleteness}`,
          })),
        ],
      };
    }

    const childAlias = stripDesignerTrailingComma(compact);
    assertUnqualifiedAlias(childAlias, currentLine, "Il nome entita figlia");
    children.push(childAlias);
  }

  throw new ErsParseError(line, "Blocco generalization non chiuso.");
}

function parseGeneralizationGroupStatement(tokens: string[], line: number): ParsedGeneralizationGroupSpec {
  const state = { index: 1 };
  const alias = readIdentifier(tokens, state, line, "Nome gruppo generalization mancante.");
  const supertypeAlias = readIdentifier(tokens, state, line, "Supertipo generalization mancante.");
  let isaDisjointness: IsaDisjointness | undefined;
  let isaCompleteness: IsaCompleteness | undefined;
  let label: string | undefined;

  while (state.index < tokens.length) {
    const directive = readIdentifier(tokens, state, line, "Vincolo generalization non valido.");
    if (directive === "label") {
      label = readStringValue(tokens, state, line, "Label gruppo generalization mancante.");
      continue;
    }
    if (directive === "disjoint" || directive === "exclusive") {
      isaDisjointness = "disjoint";
      continue;
    }
    if (directive === "overlap") {
      isaDisjointness = "overlap";
      continue;
    }
    if (directive === "total") {
      isaCompleteness = "total";
      continue;
    }
    if (directive === "partial") {
      isaCompleteness = "partial";
      continue;
    }
    throw new ErsParseError(line, `Vincolo generalization non riconosciuto: "${directive}".`);
  }

  return {
    line,
    alias,
    supertypeAlias,
    subtypeAliases: [],
    isaCompleteness,
    isaDisjointness,
    label,
  };
}

function parseDesignerIsaConstraint(value: string | undefined): {
  isaCompleteness?: IsaCompleteness;
  isaDisjointness?: IsaDisjointness;
} {
  const parts = (value ?? "")
    .replace(/[()]/g, "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return {
    isaCompleteness: parts.includes("t") || parts.includes("total") ? "total" : parts.includes("p") || parts.includes("partial") ? "partial" : undefined,
    isaDisjointness:
      parts.includes("o") || parts.includes("overlap")
        ? "overlap"
        : parts.includes("e") || parts.includes("exclusive") || parts.includes("disjoint")
          ? "disjoint"
          : undefined,
  };
}

function expandNamedGeneralization(
  rawLines: string[],
  startIndex: number,
): { nextIndex: number; emitted: Array<{ line: number; text: string }> } | undefined {
  const line = startIndex + 1;
  const normalized = normalizeCommentFreeLine(rawLines[startIndex]);
  const headerMatch = normalized.match(/^generalization\s+([A-Za-z_][\w.-]*)\s+([A-Za-z_][\w.-]*)\s*(\([^)]*\))?\s*(?:label\s+(?:"([^"]*)"|([A-Za-z_][\w.-]*)))?\s*\{\s*$/);

  if (!headerMatch) {
    return undefined;
  }

  const alias = headerMatch[1];
  const parentAlias = headerMatch[2];
  const constraints = parseDesignerIsaConstraint(headerMatch[3]);
  const label = headerMatch[4] ?? headerMatch[5];
  const subtypes: string[] = [];

  for (let index = startIndex + 1; index < rawLines.length; index += 1) {
    const currentLine = index + 1;
    const current = normalizeCommentFreeLine(rawLines[index]);
    if (current.length === 0 || isBlockCommentLine(current)) {
      continue;
    }

    if (current.trim() === "}") {
      const constraintParts = [
        constraints.isaDisjointness,
        constraints.isaCompleteness,
      ].filter((part): part is NonNullable<typeof part> => typeof part === "string");
      return {
        nextIndex: index,
        emitted: [
          {
            line,
            text: `generalization-group ${alias} ${parentAlias}${constraintParts.length > 0 ? ` ${constraintParts.join(" ")}` : ""}${label ? ` label ${quoteValue(label)}` : ""}`,
          },
          ...subtypes.map((subtypeAlias) => ({
            line: currentLine,
            text: `inheritance ${subtypeAlias} -> ${parentAlias} group ${alias}${constraintParts.length > 0 ? ` ${constraintParts.join(" ")}` : ""}`,
          })),
        ],
      };
    }

    stripDesignerTrailingComma(current)
      .split(/[,\s]+/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((subtypeAlias) => subtypes.push(subtypeAlias));
  }

  throw new ErsParseError(line, "Blocco generalization non chiuso.");
}

function collectStructuredBlockLines(
  rawLines: string[],
  startIndex: number,
  headerLine: number,
  closesInline: boolean,
): { nextIndex: number; body: Array<{ line: number; tokens: string[] }> } {
  if (closesInline) {
    return { nextIndex: startIndex, body: [] };
  }

  const body: Array<{ line: number; tokens: string[] }> = [];

  for (let index = startIndex + 1; index < rawLines.length; index += 1) {
    const line = index + 1;
    const normalized = normalizeCommentFreeLine(rawLines[index]);

    if (normalized.length === 0) {
      continue;
    }

    const tokens = tokenizeStructuredLine(normalized);
    if (tokens.length === 1 && tokens[0] === "}") {
      return { nextIndex: index, body };
    }
    if (tokens.includes("}")) {
      throw new ErsParseError(line, "La parentesi di chiusura deve stare da sola sulla riga.");
    }

    body.push({ line, tokens });
  }

  throw new ErsParseError(headerLine, "Blocco non chiuso.");
}

function looksLikeStructuredEntity(tokens: string[]): boolean {
  if (tokens[0] !== "entity") {
    return false;
  }

  return tokens[2] !== "label" && !tokens.slice(2).some((token) => LEGACY_NODE_DIRECTIVES.has(token));
}

function looksLikeStructuredTopLevelNode(tokens: string[]): boolean {
  if (!["attribute", "identifier", "composite", "multivalued", "text"].includes(tokens[0])) {
    return false;
  }

  return tokens[2] !== "label" && !tokens.slice(2).some((token) => LEGACY_NODE_DIRECTIVES.has(token));
}

function expandStructuredEntity(
  rawLines: string[],
  startIndex: number,
): { nextIndex: number; emitted: Array<{ line: number; text: string }> } {
  const line = startIndex + 1;
  const tokens = tokenizeStructuredLine(normalizeCommentFreeLine(rawLines[startIndex]));
  const state = { index: 1 };
  const alias = readIdentifier(tokens, state, line, "Nome entita mancante.");
  assertUnqualifiedAlias(alias, line, "Il nome entita");
  const label = readStructuredLabel(tokens, state, alias, line);
  let isWeak = false;

  let hasBlock = false;
  let closesInline = false;

  while (state.index < tokens.length) {
    const token = tokens[state.index];
    if (token === "weak") {
      isWeak = true;
      state.index += 1;
      continue;
    }
    if (token === "{") {
      hasBlock = true;
      state.index += 1;
      continue;
    }
    if (token === "}") {
      if (!hasBlock) {
        throw new ErsParseError(line, "Parentesi di chiusura inattesa.");
      }
      closesInline = true;
      state.index += 1;
      continue;
    }

    throw new ErsParseError(line, `Sintassi entita non valida: "${token}".`);
  }

  const entityParts = ["entity", alias, "label", quoteValue(label)];
  if (isWeak) {
    entityParts.push("weak");
  }

  const emitted: Array<{ line: number; text: string }> = [{ line, text: entityParts.join(" ") }];
  const internalIdentifierGroups: Array<{ line: number; aliases: string[] }> = [];

  if (!hasBlock) {
    return { nextIndex: startIndex, emitted };
  }

  const { nextIndex, body } = collectStructuredBlockLines(rawLines, startIndex, line, closesInline);
  body.forEach((entry) => {
    if (isStructuredInternalIdentifierGroup(entry.tokens)) {
      internalIdentifierGroups.push({
        line: entry.line,
        aliases: parseStructuredInternalIdentifierGroup(entry.tokens, entry.line),
      });
      return;
    }

    const attribute = parseStructuredAttributeDeclaration(entry.tokens, entry.line);
    emitLegacyAttributeLines(alias, attribute).forEach((text) => {
      emitted.push({ line: attribute.line, text });
    });
  });

  internalIdentifierGroups.forEach((group) => {
    const qualifiedAliases = group.aliases.map((localAlias) => qualifyAttributeAlias(alias, localAlias));
    emitted.push({
      line: group.line,
      text: `internal-identifier ${alias} ${qualifiedAliases.join(" ")}`,
    });
  });

  return { nextIndex, emitted };
}

function expandStructuredRelation(
  rawLines: string[],
  startIndex: number,
): { nextIndex: number; emitted: Array<{ line: number; text: string }> } {
  const line = startIndex + 1;
  const tokens = tokenizeStructuredLine(normalizeCommentFreeLine(rawLines[startIndex]));
  const state = { index: 1 };
  const alias = readIdentifier(tokens, state, line, "Nome relazione mancante.");
  assertUnqualifiedAlias(alias, line, "Il nome relazione");
  const label = readStructuredLabel(tokens, state, alias, line);
  const inlineConnections = parseStructuredConnections(tokens, state, line);

  let hasBlock = false;
  let closesInline = false;

  while (state.index < tokens.length) {
    const token = tokens[state.index];
    if (token === "{") {
      hasBlock = true;
      state.index += 1;
      continue;
    }
    if (token === "}") {
      if (!hasBlock) {
        throw new ErsParseError(line, "Parentesi di chiusura inattesa.");
      }
      closesInline = true;
      state.index += 1;
      continue;
    }

    throw new ErsParseError(line, `Sintassi relazione non valida: "${token}".`);
  }

  const allConnections = [...inlineConnections];
  const relationAttributes: StructuredAttributeSpec[] = [];
  const externalSpecs: RelationshipExternalSpec[] = [];
  let nextIndex = startIndex;

  if (hasBlock) {
    const collected = collectStructuredBlockLines(rawLines, startIndex, line, closesInline);
    nextIndex = collected.nextIndex;

    collected.body.forEach((entry) => {
      const keyword = entry.tokens[0];

      if (keyword === "connect") {
        const localState = { index: 1 };
        const entityAlias = readIdentifier(entry.tokens, localState, entry.line, "Entita relation mancante.");
        assertUnqualifiedAlias(entityAlias, entry.line, "Il nome entita");

        let cardinality: string | undefined;
        if (localState.index < entry.tokens.length) {
          if (entry.tokens[localState.index] === "card") {
            localState.index += 1;
          }
          if (localState.index < entry.tokens.length) {
            cardinality = readStringValue(entry.tokens, localState, entry.line, "Cardinalita connect non valida.");
          }
        }
        if (localState.index < entry.tokens.length) {
          throw new ErsParseError(entry.line, "Sintassi connect non valida.");
        }

        allConnections.push({ entityAlias, cardinality, line: entry.line });
        return;
      }

      if (["attribute", "identifier", "composite", "multivalued"].includes(keyword)) {
        relationAttributes.push(parseStructuredAttributeDeclaration(entry.tokens, entry.line));
        return;
      }

      if (keyword === "external") {
        externalSpecs.push(parseStructuredExternal(entry.tokens, entry.line));
        return;
      }

      throw new ErsParseError(entry.line, `Istruzione non valida nel blocco relation: "${keyword}".`);
    });
  }

  const emitted: Array<{ line: number; text: string }> = [
    { line, text: buildLegacyRelationshipLine(alias, label) },
  ];

  externalSpecs.forEach((externalSpec) => {
    emitted.push({
      line,
      text: buildLegacyExternalIdentifierLine(alias, externalSpec),
    });
  });

  relationAttributes.forEach((attribute) => {
    emitLegacyAttributeLines(alias, attribute).forEach((text) => {
      emitted.push({ line: attribute.line, text });
    });
  });

  allConnections.forEach((connection) => {
    emitted.push({
      line: connection.line,
      text: `connector ${alias} -> ${connection.entityAlias}${connection.cardinality ? ` card ${quoteValue(connection.cardinality)}` : ""}`,
    });
  });

  return { nextIndex, emitted };
}

function expandStructuredTopLevelNode(tokens: string[], line: number): string {
  if (tokens[0] === "text") {
    const state = { index: 1 };
    const alias = readIdentifier(tokens, state, line, "Nome elemento mancante.");
    const label = readStructuredLabel(tokens, state, alias, line);
    if (state.index < tokens.length) {
      throw new ErsParseError(line, "Sintassi text non valida.");
    }

    return `text ${alias} label ${quoteValue(label)}`;
  }

  const attribute = parseStructuredAttributeDeclaration(tokens, line, { allowQualifiedAlias: true });
  const parts = ["attribute", attribute.alias, "label", quoteValue(attribute.label)];
  if (attribute.isIdentifier) {
    parts.push("identifier");
  }
  if (attribute.isCompositeInternal) {
    parts.push("compositeInternal");
  }
  if (attribute.isMultivalued) {
    parts.push("multivalued");
  }
  return parts.join(" ");
}

function expandStructuredErs(rawSource: string): StructuredExpansion {
  const rawLines = rawSource.split(/\r?\n/);
  const emittedLines: string[] = [];
  const lineMap: number[] = [];

  function pushLine(text: string, sourceLine: number) {
    emittedLines.push(text);
    lineMap.push(sourceLine);
  }

  for (let index = 0; index < rawLines.length; index += 1) {
    const line = index + 1;
    const normalized = normalizeCommentFreeLine(rawLines[index]);

    if (normalized.length === 0 || isBlockCommentLine(normalized)) {
      pushLine("", line);
      continue;
    }

    const tokens = tokenizeStructuredLine(normalized);
    if (tokens.length === 0) {
      pushLine("", line);
      continue;
    }

    const keyword = tokens[0];

    const designerGeneralization = expandDesignerGeneralization(rawLines, index);
    if (designerGeneralization) {
      designerGeneralization.emitted.forEach((entry) => pushLine(entry.text, entry.line));
      index = designerGeneralization.nextIndex;
      continue;
    }

    if (keyword === "entity") {
      const designerEntity = expandDesignerEntity(rawLines, index);
      if (designerEntity) {
        designerEntity.emitted.forEach((entry) => pushLine(entry.text, entry.line));
        index = designerEntity.nextIndex;
        continue;
      }
    }

    if (keyword === "relationship") {
      const designerRelationship = expandDesignerRelationship(rawLines, index);
      if (designerRelationship) {
        designerRelationship.emitted.forEach((entry) => pushLine(entry.text, entry.line));
        index = designerRelationship.nextIndex;
        continue;
      }
    }

    if (keyword === "generalization") {
      const namedGeneralization = expandNamedGeneralization(rawLines, index);
      if (namedGeneralization) {
        namedGeneralization.emitted.forEach((entry) => pushLine(entry.text, entry.line));
        index = namedGeneralization.nextIndex;
        continue;
      }
    }

    if (keyword === "entity" && looksLikeStructuredEntity(tokens)) {
      const expansion = expandStructuredEntity(rawLines, index);
      expansion.emitted.forEach((entry) => pushLine(entry.text, entry.line));
      index = expansion.nextIndex;
      continue;
    }

    if (keyword === "relation") {
      const expansion = expandStructuredRelation(rawLines, index);
      expansion.emitted.forEach((entry) => pushLine(entry.text, entry.line));
      index = expansion.nextIndex;
      continue;
    }

    if (looksLikeStructuredTopLevelNode(tokens)) {
      pushLine(expandStructuredTopLevelNode(tokens, line), line);
      continue;
    }

    pushLine(normalizeCommentFreeLine(rawLines[index]), line);
  }

  return {
    source: emittedLines.join("\n"),
    lineMap,
  };
}

function parseNodeStatement(
  nodeType: NodeKind,
  tokens: string[],
  line: number,
  initialAttributeFlags?: {
    isIdentifier?: boolean;
    isCompositeInternal?: boolean;
    isMultivalued?: boolean;
  },
): ParsedNodeSpec {
  const state = { index: 1 };
  const alias = readIdentifier(tokens, state, line, "Nome elemento mancante.");
  const node = createNodeBase(alias, nodeType);
  let externalSpec: RelationshipExternalSpec | undefined;

  if (node.type === "attribute" && initialAttributeFlags) {
    node.isIdentifier = initialAttributeFlags.isIdentifier === true;
    node.isCompositeInternal = initialAttributeFlags.isCompositeInternal === true;
    node.isMultivalued = initialAttributeFlags.isMultivalued === true;
  }

  while (state.index < tokens.length) {
    if (tokens[state.index]?.startsWith("[")) {
      if (node.type !== "attribute") {
        throw new ErsParseError(line, "La sintassi [args] e valida solo per gli attributi.");
      }

      const directives = consumeBracketDirectives(tokens, state, line);
      directives.forEach((directive) =>
        applyAttributeDirective(
          node as StructuredAttributeFlags,
          directive,
          line,
        ),
      );
      continue;
    }

    const directive = readIdentifier(tokens, state, line, "Direttiva non valida.");

    switch (directive) {
      case "label":
        node.label = readStringValue(tokens, state, line, "Label mancante.");
        break;
      case "at":
        node.x = readNumberValue(tokens, state, line, "Coordinata X non valida.");
        node.y = readNumberValue(tokens, state, line, "Coordinata Y non valida.");
        break;
      case "size":
        node.width = readNumberValue(tokens, state, line, "Larghezza non valida.");
        node.height = readNumberValue(tokens, state, line, "Altezza non valida.");
        break;
      case "card":
        if (node.type !== "attribute") {
          throw new ErsParseError(line, "La direttiva card e valida solo per gli attributi.");
        }
        {
          const parsedCardinality = readStringValue(tokens, state, line, "Cardinalita attributo non valida.");
          const normalizedCardinality = normalizeSupportedCardinality(parsedCardinality);
          if (!normalizedCardinality) {
            throw new ErsParseError(line, `Cardinalita attributo non valida: "${parsedCardinality}".`);
          }
          node.cardinality = normalizedCardinality;
        }
        break;
      case "identifier":
        if (node.type !== "attribute") {
          throw new ErsParseError(line, "La flag identifier e valida solo per gli attributi.");
        }
        node.isIdentifier = true;
        break;
      case "compositeInternal":
        if (node.type !== "attribute") {
          throw new ErsParseError(line, "La flag compositeInternal e valida solo per gli attributi.");
        }
        node.isCompositeInternal = true;
        break;
      case "multivalued":
        if (node.type !== "attribute") {
          throw new ErsParseError(line, "La flag multivalued e valida solo per gli attributi.");
        }
        node.isMultivalued = true;
        break;
      case "weak":
        if (node.type !== "entity") {
          throw new ErsParseError(line, "La flag weak e valida solo per le entita.");
        }
        node.isWeak = true;
        break;
      case "external":
        if (node.type !== "relationship") {
          throw new ErsParseError(line, "La direttiva external e valida solo per le relazioni.");
        }
        externalSpec = externalSpec ?? {
          importedAttributeAliases: [],
          localAttributeAliases: [],
        };
        if (
          state.index < tokens.length &&
          (tokens[state.index] === "entity" || tokens[state.index] === "composite")
        ) {
          state.index += 1;
        }
        break;
      case "sourceAttribute":
      case "targetEntity":
      case "targetAttribute":
      case "from":
      case "to":
      case "target":
      case "host":
      case "fromIdentifier":
      case "import":
      case "local":
        if (node.type !== "relationship") {
          throw new ErsParseError(line, `La direttiva ${directive} e valida solo per le relazioni.`);
        }
        externalSpec = externalSpec ?? {
          importedAttributeAliases: [],
          localAttributeAliases: [],
        };
        switch (directive) {
          case "sourceAttribute":
          case "from":
            externalSpec.importedAttributeAliases = [
              readIdentifier(tokens, state, line, "sourceAttribute richiede un attributo sorgente."),
            ];
            break;
          case "targetEntity":
          case "to":
          case "host":
            externalSpec.hostEntityAlias = readIdentifier(
              tokens,
              state,
              line,
              "targetEntity richiede un'entita.",
            );
            break;
          case "targetAttribute":
          case "target":
            externalSpec.localAttributeAliases = [
              readIdentifier(tokens, state, line, "targetAttribute richiede un attributo."),
            ];
            break;
          case "fromIdentifier":
          case "import":
            externalSpec.importedAttributeAliases = parseQualifiedAliasList(
              readStringValue(tokens, state, line, "Identificatore importato mancante."),
              line,
              "fromIdentifier",
            );
            break;
          case "local":
            externalSpec.localAttributeAliases = parseQualifiedAliasList(
              readStringValue(tokens, state, line, "Attributi locali mancanti."),
              line,
              "local",
            );
            break;
        }
        break;
      case "offset":
        if (node.type !== "relationship") {
          throw new ErsParseError(line, "La direttiva offset e valida solo per le relazioni in external mode.");
        }
        externalSpec = externalSpec ?? {
          importedAttributeAliases: [],
          localAttributeAliases: [],
        };
        externalSpec.offset = readNumberValue(tokens, state, line, "Offset external non valido.");
        break;
      case "markerOffset":
        if (node.type !== "relationship") {
          throw new ErsParseError(line, "La direttiva markerOffset e valida solo per le relazioni in external mode.");
        }
        externalSpec = externalSpec ?? {
          importedAttributeAliases: [],
          localAttributeAliases: [],
        };
        externalSpec.markerOffsetX = readNumberValue(tokens, state, line, "Marker offset X non valido.");
        externalSpec.markerOffsetY = readNumberValue(tokens, state, line, "Marker offset Y non valido.");
        break;
      default:
        throw new ErsParseError(line, `Direttiva non riconosciuta: "${directive}".`);
    }
  }

  if (node.type === "attribute") {
    validateStructuredAttributeFlags(
      {
        isIdentifier: node.isIdentifier === true,
        isCompositeInternal: node.isCompositeInternal === true,
        isMultivalued: node.isMultivalued === true,
      },
      line,
    );
  }

  if (node.type === "attribute" && node.isMultivalued === true) {
    const nextSize = getMultivaluedAttributeSize(node.label);
    node.width = nextSize.width;
    node.height = nextSize.height;
  }

  if (
    node.type === "relationship" &&
    externalSpec &&
    (externalSpec.importedAttributeAliases.length === 0 || !externalSpec.hostEntityAlias)
  ) {
    throw new ErsParseError(
      line,
      "Una relazione external richiede almeno un identificatore importato e l'entita host.",
    );
  }

  return { line, alias, node, externalSpec };
}

function parseEdgeStatement(edgeType: EdgeKind, tokens: string[], line: number): ParsedEdgeSpec {
  const state = { index: 1 };
  const sourceAlias = readIdentifier(tokens, state, line, "Elemento sorgente mancante.");
  const arrow = readToken(tokens, state, line, "Operatore -> mancante.");

  if (arrow !== "->") {
    throw new ErsParseError(line, "Sintassi collegamento non valida: usa -> tra sorgente e destinazione.");
  }

  const targetAlias = readIdentifier(tokens, state, line, "Elemento destinazione mancante.");
  const edge: ParsedEdgeSpec = {
    line,
    type: edgeType,
    sourceAlias,
    targetAlias,
    label: "",
    lineStyle: "solid",
  };

  while (state.index < tokens.length) {
    const directive = readIdentifier(tokens, state, line, "Direttiva collegamento non valida.");

    switch (directive) {
      case "card":
        if (edgeType === "inheritance") {
          throw new ErsParseError(line, "La direttiva card non e valida per inheritance.");
        }
        edge.cardinality = readStringValue(tokens, state, line, "Cardinalita mancante.");
        break;
      case "role":
        if (edgeType !== "connector") {
          throw new ErsParseError(line, "La direttiva role e valida solo per connector.");
        }
        edge.role = readStringValue(tokens, state, line, "Role collegamento mancante.");
        break;
      case "external":
        if (edgeType !== "connector") {
          throw new ErsParseError(line, "La direttiva external e valida solo per connector.");
        }
        edge.isExternalIdentifierHost = true;
        break;
      case "group":
        if (edgeType !== "inheritance") {
          throw new ErsParseError(line, "La direttiva group e valida solo per inheritance.");
        }
        edge.generalizationGroupAlias = readIdentifier(tokens, state, line, "Group id mancante.");
        break;
      case "label":
        edge.label = readStringValue(tokens, state, line, "Label collegamento mancante.");
        break;
      case "style":
        edge.lineStyle = readEnumValue(tokens, state, line, ["solid", "dashed"], "Stile linea");
        break;
      case "offset":
        edge.manualOffset = readNumberValue(tokens, state, line, "Offset collegamento non valido.");
        break;
      case "disjoint":
      case "overlap":
        if (edgeType !== "inheritance") {
          throw new ErsParseError(line, `La direttiva ${directive} e valida solo per inheritance.`);
        }
        edge.isaDisjointness = directive as IsaDisjointness;
        break;
      case "total":
      case "partial":
        if (edgeType !== "inheritance") {
          throw new ErsParseError(line, `La direttiva ${directive} e valida solo per inheritance.`);
        }
        edge.isaCompleteness = directive as IsaCompleteness;
        break;
      case "disjointness":
        if (edgeType !== "inheritance") {
          throw new ErsParseError(line, "La direttiva disjointness e valida solo per inheritance.");
        }
        edge.isaDisjointness = readEnumValue(
          tokens,
          state,
          line,
          ["disjoint", "overlap"] as const,
          "Vincolo ISA",
        );
        break;
      case "completeness":
        if (edgeType !== "inheritance") {
          throw new ErsParseError(line, "La direttiva completeness e valida solo per inheritance.");
        }
        edge.isaCompleteness = readEnumValue(
          tokens,
          state,
          line,
          ["total", "partial"] as const,
          "Copertura ISA",
        );
        break;
      default:
        throw new ErsParseError(line, `Direttiva collegamento non riconosciuta: "${directive}".`);
    }
  }

  return edge;
}

function getAttributeHostNodes(diagram: DiagramDocument): Map<string, DiagramNode[]> {
  const map = new Map<string, DiagramNode[]>();

  diagram.edges.forEach((edge) => {
    if (edge.type !== "attribute") {
      return;
    }

    const source = diagram.nodes.find((node) => node.id === edge.sourceId);
    const target = diagram.nodes.find((node) => node.id === edge.targetId);

    if (
      source?.type === "attribute" &&
      (target?.type === "entity" || target?.type === "relationship" || target?.type === "attribute")
    ) {
      const bucket = map.get(target.id) ?? [];
      bucket.push(source);
      map.set(target.id, bucket);
      return;
    }

    if (target?.type === "attribute" && (source?.type === "entity" || source?.type === "relationship")) {
      const bucket = map.get(source.id) ?? [];
      bucket.push(target);
      map.set(source.id, bucket);
    }
  });

  return map;
}

function getLocalAttributeAlias(
  attribute: Extract<DiagramNode, { type: "attribute" }>,
  hostAlias: string,
  aliasByNodeId: Map<string, string>,
): string {
  const qualifiedAlias = aliasByNodeId.get(attribute.id) ?? attribute.id;
  const prefix = `${hostAlias}.`;

  if (qualifiedAlias.startsWith(prefix)) {
    return qualifiedAlias.slice(prefix.length);
  }

  return qualifiedAlias;
}

function formatNamedDefinition(keyword: string, alias: string, label: string): string {
  if (label === alias) {
    return `${keyword} ${alias}`;
  }

  return `${keyword} ${alias} ${quoteValue(label)}`;
}

function normalizeNotesContent(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function formatLegacyTextNotes(notes: string[]): string {
  const normalized = notes.map((value) => normalizeNotesContent(value)).filter((value) => value.length > 0);
  if (normalized.length === 0) {
    return "";
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  return normalized.map((value, index) => `[Nota ${index + 1}]\n${value}`).join("\n\n");
}

function mergeParsedNotes(explicitNotes: string, migratedLegacyNotes: string): string {
  if (!explicitNotes && !migratedLegacyNotes) {
    return "";
  }

  if (!explicitNotes) {
    return migratedLegacyNotes;
  }

  if (!migratedLegacyNotes) {
    return explicitNotes;
  }

  return `${explicitNotes}\n\n[Migrazione Testo Libero]\n${migratedLegacyNotes}`;
}

function parseNotesDirective(tokens: string[], line: number): string {
  const state = { index: 1 };
  const value = readStringValue(tokens, state, line, "La direttiva notes richiede un contenuto.");
  if (state.index < tokens.length) {
    throw new ErsParseError(line, "Sintassi notes non valida.");
  }

  return normalizeNotesContent(value);
}

function parseLegacyTextDirectiveAsNote(tokens: string[], line: number): string {
  const state = { index: 1 };
  const alias = readIdentifier(tokens, state, line, "Sintassi text non valida: alias mancante.");
  let content = getDefaultLabelForAlias(alias);

  while (state.index < tokens.length) {
    const directive = readIdentifier(tokens, state, line, "Direttiva text non valida.");
    switch (directive) {
      case "label":
        content = readStringValue(tokens, state, line, "Label text mancante.");
        break;
      case "at":
        readNumberValue(tokens, state, line, "Coordinata X text non valida.");
        readNumberValue(tokens, state, line, "Coordinata Y text non valida.");
        break;
      case "size":
        readNumberValue(tokens, state, line, "Larghezza text non valida.");
        readNumberValue(tokens, state, line, "Altezza text non valida.");
        break;
      default:
        throw new ErsParseError(line, `Direttiva text non riconosciuta: "${directive}".`);
    }
  }

  return normalizeNotesContent(content);
}

function getAttributeKeyword(
  attribute: Extract<DiagramNode, { type: "attribute" }>,
  simpleIdentifierAttributeIds: Set<string>,
):
  | "attribute"
  | "identifier"
  | "multivalued" {
  if (simpleIdentifierAttributeIds.has(attribute.id)) {
    return "identifier";
  }

  if (attribute.isMultivalued === true) {
    return "multivalued";
  }

  return "attribute";
}

function getEntityInternalIdentifierGroups(
  entity: Extract<DiagramNode, { type: "entity" }>,
  attributes: Array<Extract<DiagramNode, { type: "attribute" }>>,
): string[][] {
  const identifierGroups: string[][] = [];

  const directAttributeIdSet = new Set(attributes.map((attribute) => attribute.id));
  const explicitIdentifiers = Array.isArray(entity.internalIdentifiers)
    ? entity.internalIdentifiers.filter(
        (identifier): identifier is InternalIdentifier =>
          Array.isArray(identifier.attributeIds) && identifier.attributeIds.length > 0,
      )
    : [];

  if (explicitIdentifiers.length > 0) {
    explicitIdentifiers.forEach((identifier) => {
      const normalizedAttributeIds = identifier.attributeIds
        .filter((attributeId) => directAttributeIdSet.has(attributeId))
        .filter((attributeId, index, source) => source.indexOf(attributeId) === index);

      if (normalizedAttributeIds.length > 0) {
        identifierGroups.push(normalizedAttributeIds);
      }
    });

    return identifierGroups;
  }

  attributes
    .filter((attribute) => attribute.isIdentifier === true)
    .forEach((attribute) => {
      identifierGroups.push([attribute.id]);
    });

  const legacyCompositeGroup = attributes
    .filter((attribute) => attribute.isCompositeInternal === true)
    .map((attribute) => attribute.id);

  if (legacyCompositeGroup.length > 1) {
    identifierGroups.push(legacyCompositeGroup);
  }

  return identifierGroups;
}

function buildAttributeDeclaration(
  attribute: Extract<DiagramNode, { type: "attribute" }>,
  hostAlias: string,
  aliasByNodeId: Map<string, string>,
  simpleIdentifierAttributeIds: Set<string>,
): string {
  const alias = getLocalAttributeAlias(attribute, hostAlias, aliasByNodeId);
  const parts = [
    formatNamedDefinition(
      getAttributeKeyword(attribute, simpleIdentifierAttributeIds),
      alias,
      attribute.label,
    ),
  ];

  if (attribute.cardinality) {
    parts.push("card", quoteValue(attribute.cardinality));
  }

  return `  ${parts.join(" ")}`;
}

function buildDesignerAttributeDeclaration(
  attribute: Extract<DiagramNode, { type: "attribute" }>,
  hostAlias: string,
  aliasByNodeId: Map<string, string>,
): string {
  const alias = getLocalAttributeAlias(attribute, hostAlias, aliasByNodeId);
  const flags: string[] = [];

  if (attribute.cardinality) {
    flags.push(formatDesignerCardinality(attribute.cardinality));
  }

  return `${alias}${flags.length > 0 ? ` (${flags.join(", ")})` : ""}`;
}

function appendDesignerComma(lines: string[], index: number, total: number): string {
  return index < total - 1 ? `${lines[index]},` : lines[index];
}

function buildStandaloneAttributeLine(
  attribute: Extract<DiagramNode, { type: "attribute" }>,
  alias: string,
): string {
  const parts = [
    formatNamedDefinition(
      getAttributeKeyword(attribute, attribute.isIdentifier === true ? new Set([attribute.id]) : new Set()),
      alias,
      attribute.label,
    ),
  ];

  if (attribute.cardinality) {
    parts.push("card", quoteValue(attribute.cardinality));
  }

  return parts.join(" ");
}

function buildNestedAttributeLegacyLines(
  diagram: DiagramDocument,
  aliasByNodeId: Map<string, string>,
): string[] {
  const nestedAttributes = [...diagram.nodes]
    .filter((node): node is Extract<DiagramNode, { type: "attribute" }> => node.type === "attribute")
    .filter((attribute) =>
      diagram.edges.some(
        (edge) =>
          edge.type === "attribute" &&
          edge.sourceId === attribute.id &&
          diagram.nodes.find((candidate) => candidate.id === edge.targetId)?.type === "attribute",
      ),
    )
    .sort(compareNodes);

  return nestedAttributes.flatMap((attribute) => {
    const alias = aliasByNodeId.get(attribute.id) ?? attribute.id;
    const parentEdge = diagram.edges.find(
      (edge) =>
        edge.type === "attribute" &&
        edge.sourceId === attribute.id &&
        diagram.nodes.find((candidate) => candidate.id === edge.targetId)?.type === "attribute",
    );
    const hostAlias = parentEdge ? aliasByNodeId.get(parentEdge.targetId) ?? parentEdge.targetId : undefined;

    if (!hostAlias) {
      return [];
    }

    return [buildStandaloneAttributeLine(attribute, alias), `attribute-link ${alias} -> ${hostAlias}`];
  });
}

function buildEntityBlock(
  entity: Extract<DiagramNode, { type: "entity" }>,
  aliasByNodeId: Map<string, string>,
  attributesByHostId: Map<string, DiagramNode[]>,
): string[] {
  const entityAlias = aliasByNodeId.get(entity.id) ?? entity.id;
  const attributes = (attributesByHostId.get(entity.id) ?? [])
    .filter((node): node is Extract<DiagramNode, { type: "attribute" }> => node.type === "attribute")
    .sort(compareNodes);
  const attributesById = new Map(attributes.map((attribute) => [attribute.id, attribute]));
  const internalIdentifierGroups = getEntityInternalIdentifierGroups(entity, attributes);
  const externalIdentifierGroups = (entity.externalIdentifiers ?? [])
    .map((identifier) => {
      const localAttributeIds = identifier.localAttributeIds
        .filter((attributeId) => attributesById.has(attributeId))
        .filter((attributeId, index, source) => source.indexOf(attributeId) === index);
      const relationshipIds = identifier.importedParts
        .map((part) => part.relationshipId)
        .filter((relationshipId, index, source) => source.indexOf(relationshipId) === index);

      return {
        localAttributeIds,
        relationshipIds,
      };
    })
    .filter((identifier) => identifier.localAttributeIds.length > 0 || identifier.relationshipIds.length > 0);
  const identifierAttributeIds = new Set([
    ...internalIdentifierGroups.flat(),
    ...externalIdentifierGroups.flatMap((identifier) => identifier.localAttributeIds),
  ]);
  const entries: string[] = [];
  const emittedInternalIdentifierIndexes = new Set<number>();
  const emittedExternalIdentifierIndexes = new Set<number>();

  const buildInternalIdentifierLine = (group: string[]): string | undefined => {
    const localAliases = group
      .map((attributeId) => attributesById.get(attributeId))
      .filter((attribute): attribute is Extract<DiagramNode, { type: "attribute" }> => Boolean(attribute))
      .map((attribute) => getLocalAttributeAlias(attribute, entityAlias, aliasByNodeId));

    return localAliases.length > 0 ? `    identifier(${localAliases.join(", ")})` : undefined;
  };

  const buildExternalIdentifierLine = (group: { localAttributeIds: string[]; relationshipIds: string[] }): string | undefined => {
    const localAliases = group.localAttributeIds
      .map((attributeId) => attributesById.get(attributeId))
      .filter((attribute): attribute is Extract<DiagramNode, { type: "attribute" }> => Boolean(attribute))
      .map((attribute) => getLocalAttributeAlias(attribute, entityAlias, aliasByNodeId));
    const relationshipAliases = group.relationshipIds.map((relationshipId) => aliasByNodeId.get(relationshipId) ?? relationshipId);
    const parts = [...localAliases, ...relationshipAliases];

    return parts.length > 0 ? `    identifier(${parts.join(", ")})` : undefined;
  };

  const emitIdentifierLinesForAttribute = (attributeId: string) => {
    internalIdentifierGroups.forEach((group, index) => {
      if (emittedInternalIdentifierIndexes.has(index) || !group.includes(attributeId)) {
        return;
      }

      const line = buildInternalIdentifierLine(group);
      if (line) {
        entries.push(line);
      }
      emittedInternalIdentifierIndexes.add(index);
    });

    externalIdentifierGroups.forEach((group, index) => {
      if (emittedExternalIdentifierIndexes.has(index) || !group.localAttributeIds.includes(attributeId)) {
        return;
      }

      const line = buildExternalIdentifierLine(group);
      if (line) {
        entries.push(line);
      }
      emittedExternalIdentifierIndexes.add(index);
    });
  };

  externalIdentifierGroups.forEach((group, index) => {
    if (group.localAttributeIds.length > 0) {
      return;
    }

    const line = buildExternalIdentifierLine(group);
    if (line) {
      entries.push(line);
    }
    emittedExternalIdentifierIndexes.add(index);
  });

  attributes.forEach((attribute) => {
    const childAttributes = (attributesByHostId.get(attribute.id) ?? [])
      .filter((node): node is Extract<DiagramNode, { type: "attribute" }> => node.type === "attribute")
      .sort(compareNodes);
    emitIdentifierLinesForAttribute(attribute.id);
    const shouldSkipStandaloneAttribute = identifierAttributeIds.has(attribute.id) && childAttributes.length === 0;
    if (shouldSkipStandaloneAttribute) {
      return;
    }

    const declaration = buildDesignerAttributeDeclaration(
      attribute,
      entityAlias,
      aliasByNodeId,
    );

    if (childAttributes.length === 0) {
      entries.push(`    ${declaration}`);
      return;
    }

    const parentAlias = aliasByNodeId.get(attribute.id) ?? attribute.id;
    const childLines = childAttributes.map((childAttribute, index) => {
      const childDeclaration = buildDesignerAttributeDeclaration(
        childAttribute,
        parentAlias,
        aliasByNodeId,
      );
      return `        ${childDeclaration}${index < childAttributes.length - 1 ? "," : ""}`;
    });
    entries.push([`    ${declaration} {`, ...childLines, "    }"].join("\n"));
  });

  internalIdentifierGroups.forEach((group, index) => {
    if (emittedInternalIdentifierIndexes.has(index)) {
      return;
    }

    const line = buildInternalIdentifierLine(group);
    if (line) {
      entries.push(line);
    }
  });

  externalIdentifierGroups.forEach((group, index) => {
    if (emittedExternalIdentifierIndexes.has(index)) {
      return;
    }

    const line = buildExternalIdentifierLine(group);
    if (line) {
      entries.push(line);
    }
  });

  if (entries.length === 0) {
    return [`entity ${entityAlias}`];
  }

  const lines = [`entity ${entityAlias} {`];
  entries.forEach((entry, index) => {
    lines.push(appendDesignerComma(entries, index, entries.length));
  });
  lines.push("}");
  return lines;
}

function buildRelationLines(
  relationship: Extract<DiagramNode, { type: "relationship" }>,
  diagram: DiagramDocument,
  aliasByNodeId: Map<string, string>,
): string[] {
  const relationAlias = aliasByNodeId.get(relationship.id) ?? relationship.id;
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const connectors = diagram.edges
    .filter(
      (edge): edge is Extract<DiagramEdge, { type: "connector" }> =>
        edge.type === "connector" && (edge.sourceId === relationship.id || edge.targetId === relationship.id),
    )
    .map((edge) => {
      const entityId = edge.sourceId === relationship.id ? edge.targetId : edge.sourceId;
      const sourceNode = nodeMap.get(edge.sourceId);
      const targetNode = nodeMap.get(edge.targetId);
      const participation = getConnectorParticipation(edge, sourceNode, targetNode);
      return {
        entityAlias: aliasByNodeId.get(entityId) ?? entityId,
        cardinality: participation?.cardinality ?? CONNECTOR_CARDINALITY_PLACEHOLDER,
        role: participation?.role,
      };
    })
    .sort((left, right) => {
      const byEntity = left.entityAlias.localeCompare(right.entityAlias, "it", { sensitivity: "base" });
      if (byEntity !== 0) {
        return byEntity;
      }

      return (left.role ?? "").localeCompare(right.role ?? "", "it", { sensitivity: "base" });
    });
  const lines = [`relationship ${relationAlias} (`];

  connectors.forEach((connector, index) => {
    const roleSuffix = connector.role && connector.role.trim().length > 0 ? ` role ${quoteValue(connector.role.trim())}` : "";
    lines.push(
      `    ${connector.entityAlias}: ${formatDesignerCardinality(connector.cardinality)}${roleSuffix}${
        index < connectors.length - 1 ? "," : ""
      }`,
    );
  });

  lines.push(")");
  return lines;
}

function buildEdgeId(edgeType: EdgeKind, sourceId: string, targetId: string, occurrence: number): string {
  return `${edgeType}-${sourceId}-${targetId}-${occurrence}`;
}

function resolveNodeAlias(
  alias: string,
  aliasMap: Map<string, ParsedNodeSpec>,
  line: number,
  expectedType?: NodeKind,
): DiagramNode {
  const target = aliasMap.get(alias);

  if (!target) {
    throw new ErsParseError(line, `Riferimento non trovato: "${alias}".`);
  }

  if (expectedType && target.node.type !== expectedType) {
    throw new ErsParseError(line, `"${alias}" deve essere di tipo ${expectedType}.`);
  }

  return target.node;
}

export function serializeDiagramToErs(diagram: DiagramDocument): string {
  let normalizedDiagram = normalizeGeneralizationGroups(diagram);
  normalizedDiagram = cleanupGeneralizationReferences(normalizedDiagram);
  const aliasByNodeId = assignNodeAliases(normalizedDiagram);
  const attributesByHostId = getAttributeHostNodes(normalizedDiagram);
  const attributeHostMap = buildAttributeHostMap(normalizedDiagram);
  const entityLines = [...normalizedDiagram.nodes]
    .filter((node): node is Extract<DiagramNode, { type: "entity" }> => node.type === "entity")
    .sort(compareNodes)
    .flatMap((entity) => buildEntityBlock(entity, aliasByNodeId, attributesByHostId));
  const relationLines = [...normalizedDiagram.nodes]
    .filter((node): node is Extract<DiagramNode, { type: "relationship" }> => node.type === "relationship")
    .sort(compareNodes)
    .flatMap((relationship) => buildRelationLines(relationship, normalizedDiagram, aliasByNodeId));
  const orphanAttributeLines = [...normalizedDiagram.nodes]
    .filter(
      (node): node is Extract<DiagramNode, { type: "attribute" }> =>
        node.type === "attribute" && !attributeHostMap.has(node.id),
    )
    .sort(compareNodes)
    .map((attribute) => buildStandaloneAttributeLine(attribute, aliasByNodeId.get(attribute.id) ?? attribute.id));
  const nestedAttributeLines: string[] = [];
  const notesContent = normalizeNotesContent(normalizedDiagram.notes);
  const notesLines = notesContent.length > 0 ? [`notes ${quoteValue(notesContent)}`] : [];
  const explicitGeneralizationGroups = normalizedDiagram.generalizationGroups ?? [];
  const inheritanceGroups = new Map<
    string,
    {
      parentAlias: string;
      children: string[];
      isaCompleteness: IsaCompleteness;
      isaDisjointness: IsaDisjointness;
      label?: string;
    }
  >();
  explicitGeneralizationGroups.forEach((group) => {
    const parentAlias = aliasByNodeId.get(group.supertypeId);
    const children = group.subtypeIds
      .map((subtypeId) => aliasByNodeId.get(subtypeId))
      .filter((childAlias): childAlias is string => typeof childAlias === "string");
    if (!parentAlias || children.length === 0) {
      return;
    }
    inheritanceGroups.set(group.id, {
      parentAlias,
      children,
      isaCompleteness: group.isaCompleteness ?? "partial",
      isaDisjointness: group.isaDisjointness ?? "disjoint",
      label: group.label,
    });
  });
  const inheritanceLines = Array.from(inheritanceGroups.entries()).flatMap(([groupId, group]) => {
    return [
      `generalization ${groupId} ${group.parentAlias} (${group.isaCompleteness === "total" ? "t" : "p"},${group.isaDisjointness === "disjoint" ? "e" : "o"})${group.label ? ` label ${quoteValue(group.label)}` : ""} {`,
      ...group.children.map((childAlias, index) => `    ${childAlias}${index < group.children.length - 1 ? "," : ""}`),
      `}`,
    ];
  });
  const unassignedInheritanceLines =
    [...normalizedDiagram.edges]
      .filter((edge): edge is Extract<DiagramEdge, { type: "inheritance" }> => edge.type === "inheritance" && !edge.generalizationGroupId)
      .sort((left, right) => compareEdges(left, right, aliasByNodeId))
      .map((edge) => {
        const childAlias = aliasByNodeId.get(edge.sourceId);
        const parentAlias = aliasByNodeId.get(edge.targetId);
        return childAlias && parentAlias ? `inheritance ${childAlias} -> ${parentAlias}` : "";
      })
      .filter((line) => line.length > 0);

  const sections: string[] = [];

  if (entityLines.length > 0) {
    sections.push("/* Entities */", ...entityLines);
  }
  if (relationLines.length > 0) {
    if (sections.length > 0) {
      sections.push("");
    }
    sections.push("/* Relationships */", ...relationLines);
  }
  if (inheritanceLines.length > 0 || unassignedInheritanceLines.length > 0) {
    if (sections.length > 0) {
      sections.push("");
    }
    sections.push("/* Generalizations */", ...inheritanceLines, ...unassignedInheritanceLines);
  }
  if (orphanAttributeLines.length > 0 || nestedAttributeLines.length > 0 || notesLines.length > 0) {
    if (sections.length > 0) {
      sections.push("");
    }
    sections.push(...orphanAttributeLines, ...nestedAttributeLines, ...notesLines);
  }

  return sections.join("\n");
}

function buildEdgeMatchKey(edge: DiagramEdge, aliasByNodeId: Map<string, string>): string {
  const sourceAlias = aliasByNodeId.get(edge.sourceId) ?? edge.sourceId;
  const targetAlias = aliasByNodeId.get(edge.targetId) ?? edge.targetId;

  if (edge.type === "inheritance") {
    return `${edge.type}:${sourceAlias}->${targetAlias}`;
  }

  const [left, right] = [sourceAlias, targetAlias].sort((a, b) =>
    a.localeCompare(b, "it", { sensitivity: "base" }),
  );
  return `${edge.type}:${left}<->${right}`;
}

function queueExistingEdgesByKey(diagram: DiagramDocument): Map<string, DiagramEdge[]> {
  const aliasByNodeId = assignNodeAliases(diagram);
  const queued = new Map<string, DiagramEdge[]>();

  [...diagram.edges]
    .sort((left, right) => compareEdges(left, right, aliasByNodeId))
    .forEach((edge) => {
      const key = buildEdgeMatchKey(edge, aliasByNodeId);
      const bucket = queued.get(key) ?? [];
      bucket.push(edge);
      queued.set(key, bucket);
    });

  return queued;
}

function autoPlaceDiagram(diagram: DiagramDocument, lockedNodeIds: Set<string>): DiagramDocument {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const hostByAttributeId = buildAttributeHostMap(diagram);
  const nextNodes = new Map<string, DiagramNode>();

  function getNode(nodeId: string): DiagramNode {
    return nextNodes.get(nodeId) ?? (nodeMap.get(nodeId) as DiagramNode);
  }

  function setNode(node: DiagramNode) {
    nextNodes.set(node.id, node);
  }

  const entityNodes = [...diagram.nodes]
    .filter((node): node is Extract<DiagramNode, { type: "entity" }> => node.type === "entity")
    .sort(compareNodes);
  const lockedEntities = entityNodes.filter((node) => lockedNodeIds.has(node.id));
  let nextEntityX =
    lockedEntities.length > 0
      ? Math.max(...lockedEntities.map((node) => node.x + node.width)) + 200
      : 160;
  const baseEntityY =
    lockedEntities.length > 0
      ? snapValue(lockedEntities.reduce((sum, node) => sum + node.y, 0) / lockedEntities.length, GRID_SIZE)
      : 240;

  entityNodes.forEach((entity) => {
    if (lockedNodeIds.has(entity.id)) {
      return;
    }

    const placed = {
      ...entity,
      x: snapValue(nextEntityX, GRID_SIZE),
      y: snapValue(baseEntityY, GRID_SIZE),
    };

    nextEntityX = placed.x + placed.width + 80;
    setNode(placed);
  });

  const relationshipNodes = [...diagram.nodes]
    .filter((node): node is Extract<DiagramNode, { type: "relationship" }> => node.type === "relationship")
    .sort(compareNodes);
  let fallbackRelationX = 200;
  let fallbackRelationY = baseEntityY - 140;

  relationshipNodes.forEach((relationship) => {
    if (lockedNodeIds.has(relationship.id)) {
      return;
    }

    const connectedEntities = diagram.edges
      .filter(
        (edge) =>
          edge.type === "connector" &&
          (edge.sourceId === relationship.id || edge.targetId === relationship.id),
      )
      .map((edge) => (edge.sourceId === relationship.id ? edge.targetId : edge.sourceId))
      .map((entityId) => getNode(entityId))
      .filter((node): node is Extract<DiagramNode, { type: "entity" }> => node.type === "entity");

    if (connectedEntities.length > 0) {
      const averageCenterX =
        connectedEntities.reduce((sum, node) => sum + node.x + node.width / 2, 0) /
        connectedEntities.length;
      const minY = Math.min(...connectedEntities.map((node) => node.y));

      setNode({
        ...relationship,
        x: snapValue(averageCenterX - relationship.width / 2, GRID_SIZE),
        y: snapValue(Math.max(60, minY - 140), GRID_SIZE),
      });
      return;
    }

    const placed = {
      ...relationship,
      x: snapValue(fallbackRelationX, GRID_SIZE),
      y: snapValue(fallbackRelationY, GRID_SIZE),
    };

    fallbackRelationX = placed.x + placed.width + 120;
    fallbackRelationY = baseEntityY + 180;
    setNode(placed);
  });

  const attributesByHostId = new Map<string, Array<Extract<DiagramNode, { type: "attribute" }>>>();

  [...diagram.nodes]
    .filter((node): node is Extract<DiagramNode, { type: "attribute" }> => node.type === "attribute")
    .sort(compareNodes)
    .forEach((attribute) => {
      const hostId = hostByAttributeId.get(attribute.id);
      if (!hostId) {
        return;
      }

      const bucket = attributesByHostId.get(hostId) ?? [];
      bucket.push(attribute);
      attributesByHostId.set(hostId, bucket);
    });

  function positionHostedAttributes(
    hostId: string,
    attributes: Array<Extract<DiagramNode, { type: "attribute" }>>,
  ) {
    const host = getNode(hostId);
    let identifierIndex = 0;
    let regularIndex = 0;
    let compositeIndex = 0;

    attributes.forEach((attribute) => {
      if (lockedNodeIds.has(attribute.id)) {
        return;
      }

      let x = host.x + host.width + 80;
      let y = host.y + regularIndex * 56;

      if (attribute.isIdentifier === true) {
        x = host.x - attribute.width - 80;
        y = host.y + identifierIndex * 56;
        identifierIndex += 1;
      } else if (attribute.isCompositeInternal === true) {
        x = host.x + host.width / 2 - attribute.width / 2 + compositeIndex * 24;
        y = host.y + host.height + 80 + compositeIndex * 44;
        compositeIndex += 1;
      } else {
        regularIndex += 1;
      }

      setNode({
        ...attribute,
        x: snapValue(x, GRID_SIZE),
        y: snapValue(y, GRID_SIZE),
      });
    });
  }

  attributesByHostId.forEach((attributes, hostId) => {
    const host = getNode(hostId);
    if (host.type === "attribute") {
      return;
    }

    positionHostedAttributes(hostId, attributes);
  });

  const pendingAttributeHosts = new Map(
    [...attributesByHostId.entries()].filter(([hostId]) => getNode(hostId).type === "attribute"),
  );

  let guard = 0;
  while (pendingAttributeHosts.size > 0 && guard < pendingAttributeHosts.size + 4) {
    let progressed = false;

    [...pendingAttributeHosts.entries()].forEach(([hostId, attributes]) => {
      const host = getNode(hostId);
      const hostPlaced = lockedNodeIds.has(hostId) || nextNodes.has(hostId);

      if (!hostPlaced) {
        return;
      }

      positionHostedAttributes(hostId, attributes);
      pendingAttributeHosts.delete(hostId);
      progressed = true;
    });

    if (!progressed) {
      break;
    }

    guard += 1;
  }

  pendingAttributeHosts.forEach((attributes, hostId) => {
    positionHostedAttributes(hostId, attributes);
  });

  const orphanAttributes = [...diagram.nodes]
    .filter(
      (node): node is Extract<DiagramNode, { type: "attribute" }> =>
        node.type === "attribute" && !hostByAttributeId.has(node.id),
    )
    .sort(compareNodes);
  let orphanAttributeX = 160;
  const orphanAttributeY = baseEntityY + 260;

  orphanAttributes.forEach((attribute) => {
    if (lockedNodeIds.has(attribute.id)) {
      return;
    }

    setNode({
      ...attribute,
      x: snapValue(orphanAttributeX, GRID_SIZE),
      y: snapValue(orphanAttributeY, GRID_SIZE),
    });
    orphanAttributeX += attribute.width + 60;
  });

  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => nextNodes.get(node.id) ?? node),
  };
}

function parseLegacyErsDiagram(rawSource: string): DiagramDocument {
  const lines = rawSource.split(/\r?\n/);
  const parsedNodes: ParsedNodeSpec[] = [];
  const parsedEdges: ParsedEdgeSpec[] = [];
  const parsedInternalIdentifiers: ParsedInternalIdentifierSpec[] = [];
  const parsedExternalIdentifiers: ParsedExternalIdentifierSpec[] = [];
  const parsedDesignerIdentifiers: ParsedDesignerIdentifierSpec[] = [];
  const parsedDesignerExternalAttributes: ParsedDesignerExternalAttributeSpec[] = [];
  const parsedGeneralizationGroups: ParsedGeneralizationGroupSpec[] = [];
  const aliasMap = new Map<string, ParsedNodeSpec>();
  let diagramName = "Diagramma ER";
  const explicitNotesChunks: string[] = [];
  const migratedLegacyTextNotes: string[] = [];

  lines.forEach((lineText, index) => {
    const line = index + 1;
    const normalized = normalizeCommentFreeLine(lineText);

    if (normalized.length === 0) {
      return;
    }

    const tokens = tokenizeLine(normalized);
    if (tokens.length === 0) {
      return;
    }

    const keyword = tokens[0];

    if (keyword === "diagram") {
      if (tokens.length < 2) {
        throw new ErsParseError(line, "La direttiva diagram richiede un nome.");
      }
      diagramName = readStringValue(tokens, { index: 1 }, line, "Nome diagramma mancante.");
      return;
    }

    if (keyword === "notes") {
      const note = parseNotesDirective(tokens, line);
      if (note.length > 0) {
        explicitNotesChunks.push(note);
      }
      return;
    }

    if (keyword === "text") {
      const migratedNote = parseLegacyTextDirectiveAsNote(tokens, line);
      if (migratedNote.length > 0) {
        migratedLegacyTextNotes.push(migratedNote);
      }
      return;
    }

    if (
      ["entity", "relationship", "attribute", "identifier", "composite", "multivalued"].includes(
        keyword,
      )
    ) {
      const parsedNode = parseNodeStatement(
        keyword === "identifier" || keyword === "composite" || keyword === "multivalued"
          ? "attribute"
          : (keyword as NodeKind),
        tokens,
        line,
        keyword === "identifier"
          ? { isIdentifier: true }
          : keyword === "composite"
            ? { isCompositeInternal: true }
            : keyword === "multivalued"
              ? { isMultivalued: true }
              : undefined,
      );
      if (aliasMap.has(parsedNode.alias)) {
        throw new ErsParseError(line, `Nome elemento duplicato: "${parsedNode.alias}".`);
      }
      parsedNodes.push(parsedNode);
      aliasMap.set(parsedNode.alias, parsedNode);
      return;
    }

    if (keyword === "connector" || keyword === "attribute-link" || keyword === "inheritance") {
      const edgeType = keyword === "attribute-link" ? "attribute" : (keyword as EdgeKind);
      parsedEdges.push(parseEdgeStatement(edgeType, tokens, line));
      return;
    }

    if (keyword === "internal-identifier" || keyword === "internalIdentifier") {
      parsedInternalIdentifiers.push(parseInternalIdentifierStatement(tokens, line));
      return;
    }

    if (keyword === "external-identifier" || keyword === "externalIdentifier") {
      parsedExternalIdentifiers.push(parseExternalIdentifierStatement(tokens, line));
      return;
    }

    if (keyword === "designer-identifier") {
      parsedDesignerIdentifiers.push(parseDesignerIdentifierStatement(tokens, line));
      return;
    }

    if (keyword === "designer-external-attribute") {
      parsedDesignerExternalAttributes.push(parseDesignerExternalAttributeStatement(tokens, line));
      return;
    }

    if (keyword === "generalization-group" || keyword === "generalizationGroup") {
      parsedGeneralizationGroups.push(parseGeneralizationGroupStatement(tokens, line));
      return;
    }

    throw new ErsParseError(line, `Istruzione non riconosciuta: "${keyword}".`);
  });

  const inferredDesignerExternalIdentifiers: Array<{
    line: number;
    hostEntityAlias: string;
    relationshipAliases: string[];
    localAttributeAliases: string[];
  }> = [];

  const ensureDesignerLocalAttribute = (entityAlias: string, localAlias: string, line: number): string => {
    assertUnqualifiedAlias(localAlias, line, "Il nome attributo");
    resolveNodeAlias(entityAlias, aliasMap, line, "entity");
    const qualifiedAlias = qualifyAttributeAlias(entityAlias, localAlias);
    const existing = aliasMap.get(qualifiedAlias);

    if (existing && existing.node.type !== "attribute") {
      throw new ErsParseError(line, `"${qualifiedAlias}" deve essere un attributo.`);
    }

    if (!existing) {
      const node = createNodeBase(qualifiedAlias, "attribute");
      node.label = localAlias;
      const parsedNode = {
        line,
        alias: qualifiedAlias,
        node,
      };
      parsedNodes.push(parsedNode);
      aliasMap.set(qualifiedAlias, parsedNode);
    }

    const hasLink = parsedEdges.some(
      (edge) =>
        edge.type === "attribute" &&
        ((edge.sourceAlias === qualifiedAlias && edge.targetAlias === entityAlias) ||
          (edge.sourceAlias === entityAlias && edge.targetAlias === qualifiedAlias)),
    );
    if (!hasLink) {
      parsedEdges.push({
        line,
        type: "attribute",
        sourceAlias: qualifiedAlias,
        targetAlias: entityAlias,
        label: "",
        lineStyle: "solid",
      });
    }

    return qualifiedAlias;
  };

  const relationshipAliases = new Set(
    parsedNodes
      .filter((entry) => entry.node.type === "relationship")
      .map((entry) => entry.alias),
  );

  parsedDesignerIdentifiers.forEach((spec) => {
    const localAttributeAliases: string[] = [];
    const identifierRelationshipAliases: string[] = [];

    spec.itemAliases.forEach((itemAlias) => {
      if (relationshipAliases.has(itemAlias)) {
        identifierRelationshipAliases.push(itemAlias);
        return;
      }

      localAttributeAliases.push(ensureDesignerLocalAttribute(spec.entityAlias, itemAlias, spec.line));
    });

    if (identifierRelationshipAliases.length === 0) {
      parsedInternalIdentifiers.push({
        line: spec.line,
        entityAlias: spec.entityAlias,
        attributeAliases: localAttributeAliases,
      });
      return;
    }

    inferredDesignerExternalIdentifiers.push({
      line: spec.line,
      hostEntityAlias: spec.entityAlias,
      relationshipAliases: identifierRelationshipAliases,
      localAttributeAliases,
    });
  });

  const designerExternalLocalAttributeAliasesByEntityAlias = new Map<string, string[]>();
  parsedDesignerExternalAttributes.forEach((spec) => {
    const qualifiedAlias = ensureDesignerLocalAttribute(spec.entityAlias, spec.attributeAlias, spec.line);
    const bucket = designerExternalLocalAttributeAliasesByEntityAlias.get(spec.entityAlias) ?? [];
    if (!bucket.includes(qualifiedAlias)) {
      bucket.push(qualifiedAlias);
    }
    designerExternalLocalAttributeAliasesByEntityAlias.set(spec.entityAlias, bucket);
  });

  const occurrenceByKey = new Map<string, number>();
  const parsedNodeById = new Map(parsedNodes.map((entry) => [entry.node.id, entry.node]));
  const designerExternalConnectors: Array<{
    line: number;
    relationshipId: string;
    hostEntityId: string;
    hostEntityAlias: string;
  }> = [];
  const edges: DiagramEdge[] = parsedEdges.map((edgeSpec) => {
    const sourceNode = resolveNodeAlias(edgeSpec.sourceAlias, aliasMap, edgeSpec.line);
    const targetNode = resolveNodeAlias(edgeSpec.targetAlias, aliasMap, edgeSpec.line);

    if (!canConnect(edgeSpec.type, sourceNode, targetNode)) {
      throw new ErsParseError(
        edgeSpec.line,
        `Il collegamento tra "${edgeSpec.sourceAlias}" e "${edgeSpec.targetAlias}" non e compatibile.`,
      );
    }

    const key = `${edgeSpec.type}:${sourceNode.id}:${targetNode.id}`;
    const occurrence = (occurrenceByKey.get(key) ?? 0) + 1;
    occurrenceByKey.set(key, occurrence);

    const baseEdge = {
      id: buildEdgeId(edgeSpec.type, sourceNode.id, targetNode.id, occurrence),
      sourceId: sourceNode.id,
      targetId: targetNode.id,
      label: edgeSpec.label,
      lineStyle: edgeSpec.lineStyle,
      ...(typeof edgeSpec.manualOffset === "number" ? { manualOffset: edgeSpec.manualOffset } : {}),
    };

    if (edgeSpec.type === "inheritance") {
      return {
        ...baseEdge,
        type: "inheritance" as const,
        isaDisjointness: edgeSpec.isaDisjointness,
        isaCompleteness: edgeSpec.isaCompleteness,
        generalizationGroupId: edgeSpec.generalizationGroupAlias,
      };
    }

    if (edgeSpec.type === "attribute") {
      const normalizedCardinality = normalizeSupportedCardinality(edgeSpec.cardinality);
      if (
        edgeSpec.cardinality &&
        normalizedCardinality === undefined &&
        edgeSpec.cardinality !== CONNECTOR_CARDINALITY_PLACEHOLDER
      ) {
        throw new ErsParseError(edgeSpec.line, `Cardinalita attributo non valida: "${edgeSpec.cardinality}".`);
      }

      const attributeOwner = getAttributeCardinalityOwner(sourceNode, targetNode);
      const parsedAttributeNode = attributeOwner ? parsedNodeById.get(attributeOwner.id) : undefined;
      if (parsedAttributeNode?.type === "attribute" && normalizedCardinality !== undefined) {
        parsedAttributeNode.cardinality = normalizedCardinality;
      }

      return {
        ...baseEdge,
        type: "attribute" as const,
      };
    }

    const normalizedCardinality = normalizeSupportedCardinality(edgeSpec.cardinality);
    if (
      edgeSpec.cardinality &&
      normalizedCardinality === undefined &&
      edgeSpec.cardinality !== CONNECTOR_CARDINALITY_PLACEHOLDER
    ) {
      throw new ErsParseError(edgeSpec.line, `Cardinalita connettore non valida: "${edgeSpec.cardinality}".`);
    }

    const connectorContext = getConnectorParticipationContext(sourceNode, targetNode);
    let participationId: string | undefined;
    if (connectorContext) {
      const entityNode = parsedNodeById.get(connectorContext.entity.id);
      if (entityNode?.type === "entity") {
        const participation: EntityRelationshipParticipation = {
          id: createGeneratedId("participation"),
          relationshipId: connectorContext.relationship.id,
          cardinality: normalizedCardinality,
          ...(edgeSpec.role && edgeSpec.role.trim().length > 0 ? { role: edgeSpec.role.trim() } : {}),
        };
        entityNode.relationshipParticipations = [...(entityNode.relationshipParticipations ?? []), participation];
        participationId = participation.id;
        if (edgeSpec.isExternalIdentifierHost) {
          designerExternalConnectors.push({
            line: edgeSpec.line,
            relationshipId: connectorContext.relationship.id,
            hostEntityId: connectorContext.entity.id,
            hostEntityAlias: sourceNode.id === connectorContext.entity.id ? edgeSpec.sourceAlias : edgeSpec.targetAlias,
          });
        }
      }
    }

    return {
      ...baseEdge,
      type: "connector" as const,
      participationId,
    };
  });

  const directAttributeIdsByEntityId = new Map<string, Set<string>>();
  edges.forEach((edge) => {
    if (edge.type !== "attribute") {
      return;
    }

    const sourceNode = parsedNodeById.get(edge.sourceId);
    const targetNode = parsedNodeById.get(edge.targetId);

    if (sourceNode?.type === "entity" && targetNode?.type === "attribute") {
      const bucket = directAttributeIdsByEntityId.get(sourceNode.id) ?? new Set<string>();
      bucket.add(targetNode.id);
      directAttributeIdsByEntityId.set(sourceNode.id, bucket);
      return;
    }

    if (targetNode?.type === "entity" && sourceNode?.type === "attribute") {
      const bucket = directAttributeIdsByEntityId.get(targetNode.id) ?? new Set<string>();
      bucket.add(sourceNode.id);
      directAttributeIdsByEntityId.set(targetNode.id, bucket);
    }
  });

  const internalIdentifierCountersByEntityId = new Map<string, number>();
  const internalIdentifiersByEntityId = new Map<string, InternalIdentifier[]>();

  parsedInternalIdentifiers.forEach((spec) => {
    const entity = resolveNodeAlias(spec.entityAlias, aliasMap, spec.line, "entity");
    const directAttributeIds = directAttributeIdsByEntityId.get(entity.id) ?? new Set<string>();
    const attributeIds = spec.attributeAliases
      .map((attributeAlias) => resolveNodeAlias(attributeAlias, aliasMap, spec.line, "attribute").id)
      .filter((attributeId, index, source) => source.indexOf(attributeId) === index);

    if (attributeIds.length === 0) {
      return;
    }

    const invalidAttributeId = attributeIds.find((attributeId) => !directAttributeIds.has(attributeId));
    if (invalidAttributeId) {
      const invalidAlias = spec.attributeAliases[attributeIds.indexOf(invalidAttributeId)] ?? invalidAttributeId;
      throw new ErsParseError(
        spec.line,
        `L'attributo "${invalidAlias}" deve essere collegato direttamente a "${spec.entityAlias}".`,
      );
    }

    const nextCounter = (internalIdentifierCountersByEntityId.get(entity.id) ?? 0) + 1;
    internalIdentifierCountersByEntityId.set(entity.id, nextCounter);

    const nextIdentifiers = internalIdentifiersByEntityId.get(entity.id) ?? [];
    nextIdentifiers.push({
      id: `internalIdentifier-ers-${entity.id}-${nextCounter}`,
      attributeIds,
    });
    internalIdentifiersByEntityId.set(entity.id, nextIdentifiers);
  });

  parsedNodes.forEach((entry) => {
    if (entry.node.type !== "relationship" || !entry.externalSpec || !entry.externalSpec.hostEntityAlias) {
      return;
    }

    parsedExternalIdentifiers.push({
      line: entry.line,
      relationshipAlias: entry.alias,
      hostEntityAlias: entry.externalSpec.hostEntityAlias,
      importedAttributeAliases: entry.externalSpec.importedAttributeAliases,
      localAttributeAliases: entry.externalSpec.localAttributeAliases,
      offset: entry.externalSpec.offset,
      markerOffsetX: entry.externalSpec.markerOffsetX,
      markerOffsetY: entry.externalSpec.markerOffsetY,
    });
  });

  const nodes = parsedNodes.map((entry) => {
    if (entry.node.type === "entity") {
      const internalIdentifiers = internalIdentifiersByEntityId.get(entry.node.id);
      if (internalIdentifiers && internalIdentifiers.length > 0) {
        return {
          ...entry.node,
          internalIdentifiers,
        };
      }

      return entry.node;
    }

    return entry.node;
  });

  const entityNodeById = new Map(
    nodes.filter((node): node is Extract<DiagramNode, { type: "entity" }> => node.type === "entity").map((node) => [node.id, node]),
  );

  const inferImportedIdentifierPart = (
    line: number,
    relationshipId: string,
    hostEntityId: string,
  ): { sourceEntity: Extract<DiagramNode, { type: "entity" }>; importedIdentifier: InternalIdentifier } => {
    const connectedEntityIds = edges
      .filter((edge): edge is Extract<DiagramEdge, { type: "connector" }> => edge.type === "connector")
      .filter((edge) => edge.sourceId === relationshipId || edge.targetId === relationshipId)
      .map((edge) => (edge.sourceId === relationshipId ? edge.targetId : edge.sourceId))
      .filter((entityId, index, source) => entityId !== hostEntityId && source.indexOf(entityId) === index);

    const candidates = connectedEntityIds
      .map((entityId) => entityNodeById.get(entityId))
      .filter((entity): entity is Extract<DiagramNode, { type: "entity" }> =>
        Boolean(entity && (entity.internalIdentifiers ?? []).length > 0),
      );

    if (candidates.length === 0) {
      throw new ErsParseError(
        line,
        "Impossibile inferire l'identificatore importato: nessuna entita collegata possiede un identificatore interno.",
      );
    }

    if (candidates.length > 1) {
      throw new ErsParseError(
        line,
        "Identificatore esterno ambiguo: piu entita collegate possiedono un identificatore interno.",
      );
    }

    const sourceEntity = candidates[0];
    const importedIdentifier = sourceEntity.internalIdentifiers?.[0];
    if (!importedIdentifier) {
      throw new ErsParseError(
        line,
        `Impossibile inferire l'identificatore importato da "${sourceEntity.label}".`,
      );
    }

    return { sourceEntity, importedIdentifier };
  };

  const hasExternalIdentifier = (
    hostEntity: Extract<DiagramNode, { type: "entity" }>,
    importedParts: ExternalIdentifier["importedParts"],
    localAttributeIds: string[],
  ): boolean =>
    (hostEntity.externalIdentifiers ?? []).some((identifier) => {
      if (identifier.localAttributeIds.length !== localAttributeIds.length) {
        return false;
      }

      if (identifier.importedParts.length !== importedParts.length) {
        return false;
      }

      const hasSameLocalAttributes = localAttributeIds.every((attributeId) =>
        identifier.localAttributeIds.includes(attributeId),
      );
      const hasSameImportedParts = importedParts.every((part) =>
        identifier.importedParts.some(
          (candidate) =>
            candidate.relationshipId === part.relationshipId &&
            candidate.sourceEntityId === part.sourceEntityId &&
            candidate.importedIdentifierId === part.importedIdentifierId,
        ),
      );

      return hasSameLocalAttributes && hasSameImportedParts;
    });

  parsedExternalIdentifiers.forEach((spec, index) => {
    const relationship = resolveNodeAlias(spec.relationshipAlias, aliasMap, spec.line, "relationship");
    const hostEntity = resolveNodeAlias(spec.hostEntityAlias, aliasMap, spec.line, "entity");
    const importedAttributes = spec.importedAttributeAliases.map((attributeAlias) =>
      resolveNodeAlias(attributeAlias, aliasMap, spec.line, "attribute"),
    );
    const localAttributes = spec.localAttributeAliases.map((attributeAlias) =>
      resolveNodeAlias(attributeAlias, aliasMap, spec.line, "attribute"),
    );
    const sourceEntityAliases = new Set(spec.importedAttributeAliases.map((attributeAlias) => attributeAlias.split(".")[0]));
    if (sourceEntityAliases.size > 1) {
      throw new ErsParseError(spec.line, "Le parti importate devono appartenere alla stessa entita sorgente.");
    }

    const [sourceEntityAlias] = Array.from(sourceEntityAliases);
    if (!sourceEntityAlias) {
      throw new ErsParseError(spec.line, "Impossibile risolvere l'entita sorgente dell'identificatore esterno.");
    }

    const sourceEntity = resolveNodeAlias(sourceEntityAlias, aliasMap, spec.line, "entity");

    const importedAttributeIds = importedAttributes.map((attribute) => attribute.id);
    const importedIdentifier = (entityNodeById.get(sourceEntity.id)?.internalIdentifiers ?? []).find((identifier) => {
      if (identifier.attributeIds.length !== importedAttributeIds.length) {
        return false;
      }

      return identifier.attributeIds.every((attributeId, attributeIndex) => importedAttributeIds[attributeIndex] === attributeId);
    });
    if (!importedIdentifier) {
      throw new ErsParseError(
        spec.line,
        `Nessun identificatore interno di "${sourceEntity.label}" corrisponde alla parte importata indicata.`,
      );
    }

    const hostEntityNode = entityNodeById.get(hostEntity.id);
    if (!hostEntityNode) {
      throw new ErsParseError(spec.line, `Entita host non trovata: "${spec.hostEntityAlias}".`);
    }

    hostEntityNode.externalIdentifiers = [
      ...(hostEntityNode.externalIdentifiers ?? []),
      {
        id: `externalIdentifier-ers-${hostEntityNode.id}-${index + 1}`,
        importedParts: [
          {
            id: `externalIdentifierPart-ers-${hostEntityNode.id}-${index + 1}`,
            relationshipId: relationship.id,
            sourceEntityId: sourceEntity.id,
            importedIdentifierId: importedIdentifier.id,
          },
        ],
        localAttributeIds: localAttributes.map((attribute) => attribute.id),
        offset: spec.offset,
        markerOffsetX: spec.markerOffsetX,
        markerOffsetY: spec.markerOffsetY,
      } as ExternalIdentifier,
    ];
  });

  inferredDesignerExternalIdentifiers.forEach((spec, index) => {
    const hostEntity = resolveNodeAlias(spec.hostEntityAlias, aliasMap, spec.line, "entity");
    const hostEntityNode = entityNodeById.get(hostEntity.id);
    if (!hostEntityNode) {
      throw new ErsParseError(spec.line, `Entita host non trovata: "${spec.hostEntityAlias}".`);
    }

    const localAttributeIds = spec.localAttributeAliases
      .map((attributeAlias) => resolveNodeAlias(attributeAlias, aliasMap, spec.line, "attribute").id)
      .filter((attributeId, attributeIndex, source) => source.indexOf(attributeId) === attributeIndex);
    const importedParts = spec.relationshipAliases
      .filter((relationshipAlias, relationshipIndex, source) => source.indexOf(relationshipAlias) === relationshipIndex)
      .map((relationshipAlias, relationshipIndex) => {
        const relationship = resolveNodeAlias(relationshipAlias, aliasMap, spec.line, "relationship");
        const { sourceEntity, importedIdentifier } = inferImportedIdentifierPart(
          spec.line,
          relationship.id,
          hostEntity.id,
        );
        return {
          id: `externalIdentifierPart-designer-${hostEntityNode.id}-${index + 1}-${relationshipIndex + 1}`,
          relationshipId: relationship.id,
          sourceEntityId: sourceEntity.id,
          importedIdentifierId: importedIdentifier.id,
        };
      });

    if (hasExternalIdentifier(hostEntityNode, importedParts, localAttributeIds)) {
      return;
    }

    hostEntityNode.externalIdentifiers = [
      ...(hostEntityNode.externalIdentifiers ?? []),
      {
        id: `externalIdentifier-designer-${hostEntityNode.id}-${index + 1}`,
        importedParts,
        localAttributeIds,
      } as ExternalIdentifier,
    ];
  });

  designerExternalConnectors.forEach((spec, index) => {
    const hostEntityNode = entityNodeById.get(spec.hostEntityId);
    if (!hostEntityNode) {
      return;
    }

    let inferredPart: { sourceEntity: Extract<DiagramNode, { type: "entity" }>; importedIdentifier: InternalIdentifier };
    try {
      inferredPart = inferImportedIdentifierPart(spec.line, spec.relationshipId, spec.hostEntityId);
    } catch (error) {
      if (error instanceof ErsParseError) {
        return;
      }
      throw error;
    }
    const { sourceEntity, importedIdentifier } = inferredPart;
    const localAttributeIds = (designerExternalLocalAttributeAliasesByEntityAlias.get(spec.hostEntityAlias) ?? [])
      .map((attributeAlias) => resolveNodeAlias(attributeAlias, aliasMap, spec.line, "attribute").id)
      .filter((attributeId, attributeIndex, source) => source.indexOf(attributeId) === attributeIndex);
    const importedParts = [
      {
        id: `externalIdentifierPart-designer-${hostEntityNode.id}-${index + 1}`,
        relationshipId: spec.relationshipId,
        sourceEntityId: sourceEntity.id,
        importedIdentifierId: importedIdentifier.id,
      },
    ];

    if (hasExternalIdentifier(hostEntityNode, importedParts, localAttributeIds)) {
      return;
    }

    hostEntityNode.externalIdentifiers = [
      ...(hostEntityNode.externalIdentifiers ?? []),
      {
        id: `externalIdentifier-designer-${hostEntityNode.id}-${index + 1}`,
        importedParts,
        localAttributeIds,
      } as ExternalIdentifier,
    ];
  });

  const generalizationGroups: GeneralizationGroup[] = parsedGeneralizationGroups
    .map((spec) => {
      const supertype = resolveNodeAlias(spec.supertypeAlias, aliasMap, spec.line, "entity");
      const subtypeIds = edges
        .filter((edge): edge is Extract<DiagramEdge, { type: "inheritance" }> => edge.type === "inheritance")
        .filter((edge) => edge.generalizationGroupId === spec.alias && edge.targetId === supertype.id)
        .map((edge) => edge.sourceId);
      return {
        id: spec.alias,
        supertypeId: supertype.id,
        subtypeIds,
        isaCompleteness: spec.isaCompleteness,
        isaDisjointness: spec.isaDisjointness,
        label: spec.label,
      };
    })
    .filter((group) => group.subtypeIds.length > 0);

  const diagram: DiagramDocument = {
    meta: {
      name: diagramName,
      version: 1,
    },
    notes: mergeParsedNotes(
      normalizeNotesContent(explicitNotesChunks.join("\n\n")),
      formatLegacyTextNotes(migratedLegacyTextNotes),
    ),
    nodes,
    edges,
    generalizationGroups,
  };

  let normalizedDiagram = normalizeGeneralizationGroups(diagram);
  normalizedDiagram = cleanupGeneralizationReferences(normalizedDiagram);
  const issues = validateDiagram(normalizedDiagram).filter((issue) => issue.level === "error");
  if (issues.length > 0) {
    throw new Error(issues[0].message);
  }

  return normalizedDiagram;
}

function mergeDiagramConfiguration(
  parsedDiagram: DiagramDocument,
  existingDiagram?: DiagramDocument,
): DiagramDocument {
  if (!existingDiagram) {
    return autoPlaceDiagram(parsedDiagram, new Set<string>());
  }

  const parsedAliasByNodeId = assignNodeAliases(parsedDiagram);
  const existingAliasByNodeId = assignNodeAliases(existingDiagram);
  const existingNodeByAlias = new Map<string, DiagramNode>();

  existingDiagram.nodes.forEach((node) => {
    const alias = existingAliasByNodeId.get(node.id);
    if (alias) {
      existingNodeByAlias.set(alias, node);
    }
  });

  const lockedNodeIds = new Set<string>();
  const nodes = parsedDiagram.nodes.map((node) => {
    const alias = parsedAliasByNodeId.get(node.id) ?? node.id;
    const existingNode = existingNodeByAlias.get(alias);

    if (!existingNode || existingNode.type !== node.type) {
      return node;
    }

    lockedNodeIds.add(node.id);
    return {
      ...node,
      x: existingNode.x,
      y: existingNode.y,
      width: existingNode.width,
      height: existingNode.height,
      ...(node.type === "attribute" &&
      existingNode.type === "attribute" &&
      node.cardinality == null &&
      existingNode.cardinality != null
        ? { cardinality: existingNode.cardinality }
        : {}),
    };
  });

  const parsedWithNodeConfig = {
    ...parsedDiagram,
    nodes,
  };

  const existingEdgesByKey = queueExistingEdgesByKey(existingDiagram);
  const parsedAliasMap = assignNodeAliases(parsedWithNodeConfig);
  const edges = parsedWithNodeConfig.edges.map((edge) => {
    const key = buildEdgeMatchKey(edge, parsedAliasMap);
    const bucket = existingEdgesByKey.get(key);
    const existingEdge = bucket?.shift();

    if (!existingEdge) {
      return edge;
    }

    return {
      ...edge,
      label: edge.label || existingEdge.label,
      lineStyle: existingEdge.lineStyle,
      manualOffset: existingEdge.manualOffset,
    };
  });

  return autoPlaceDiagram(
    {
      ...parsedWithNodeConfig,
      edges,
    },
    lockedNodeIds,
  );
}

export function parseErsDiagram(rawSource: string, existingDiagram?: DiagramDocument): DiagramDocument {
  const expanded = expandStructuredErs(rawSource);

  try {
    const parsed = parseLegacyErsDiagram(expanded.source);
    return mergeDiagramConfiguration(parsed, existingDiagram);
  } catch (error) {
    if (error instanceof ErsParseError) {
      const mappedLine = expanded.lineMap[error.line - 1] ?? error.line;
      throw new ErsParseError(mappedLine, error.detail);
    }

    throw error;
  }
}
