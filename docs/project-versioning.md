# Project Versioning

buildER stores project version history inside the same `.ersp` file as the current working project. The feature is intentionally local and domain-specific: it does not use Git, GitHub sync, IndexedDB, or localStorage as the canonical project history.

## File model

Current `.ersp` files keep both:

- the current working copy, including ER diagram, translation workspace, logical workspace, viewports, code draft, selections, panels, toolbar state, focus mode, and diagnostics preference;
- `versioning`, a `ProjectVersioningState` with commits, tags, settings, and `headCommitId`.

Older `.ersp` files remain supported. Missing or malformed workspace/versioning data is sanitized during parsing and falls back to safe defaults instead of blocking file load.

## Commits and snapshots

A `ProjectCommit` stores a complete `ProjectCommitSnapshot`. The snapshot is normalized and cloned before it is saved so later workspace mutations do not alter historical commits. Snapshot checksums and equality helpers are deterministic and are used by commit creation, dirty state, diff, and restore logic.

Commit statistics are derived from the snapshot and include ER counts, logical table count, and warning/error counts when available.

## HEAD and working copy

`headCommitId` points to the latest committed project version. The working copy is the current editable project state. It may match HEAD, differ from HEAD, or exist without any commit yet.

Dirty state is computed by comparing the current working snapshot with HEAD and classifies changes into broad categories:

- ER schema;
- layout and viewports;
- logical model;
- ERS code draft;
- saved workspace state.

The boolean dirty helper remains available for legacy callers, but new UI should prefer the structured dirty state.

## Diff

Version diff is implemented in `src/features/versioning/projectVersionDiff.ts` as pure logic. It compares normalized snapshots and returns sectioned results for ER, layout, logical model, code, and workspace changes. The UI only renders the computed result and does not own diff rules.

## Restore

Restoring a commit never moves HEAD backward or deletes commits. The restore flow creates:

1. an automatic backup commit for the current working copy;
2. an automatic restore commit containing the target snapshot;
3. a new HEAD pointing to the restore commit.

After restore, the working copy is applied from the restore commit snapshot and should be clean against HEAD. Backup and restore commits are saved in `.ersp` files and workspace sessions like any other commit.

## Module boundaries

- `projectCommitSnapshot.ts`: snapshot types, clone, normalize, checksum, stats, commit draft creation.
- `projectVersionDiff.ts`: pure diff types and comparison logic.
- `projectVersionRestore.ts`: pure restore planning/state update logic.
- `useProjectVersioning.ts`: React hook orchestration for versioning state, commits, HEAD, and dirty state.
- UI components render dialogs, timeline, diff, and restore confirmation without duplicating domain logic.
