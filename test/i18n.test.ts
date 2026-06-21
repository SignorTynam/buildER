import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getCurrentLocale,
  setCurrentLocale,
  translate,
  type Locale,
  type PluralMessage,
} from "../src/i18n/index.ts";
import { en } from "../src/i18n/messages/en.ts";
import { it } from "../src/i18n/messages/it.ts";
import { sq } from "../src/i18n/messages/sq.ts";

type RawMessages = Record<string, unknown>;
type LeafValue = string | PluralMessage;

const rawMessagesByLocale: Record<Locale, RawMessages> = { it, en, sq };
const IMPORTANT_LOCALIZED_KEYS = [
  "app.updateFallback.patchHeadline",
  "appHeader.actions.newProject",
  "appHeader.actions.openProject",
  "commandMenu.title",
  "commandMenu.searchPlaceholder",
  "commandMenu.emptyTitle",
  "commandMenu.categories.language",
  "commandMenu.language.active",
  "commandMenu.language.change",
  "loading.status",
  "loading.tipLabel",
  "logical.noItemsThisStep",
  "translation.restructuring.stageLabel",
  "toolbar.commands.select.label",
  "notesPanel.description",
  "cardinalityModal.title",
  "sqlReverse.input.analyze",
  "logical.entityKeyModal.title",
  "canvas.externalIdentifier.importsFrom",
] as const;
const NEW_I18N_SECTIONS = [
  "toolbar.commands.select.label",
  "toolbar.commands.pan.aria",
  "toolbar.commands.compositeId.sameEntity",
  "toolbar.commands.externalIdUnified.label",
  "toolbar.commands.deleteIdentifier.label",
  "toolbar.commands.deleteIdentifier.title",
  "workspace.identifierAlreadyExistsUseDelete",
  "toolbar.export.diagramCode",
  "toolbar.export.jpeg",
  "commandMenu.commands.fileExportJpeg.label",
  "notesPanel.toolbar.bold",
  "notesPanel.toolbar.orderedList",
  "notesPanel.toolbar.clearFormatting",
  "codePanel.closeAria",
  "cardinalityModal.primary.createConnector",
  "cardinalityModal.presets.requiredMany",
  "cardinalityModal.subtitle.editConnector",
  "sqlReverse.input.warningSummary",
  "sqlReverse.input.tablesCount",
  "sqlReverse.preview.logicalTitle",
  "sqlReverse.app.importedTables",
  "logical.toolbars.translationTools",
  "logical.export.project",
  "logical.export.jpeg",
  "logical.designer.showForeignKeys",
  "logical.designer.hideForeignKeys",
  "logical.designer.showForeignKeyLabelsTitle",
  "logical.designer.hideForeignKeyLabelsTitle",
  "logical.entityKeyModal.applyFixEntities",
  "errors.structured.template",
  "connection.errors.invalidConnector",
  "canvas.externalIdentifier.importsFrom",
] as const;
const CANVAS_I18N_KEYS = [
  "canvas.aria.zoomOut",
  "canvas.aria.resetZoom",
  "canvas.aria.zoomIn",
  "canvas.aria.fitContent",
  "canvas.aria.centerDiagram",
  "canvas.aria.resetViewport",
  "canvas.preview.entity",
  "canvas.preview.relationship",
  "canvas.status.sourceSelectedInheritance",
  "canvas.status.sourceSelectedConnector",
  "canvas.status.sourceSelectedDestination",
  "canvas.status.viewportCentered",
  "canvas.status.selectionFitted",
  "canvas.status.diagramFitted",
  "canvas.status.selectionCentered",
  "canvas.status.diagramCentered",
  "canvas.status.viewportReset",
  "canvas.status.zoom",
  "canvas.status.selectionMovedWithKeyboard",
  "canvas.status.connectorRoutingAutomatic",
  "canvas.status.externalIdentifierConnectorLocked",
  "canvas.status.connectorAdjustedWithKeyboard",
  "canvas.status.connectionCreationCancelled",
  "canvas.status.placementCancelled",
  "canvas.status.selectEntityOrRelationshipFirst",
  "canvas.status.internalIdentifierSelected",
  "canvas.status.externalIdentifierSelected",
  "canvas.status.compositeIdentifierDrag",
  "canvas.status.externalIdentifierRoutingDrag",
  "canvas.guidance.defaultMessage",
  "canvas.guidance.renameNodeTitle",
  "canvas.guidance.editIsaLabelTitle",
  "canvas.guidance.editingMessage",
  "canvas.guidance.routingConnectorTitle",
  "canvas.guidance.externalIdentifierTitle",
  "canvas.guidance.compositeIdentifierTitle",
  "canvas.guidance.routingConnectorMessage",
  "canvas.guidance.externalIdentifierRoutingMessage",
  "canvas.guidance.compositeIdentifierRoutingMessage",
  "canvas.guidance.placeEntityTitle",
  "canvas.guidance.placeRelationshipTitle",
  "canvas.guidance.placementMessage",
  "canvas.guidance.isaFlowTitle",
  "canvas.guidance.sourceTargetFlowTitle",
  "canvas.guidance.pendingSourceMessage",
  "canvas.guidance.externalIdentifierTargetMessage",
  "canvas.guidance.inheritanceTitle",
  "canvas.guidance.connectorTitle",
  "canvas.guidance.inheritanceSourceMessage",
  "canvas.guidance.connectorSourceMessage",
  "canvas.guidance.erCheckTitle",
  "canvas.guidance.moveMessage",
  "canvas.guidance.activeSelectionTitle",
  "canvas.guidance.activeSelectionMessage",
  "canvas.guidance.selectionTitle",
  "canvas.guidance.selectionMessage",
  "canvas.guidance.states.editingLabel",
  "canvas.guidance.states.draggingRouting",
  "canvas.guidance.states.placing",
  "canvas.guidance.states.selectingTarget",
  "canvas.guidance.states.selectingSource",
  "canvas.guidance.states.invalidAction",
  "canvas.guidance.shortcuts.homeCenter",
  "canvas.guidance.shortcuts.fit",
  "canvas.guidance.shortcuts.reset",
  "canvas.guidance.shortcuts.enterSave",
  "canvas.guidance.shortcuts.clickOutsideConfirm",
  "canvas.guidance.shortcuts.releaseToSave",
  "canvas.guidance.shortcuts.shiftArrowsWide",
  "canvas.guidance.shortcuts.escCancel",
  "canvas.guidance.shortcuts.clickCreate",
  "canvas.guidance.shortcuts.clickTargetComplete",
  "canvas.guidance.shortcuts.clickTargetCreate",
  "canvas.guidance.shortcuts.tabFocusNodes",
  "canvas.guidance.shortcuts.keepToolActive",
  "canvas.guidance.shortcuts.fixSelection",
  "canvas.guidance.shortcuts.checkRulesRail",
  "canvas.guidance.shortcuts.spaceDragPan",
  "canvas.guidance.shortcuts.zoom",
  "canvas.guidance.shortcuts.enterRename",
  "canvas.guidance.shortcuts.deleteRemove",
  "canvas.guidance.shortcuts.arrowsMove",
  "canvas.guidance.shortcuts.tabFocus",
  "canvas.guidance.shortcuts.shiftDragAdd",
  "canvas.flowPrompt.step2IsaTitle",
  "canvas.flowPrompt.step2ConnectorTitle",
  "canvas.flowPrompt.inheritanceBody",
  "canvas.flowPrompt.connectorBody",
  "canvas.flowPrompt.cancel",
  "canvas.flowPrompt.externalIdentifierTitle",
  "canvas.flowPrompt.externalIdentifierBody",
  "canvas.flowPrompt.deselect",
  "canvas.advancedAffordances.connectorLabel.label",
  "canvas.advancedAffordances.connectorLabel.hint",
  "canvas.advancedAffordances.externalIdentifierMarker.label",
  "canvas.advancedAffordances.externalIdentifierMarker.hint",
  "canvas.advancedAffordances.compositeIdentifier.label",
  "canvas.advancedAffordances.compositeIdentifier.hint",
  "canvas.externalIdentifier.aria",
  "canvas.externalIdentifier.importsFrom",
] as const;
const EXTERNAL_IDENTIFIER_SECTION_KEYS = [
  "inspector.externalIdentifierSection.title",
  "inspector.externalIdentifierSection.aria",
  "inspector.externalIdentifierSection.modalTitle",
  "inspector.externalIdentifierSection.close",
  "inspector.externalIdentifierSection.eligibleImportedParts",
  "inspector.externalIdentifierSection.importedPartOption",
  "inspector.externalIdentifierSection.noImportedParts",
  "inspector.externalIdentifierSection.hostLocalAttributes",
  "inspector.externalIdentifierSection.noLocalAttributes",
  "inspector.externalIdentifierSection.resultSummary",
  "inspector.externalIdentifierSection.cancel",
  "inspector.externalIdentifierSection.save",
  "inspector.externalIdentifierSection.edit",
  "inspector.externalIdentifierSection.delete",
  "inspector.externalIdentifierSection.empty",
  "inspector.externalIdentifierSection.add",
  "inspector.externalIdentifierSection.viaRelationship",
  "inspector.externalIdentifierSection.kindImportedOnly",
  "inspector.externalIdentifierSection.kindImportedLocal",
  "inspector.externalIdentifierSection.kindImportedOnlyLower",
  "inspector.externalIdentifierSection.kindImportedLocalLower",
] as const;
const CANVAS_HARDCODED_ITALIAN_PHRASES = [
  "Sorgente selezionata",
  "Seleziona prima",
  "Viewport centrata",
  "Diagramma adattato",
  "Identificatore esterno selezionato",
  "Controlli viewport",
  "Spazio + drag per pan",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPluralMessage(value: unknown): value is PluralMessage {
  return isRecord(value) && typeof value.other === "string";
}

function flattenLeaves(bundle: RawMessages, prefix = ""): Map<string, LeafValue> {
  const leaves = new Map<string, LeafValue>();

  for (const [key, value] of Object.entries(bundle)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" || isPluralMessage(value)) {
      leaves.set(path, value);
      continue;
    }

    if (isRecord(value)) {
      for (const [childPath, childValue] of flattenLeaves(value, path)) {
        leaves.set(childPath, childValue);
      }
    }
  }

  return leaves;
}

function getRawValue(locale: Locale, key: string): LeafValue | undefined {
  return flattenLeaves(rawMessagesByLocale[locale]).get(key);
}

function collectEmptyStrings(locale: Locale): string[] {
  return [...flattenLeaves(rawMessagesByLocale[locale]).entries()]
    .flatMap(([key, value]) => {
      if (typeof value === "string") {
        return value.trim() === "" ? [key] : [];
      }

      if (isPluralMessage(value)) {
        return Object.entries(value)
          .filter(([, message]) => typeof message === "string" && message.trim() === "")
          .map(([pluralKey]) => `${key}.${pluralKey}`);
      }

      return [];
    });
}

test("supported locales stay explicit and stable", () => {
  assert.deepEqual(SUPPORTED_LOCALES, ["it", "en", "sq"]);
  assert.equal(DEFAULT_LOCALE, "it");
});

test("English and Albanian raw dictionaries define every Italian leaf key", () => {
  const italianKeys = [...flattenLeaves(it).keys()];

  for (const locale of ["en", "sq"] as const) {
    const localeKeys = flattenLeaves(rawMessagesByLocale[locale]);
    const missing = italianKeys.filter((key) => !localeKeys.has(key));
    assert.deepEqual(missing, [], `${locale} is missing i18n keys`);
  }
});

test("localized dictionaries do not contain empty visible strings", () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.deepEqual(collectEmptyStrings(locale), [], `${locale} contains empty i18n strings`);
  }
});

test("identifier toolbar labels resolve for every locale", () => {
  const expectedExternalIdLabels: Record<Locale, string> = {
    it: "ID esterno",
    en: "External Id",
    sq: "ID i jashtëm",
  };
  const expectedDeleteIdentifierTitles: Record<Locale, string> = {
    it: "Elimina l'identificatore selezionato senza cancellare i suoi attributi",
    en: "Delete the selected identifier without deleting its attributes",
    sq: "Fshin identifikuesin e zgjedhur pa fshirë atributet e tij",
  };

  for (const locale of SUPPORTED_LOCALES) {
    setCurrentLocale(locale);
    assert.equal(translate("toolbar.commands.externalIdUnified.label"), expectedExternalIdLabels[locale]);
    assert.notEqual(translate("toolbar.commands.deleteIdentifier.label"), "toolbar.commands.deleteIdentifier.label");
    assert.equal(translate("toolbar.commands.deleteIdentifier.title"), expectedDeleteIdentifierTitles[locale]);
    assert.notEqual(
      translate("workspace.identifierAlreadyExistsUseDelete"),
      "workspace.identifierAlreadyExistsUseDelete",
    );
  }

  setCurrentLocale(DEFAULT_LOCALE);
});

test("important English and Albanian UI strings are not Italian fallbacks", () => {
  for (const locale of ["en", "sq"] as const) {
    const unchanged = IMPORTANT_LOCALIZED_KEYS.filter((key) => {
      const italianValue = getRawValue("it", key);
      const localeValue = getRawValue(locale, key);
      return typeof italianValue === "string" && typeof localeValue === "string" && italianValue === localeValue;
    });

    assert.deepEqual(unchanged, [], `${locale} has important strings still matching Italian`);
  }
});

test("plural and interpolation paths work for every locale", () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.match(translate("app.versionLabel", { version: "5.2" }, locale), /5\.2/);
    assert.match(translate("commandMenu.visibleCount", { count: 1 }, locale), /1/);
    assert.match(translate("commandMenu.visibleCount", { count: 2 }, locale), /2/);
  }
});

test("new localized UI sections resolve for every locale", () => {
  for (const locale of SUPPORTED_LOCALES) {
    for (const key of [...NEW_I18N_SECTIONS, ...CANVAS_I18N_KEYS, ...EXTERNAL_IDENTIFIER_SECTION_KEYS]) {
      const value = translate(key, { count: 2, current: 1, total: 3, sourceKind: "A", targetKind: "B", attributes: "id", entity: "User" }, locale);
      assert.notEqual(value, key, `${locale}.${key} was not resolved`);
      assert.notEqual(value.trim(), "", `${locale}.${key} resolved to an empty string`);
    }
  }
});

test("new canvas and external identifier keys exist in every raw locale", () => {
  for (const locale of SUPPORTED_LOCALES) {
    for (const key of [...CANVAS_I18N_KEYS, ...EXTERNAL_IDENTIFIER_SECTION_KEYS]) {
      assert.notEqual(getRawValue(locale, key), undefined, `${locale}.${key} is missing`);
    }
  }
});

test("missing keys still fall back to a readable placeholder", () => {
  const key = "canvas.staticFallbackProbe";
  const value = translate(key, undefined, "en");

  assert.ok(value === key || value === "static Fallback Probe");
});

test("DiagramCanvas does not keep known Italian UI phrases hardcoded", () => {
  const source = readFileSync(new URL("../src/canvas/DiagramCanvas.tsx", import.meta.url), "utf8");
  const remaining = CANVAS_HARDCODED_ITALIAN_PHRASES.filter((phrase) => source.includes(phrase));

  assert.deepEqual(remaining, []);
});

test("locale state can switch among all supported locales", () => {
  const originalLocale = getCurrentLocale();

  try {
    for (const locale of SUPPORTED_LOCALES) {
      setCurrentLocale(locale);
      assert.equal(getCurrentLocale(), locale);
    }
  } finally {
    setCurrentLocale(originalLocale);
  }
});
