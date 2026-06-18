import assert from "node:assert/strict";
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
  "notesPanel.toolbar.image",
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
  "notesPanel.toolbar.bold",
  "notesPanel.toolbar.clearFormatting",
  "notesPanel.prompts.imageUrl",
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
  "logical.entityKeyModal.applyFixEntities",
  "errors.structured.template",
  "connection.errors.invalidConnector",
  "canvas.externalIdentifier.importsFrom",
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
    .filter(([, value]) => typeof value === "string" && value.trim() === "")
    .map(([key]) => key);
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
    assert.match(translate("app.versionLabel", { version: "5.1" }, locale), /5\.1/);
    assert.match(translate("commandMenu.visibleCount", { count: 1 }, locale), /1/);
    assert.match(translate("commandMenu.visibleCount", { count: 2 }, locale), /2/);
  }
});

test("new localized UI sections resolve for every locale", () => {
  for (const locale of SUPPORTED_LOCALES) {
    for (const key of NEW_I18N_SECTIONS) {
      const value = translate(key, { count: 2, current: 1, total: 3, sourceKind: "A", targetKind: "B", attributes: "id", entity: "User" }, locale);
      assert.notEqual(value, key, `${locale}.${key} was not resolved`);
      assert.notEqual(value.trim(), "", `${locale}.${key} resolved to an empty string`);
    }
  }
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
