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
import { withTestLocale } from "./utils/i18nTestUtils.ts";

type RawMessages = Record<string, unknown>;
type LeafValue = string | PluralMessage;

const rawMessagesByLocale: Record<Locale, RawMessages> = { it, en, sq };
const IMPORTANT_LOCALIZED_KEYS = [
  "app.updateFallback.patchHeadline",
  "appHeader.actions.newProject",
  "appHeader.actions.openProject",
  "appHeader.actions.languageTitle",
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
  "cardinalityModal.title",
  "sqlReverse.input.analyze",
  "logical.entityKeyModal.title",
  "canvas.externalIdentifier.importsFrom",
  "sqlPlayground.status.stale",
  "sqlPlayground.results.changedRows",
  "sqlExplorer.refresh",
] as const;
const NEW_I18N_SECTIONS = [
  "toolbar.commands.select.label",
  "toolbar.commands.pan.aria",
  "toolbar.commands.compositeId.sameEntity",
  "toolbar.commands.externalIdUnified.label",
  "toolbar.commands.deleteIdentifier.label",
  "toolbar.commands.deleteIdentifier.title",
  "appHeader.actions.languageTitle",
  "appHeader.actions.languageAria",
  "appHeader.actions.languageMenuAria",
  "translation.restructuring.fixOptions",
  "translation.simpleMultivalued.dependent.label",
  "translation.simpleMultivalued.dependent.labelWithIdentifier",
  "translation.simpleMultivalued.dependent.internalIdentifier",
  "translation.simpleMultivalued.dependent.externalIdentifier",
  "translation.simpleMultivalued.dependent.description",
  "translation.simpleMultivalued.dependent.summary",
  "translation.simpleMultivalued.dependent.preview",
  "workspace.identifierAlreadyExistsUseDelete",
  "toolbar.export.diagramCode",
  "toolbar.export.jpeg",
  "commandMenu.commands.fileExportJpeg.label",
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
  "erWorkspaceSidebar.aria",
  "erWorkspaceSidebar.tabsAria",
  "erWorkspaceSidebar.properties.title",
  "erWorkspaceSidebar.properties.tab",
  "erWorkspaceSidebar.properties.description",
  "erWorkspaceSidebar.properties.status",
  "erWorkspaceSidebar.code.title",
  "erWorkspaceSidebar.code.tab",
  "erWorkspaceSidebar.code.description",
  "erWorkspaceSidebar.code.descriptionWithError",
  "erWorkspaceSidebar.code.errorStatus",
  "erWorkspaceSidebar.code.liveStatus",
  "erWorkspaceSidebar.code.placeholder",
  "erWorkspaceSidebar.notes.title",
  "erWorkspaceSidebar.notes.tab",
  "erWorkspaceSidebar.notes.description",
  "erWorkspaceSidebar.notes.status",
  "erWorkspaceSidebar.notes.empty",
  "common.status.info",
  "commandMenu.commands.workflowSqlPlayground.label",
  "sqlPlayground.createDatabase",
  "sqlPlayground.title",
  "sqlPlayground.recreateDatabase",
  "sqlPlayground.downloadDatabase",
  "sqlPlayground.resetConfirm.title",
  "sqlPlayground.errors.query",
  "sqlPlayground.executeTooltip",
  "sqlPlayground.results.limit",
  "sqlPlayground.results.rowNumber",
  "sqlPlayground.results.resize",
  "sqlExplorer.title",
  "sqlExplorer.refresh",
  "sqlExplorer.tables",
  "sqlExplorer.columns",
  "sqlExplorer.foreignKeys",
  "sqlExplorer.empty.databaseMissing",
  "workspaceChrome.sqlEditorAria",
  "workspaceChrome.sqlActions.openPlayground",
  "workspaceChrome.sqlActions.startReverse",
  "workspaceChrome.sqlActions.noSchemaWarning",
  "workspaceChrome.sqlActions.ambiguousSchemaWarning",
  "workspaceChrome.sqlActions.databaseNameTitle",
  "workspaceChrome.sqlActions.databaseNameLabel",
  "workspaceChrome.sqlActions.databaseNameRequired",
  "workspaceChrome.sqlActions.createDatabase",
  "workspaceChrome.sqlActions.playgroundDatabaseCreating",
  "workspace.codeEmpty.title",
  "workspace.codeEmpty.description",
  "workspace.codeEmpty.createSchema",
  "workspace.codeEmpty.openExplorer",
  "sqlExplorer.empty.noProjectTitle",
  "sqlExplorer.empty.noProjectDescription",
  "sqlExplorer.empty.noDatabaseTitle",
  "sqlExplorer.empty.noDatabaseDescription",
  "sqlExplorer.empty.playgroundClosedTitle",
  "sqlExplorer.empty.databaseMissingTitle",
  "errors.panel.validTitle",
  "errors.panel.validDescription",
  "errors.panel.emptyFilterTitle",
  "errors.panel.emptyFilterDescription",
  "sqlExplorer.error.title",
  "technicalDock.aria",
  "technicalDock.tabsAria",
  "technicalDock.tabs.review",
  "technicalDock.tabs.code",
  "technicalDock.tabs.notes",
  "technicalDock.empty.review",
  "technicalDock.empty.code",
  "technicalDock.empty.notes",
  "bottomStatus.workspaceLabel",
  "bottomStatus.dismissNotice",
  "bottomStatus.workspace.translation",
  "bottomStatus.workspace.schemaSql",
  "bottomStatus.workspace.schema",
  "bottomStatus.workspace.model",
  "bottomStatus.panels.code",
  "bottomStatus.panels.notes",
  "bottomStatus.validationErrors",
  "bottomStatus.validationWarnings",
  "bottomStatus.selected",
  "bottomStatus.warnings",
  "bottomStatus.errors",
  "changelog.eyebrow",
  "changelog.title",
  "changelog.subtitle",
  "changelog.closeAria",
  "changelog.current",
  "changelog.defaultSummary",
  "changelog.highlightsAria",
  "changelog.impact.major",
  "changelog.impact.minor",
  "changelog.impact.fix",
  "releases.header.label",
  "releases.header.ariaLabel",
  "releases.actions.discover",
  "releases.actions.start",
  "releases.sections.added",
  "releases.sections.changed",
  "releases.sections.fixed",
  "releases.center.title",
  "releases.center.current",
  "translation.restructuring.openNotes",
  "translation.restructuring.closeNotes",
  "translation.restructuring.notes",
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
const INSPECTOR_I18N_KEYS = [
  "inspector.heading.entity.title",
  "inspector.heading.relationship.subtitle",
  "inspector.isa.constraints.totalDisjoint",
  "inspector.isa.missingConstraint",
  "inspector.isa.detachFromGroup",
  "inspector.panel.compactSelectionCount",
  "inspector.panel.activeSelectionCount",
  "inspector.quickActions.title",
  "inspector.multiSelection.needTwoNodes",
  "inspector.entity.noParticipations",
  "inspector.relationship.externalIdentifiersManagedOnHost",
  "inspector.attribute.internalIdentifierNotice",
  "inspector.edge.connectorCardinalityManagedOnEntity",
  "inspector.quickGuide.addAttributes",
  "inspector.internalIdentifier.modal.description",
  "inspector.internalIdentifier.empty",
] as const;
const APP_MODAL_I18N_KEYS = [
  "workspace.generalizationGroupDialog.title",
  "workspace.generalizationGroupDialog.editHint",
  "workspace.generalizationGroupDialog.errors.selectGroup",
  "workspace.generalizationGroupDialog.status.groupCreated",
  "intro.title",
  "intro.cards.create.description",
  "intro.startDrawing",
  "about.title",
  "about.sections.tools.items.shortcuts",
  "about.sections.code.items.live",
  "about.sections.notation.items.available",
  "changelog.entries.v6_3.hero.title",
  "changelog.entries.v6_3.highlights.code.description",
  "changelog.entries.generic.updates.0",
] as const;
const APP_STATUS_I18N_KEYS = [
  "workspace.noticeTitles.invalidConnection",
  "workspace.noticeTitles.downloadCompleted",
  "workspace.logicalNoApplicableItems",
  "workspace.selectValidAttributeHost",
  "workspace.externalIdentifierNoImportedParts",
  "workspace.connectionMissingEndpoint",
  "workspace.errors.connectionNotCreated",
  "workspace.downloads.pngExported",
  "workspace.quickPanels.openErrorsAria",
  "errors.closeAria",
  "errors.empty",
] as const;
const CANVAS_HARDCODED_ITALIAN_PHRASES = [
  "Sorgente selezionata",
  "Seleziona prima",
  "Viewport centrata",
  "Diagramma adattato",
  "Identificatore esterno selezionato",
  "Controlli viewport",
  "Spazio + drag per pan",
  "Sorgente fissata",
  "Seleziona ora la destinazione",
  "Flusso ISA",
  "Esc annulla",
  "Click target completa",
] as const;
const CONNECTED_COMPONENT_HARDCODED_ITALIAN_PHRASES = [
  "Chiudi note",
  "Apri note",
  "Nessun elemento da mostrare",
  "Nessun codice disponibile",
  "Nessuna nota",
  "Pannello tecnico",
  "Sezioni pannello tecnico",
  "Chiudi notifica",
  "errori di validazione richiedono attenzione",
  "warning di validazione nel workspace corrente",
  "selezionati",
  "Novita",
  "Storico aggiornamenti",
  "Chiudi novita",
  "Corrente",
  "Aggiornamenti e miglioramenti della release",
  "Vedi changelog completo",
  "Vedi dettagli",
  "Ho capito",
  "Altre novita",
  "Versione precedente",
] as const;
const FORBIDDEN_VISIBLE_ITALIAN_TERMS = [
  "Entita",
  "Entità",
  "Relazione",
  "Associazione",
  "Attributo",
  "Collegamento",
  "Cardinalita",
  "Cardinalità",
  "Seleziona",
  "Aggiungi",
  "Modifica",
  "Elimina",
  "Conferma",
  "Annulla",
  "Chiudi",
  "Informazioni",
  "Guida",
  "Nessuna",
  "Nessun",
  "Pannello",
  "Vincolo",
  "Gerarchia",
  "Identificatore",
  "Benvenuto",
  "Inizia",
  "Diagramma",
  "Progetto",
] as const;
const FILES_WITH_VISIBLE_I18N_COVERAGE = [
  "../src/App.tsx",
  "../src/utils/appMeta.ts",
  "../index.html",
  "../public/about.html",
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
    withTestLocale(locale, () => {
      assert.equal(translate("toolbar.commands.externalIdUnified.label"), expectedExternalIdLabels[locale]);
      assert.notEqual(translate("toolbar.commands.deleteIdentifier.label"), "toolbar.commands.deleteIdentifier.label");
      assert.equal(translate("toolbar.commands.deleteIdentifier.title"), expectedDeleteIdentifierTitles[locale]);
      assert.notEqual(
        translate("workspace.identifierAlreadyExistsUseDelete"),
        "workspace.identifierAlreadyExistsUseDelete",
      );
    });
  }
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

test("multivalued strategy descriptions interpolate semantic choice details in every locale", () => {
  for (const locale of SUPPORTED_LOCALES) {
    for (const key of [
      "translation.simpleMultivalued.shared.description",
      "translation.simpleMultivalued.unique.description",
      "translation.simpleMultivalued.dependent.description",
    ]) {
      const value = translate(key, { name: "TAG", owner: "CON" }, locale);
      assert.match(value, /TAG/);
      assert.match(value, /CON/);
      assert.equal(value.includes("{name}"), false, `${locale}.${key} kept {name}`);
      assert.equal(value.includes("{owner}"), false, `${locale}.${key} kept {owner}`);
    }

    const preview = translate(
      "translation.simpleMultivalued.dependent.preview",
      { identifier: "idCon", name: "TAG" },
      locale,
    );
    assert.match(preview, /idCon/);
    assert.match(preview, /TAG/);
  }
});

test("new localized UI sections resolve for every locale", () => {
  for (const locale of SUPPORTED_LOCALES) {
    for (const key of [
      ...NEW_I18N_SECTIONS,
      ...CANVAS_I18N_KEYS,
      ...EXTERNAL_IDENTIFIER_SECTION_KEYS,
      ...INSPECTOR_I18N_KEYS,
      ...APP_MODAL_I18N_KEYS,
      ...APP_STATUS_I18N_KEYS,
    ]) {
      const value = translate(key, { count: 2, current: 1, total: 3, sourceKind: "A", targetKind: "B", attributes: "id", entity: "User" }, locale);
      assert.notEqual(value, key, `${locale}.${key} was not resolved`);
      assert.notEqual(value.trim(), "", `${locale}.${key} resolved to an empty string`);
    }
  }
});

test("priority runtime files do not keep frequent Italian UI terms hardcoded", () => {
  const findings = FILES_WITH_VISIBLE_I18N_COVERAGE.flatMap((file) => {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    return FORBIDDEN_VISIBLE_ITALIAN_TERMS
      .filter((term) => new RegExp(`\\b${term}\\b`, "u").test(source))
      .map((term) => `${file}: ${term}`);
  });

  assert.deepEqual(findings, []);
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

test("canvas-connected components do not keep known Italian UI phrases hardcoded", () => {
  const source = [
    "../src/translation/TranslationWorkspace.tsx",
    "../src/components/TechnicalDockPanel.tsx",
    "../src/components/BottomStatusBar.tsx",
    "../src/components/releases/ReleaseCenter.tsx",
    "../src/components/releases/ReleaseAnnouncement.tsx",
    "../src/components/releases/ReleaseToast.tsx",
    "../src/components/panels.tsx",
  ]
    .map((file) => readFileSync(new URL(file, import.meta.url), "utf8"))
    .join("\n");
  const remaining = CONNECTED_COMPONENT_HARDCODED_ITALIAN_PHRASES.filter((phrase) => source.includes(phrase));

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

test("withTestLocale restores the previous locale after localized work", () => {
  const originalLocale = getCurrentLocale();
  const testLocale = originalLocale === "en" ? "it" : "en";

  withTestLocale(testLocale, () => {
    assert.notEqual(getCurrentLocale(), originalLocale);
  });

  assert.equal(getCurrentLocale(), originalLocale);
  assert.throws(() => withTestLocale(testLocale, () => {
    throw new Error("localized test failure");
  }), /localized test failure/);
  assert.equal(getCurrentLocale(), originalLocale);
});

test("workspace redesign strings exist in English, Italian, and Albanian", () => {
  const keys = [
    "workspaceChrome.commandSearch",
    "projectExplorer.actions.expandFolder",
    "projectExplorer.errors.invalid-characters",
    "projectTabs.closeModifiedTitle",
    "sourceControl.expandHistory",
    "sourceControl.details.statsValue",
    "codeEditor.diagnostic.errorAtLine",
    "bottomStatus.projectLabel",
    "bottomStatus.zoomLabel",
  ];

  for (const locale of SUPPORTED_LOCALES) {
    for (const key of keys) {
      const value = translate(key as never, { entities: 2, tables: 3 }, locale);
      assert.notEqual(value, key, `${locale}.${key} is missing`);
      assert.notEqual(value.trim(), "", `${locale}.${key} is empty`);
    }
  }
});
