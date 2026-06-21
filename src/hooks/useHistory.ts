import { useState } from "react";

export const DEFAULT_HISTORY_LIMIT = 100;

export interface UseHistoryOptions<T> {
  maxEntries?: number;
  clone?: (value: T) => T;
  isEqual?: (left: T, right: T) => boolean;
}

export function normalizeHistoryLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_HISTORY_LIMIT;
  }

  return Math.max(0, Math.floor(value));
}

export function trimPastEntries<T>(entries: T[], maxEntries: number): T[] {
  if (maxEntries <= 0) {
    return [];
  }

  return entries.length > maxEntries ? entries.slice(entries.length - maxEntries) : entries;
}

export function trimFutureEntries<T>(entries: T[], maxEntries: number): T[] {
  if (maxEntries <= 0) {
    return [];
  }

  return entries.length > maxEntries ? entries.slice(0, maxEntries) : entries;
}

export function cloneHistoryValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function areHistoryValuesEqual<T>(
  left: T,
  right: T,
  isEqual?: (left: T, right: T) => boolean,
): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (isEqual) {
    return isEqual(left, right);
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

export function useHistory<T>(initialValue: T, options: UseHistoryOptions<T> = {}) {
  const maxEntries = normalizeHistoryLimit(options.maxEntries ?? DEFAULT_HISTORY_LIMIT);
  const clone = options.clone ?? cloneHistoryValue;
  const isEqual = options.isEqual;
  const [past, setPast] = useState<T[]>([]);
  const [present, setPresentState] = useState<T>(clone(initialValue));
  const [future, setFuture] = useState<T[]>([]);

  function setPresent(nextValue: T) {
    setPresentState(clone(nextValue));
  }

  function commit(nextValue: T, previousOverride?: T) {
    const previous = previousOverride ?? present;

    if (areHistoryValuesEqual(previous, nextValue, isEqual)) {
      setPresentState(clone(nextValue));
      return;
    }

    if (maxEntries === 0) {
      setPast([]);
      setFuture([]);
      setPresentState(clone(nextValue));
      return;
    }

    setPast((currentPast) => trimPastEntries([...currentPast, clone(previous)], maxEntries));
    setPresentState(clone(nextValue));
    setFuture([]);
  }

  function reset(nextValue: T) {
    setPast([]);
    setFuture([]);
    setPresentState(clone(nextValue));
  }

  function undo() {
    if (maxEntries === 0 || past.length === 0) {
      return;
    }

    const previous = past[past.length - 1];
    setPast((currentPast) => currentPast.slice(0, -1));
    setFuture((currentFuture) => trimFutureEntries([clone(present), ...currentFuture], maxEntries));
    setPresentState(clone(previous));
  }

  function redo() {
    if (maxEntries === 0 || future.length === 0) {
      return;
    }

    const [next, ...remaining] = future;
    setFuture(remaining);
    setPast((currentPast) => trimPastEntries([...currentPast, clone(present)], maxEntries));
    setPresentState(clone(next));
  }

  return {
    past,
    present,
    future,
    canUndo: maxEntries > 0 && past.length > 0,
    canRedo: maxEntries > 0 && future.length > 0,
    setPresent,
    commit,
    reset,
    undo,
    redo,
    pastCount: past.length,
    futureCount: future.length,
    historyLimit: maxEntries,
  };
}
