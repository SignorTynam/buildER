import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyAppUpdate,
  compareAppVersions,
  parseAppVersion,
} from "../src/utils/versioning.ts";

test("classifica il primo avvio senza mostrare un modal automatico", () => {
  assert.deepEqual(classifyAppUpdate(null, "4.6"), {
    kind: "first-run",
    shouldShow: false,
    wow: false,
  });
});

test("classifica versioni uguali come nessun aggiornamento", () => {
  assert.deepEqual(classifyAppUpdate("4.5.2", "4.5.2"), {
    kind: "none",
    shouldShow: false,
    wow: false,
  });
});

test("classifica patch update senza effetto wow", () => {
  assert.deepEqual(classifyAppUpdate("4.5.1", "4.5.2"), {
    kind: "patch",
    shouldShow: true,
    wow: false,
  });
});

test("classifica minor update con effetto wow", () => {
  assert.deepEqual(classifyAppUpdate("4.5.2", "4.6.0"), {
    kind: "minor",
    shouldShow: true,
    wow: true,
  });
  assert.deepEqual(classifyAppUpdate("4.5", "4.6"), {
    kind: "minor",
    shouldShow: true,
    wow: true,
  });
});

test("classifica major update con effetto wow", () => {
  assert.deepEqual(classifyAppUpdate("4.9.9", "5.0.0"), {
    kind: "major",
    shouldShow: true,
    wow: true,
  });
  assert.deepEqual(classifyAppUpdate("5.4", "6.0"), {
    kind: "major",
    shouldShow: true,
    wow: true,
  });
});

test("classifica downgrade senza mostrare annunci", () => {
  assert.deepEqual(classifyAppUpdate("5.0.0", "4.9.9"), {
    kind: "downgrade",
    shouldShow: false,
    wow: false,
  });
});

test("normalizza parti di versione mancanti", () => {
  assert.deepEqual(parseAppVersion("5"), {
    raw: "5",
    major: 5,
    minor: 0,
    patch: 0,
    prerelease: undefined,
  });
  assert.deepEqual(parseAppVersion("5.2"), {
    raw: "5.2",
    major: 5,
    minor: 2,
    patch: 0,
    prerelease: undefined,
  });
  assert.equal(compareAppVersions("4.6", "4.6.0"), 0);
  assert.equal(compareAppVersions("5.2.1-beta", "5.2.1"), -1);
});
