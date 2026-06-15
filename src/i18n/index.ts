import { en } from "./messages/en";
import { it } from "./messages/it";
import { sq } from "./messages/sq";

export const SUPPORTED_LOCALES = ["it", "en", "sq"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "it";
export const I18N_STORAGE_KEY = "chen-er-diagram-studio:locale";

export interface PluralMessage {
  zero?: string;
  one?: string;
  other: string;
}

type MessageLeaf = string | PluralMessage;
type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer Item)[]
        ? readonly Widen<Item>[]
        : T extends object
          ? { [Key in keyof T]: Widen<T[Key]> }
          : T;

type MessageTree = Widen<typeof it>;

export type Messages = MessageTree;
export type TranslationParams = Record<string, string | number | boolean | null | undefined>;

type DeepPartialObject<T extends object> = {
  [Key in keyof T]?: T[Key] extends readonly (infer Item)[]
    ? readonly Item[]
    : T[Key] extends MessageLeaf
      ? T[Key]
      : T[Key] extends object
        ? DeepPartialObject<T[Key]>
        : T[Key];
};

export type DeepPartialMessages = {
  [Key in keyof Messages]?: Messages[Key] extends readonly (infer Item)[]
    ? readonly Item[]
    : Messages[Key] extends MessageLeaf
      ? Messages[Key]
      : Messages[Key] extends object
        ? DeepPartialObject<Messages[Key]>
        : Messages[Key];
};

type LeafKeyOf<T> = {
  [Key in keyof T & string]: T[Key] extends MessageLeaf
    ? Key
    : T[Key] extends readonly unknown[]
      ? never
      : T[Key] extends object
        ? `${Key}.${LeafKeyOf<T[Key]>}`
        : never;
}[keyof T & string];

export type MessageKey = LeafKeyOf<Messages>;

type MessageBundle = Record<string, unknown>;

const IS_DEV = typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);
const rawMessagesByLocale: Record<Locale, MessageBundle> = { it, en, sq };
const warnedMissingKeys = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeMessages<T extends MessageBundle>(base: T, override: unknown): T {
  if (!isRecord(override)) {
    return base;
  }

  const result = { ...base } as Record<string, unknown>;
  Object.keys(override).forEach((key) => {
    const baseValue = result[key];
    const overrideValue = override[key];

    if (Array.isArray(baseValue)) {
      result[key] = Array.isArray(overrideValue) ? overrideValue : baseValue;
      return;
    }

    if (isRecord(baseValue) && isRecord(overrideValue)) {
      result[key] = mergeMessages(baseValue, overrideValue);
      return;
    }

    result[key] = overrideValue ?? baseValue;
  });

  return result as T;
}

const mergedMessagesByLocale: Record<Locale, Messages> = {
  it,
  en: mergeMessages(it, en),
  sq: mergeMessages(it, sq),
};

function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("it")) {
    return "it";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  if (normalized.startsWith("sq")) {
    return "sq";
  }

  return null;
}

function detectNavigatorLocale(): Locale {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE;
  }

  const candidates = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate);
    if (locale) {
      return locale;
    }
  }

  return DEFAULT_LOCALE;
}

export function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return normalizeLocale(window.localStorage.getItem(I18N_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function resolveInitialLocale(): Locale {
  return readStoredLocale() ?? detectNavigatorLocale();
}

function writeStoredLocale(locale: Locale) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(I18N_STORAGE_KEY, locale);
  } catch {
    // Ignore storage errors and keep the app usable.
  }
}

let currentLocale: Locale = resolveInitialLocale();
const listeners = new Set<() => void>();

export function subscribeToLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentLocale(): Locale {
  return currentLocale;
}

export function setCurrentLocale(locale: Locale) {
  if (locale === currentLocale) {
    return;
  }

  currentLocale = locale;
  writeStoredLocale(locale);
  listeners.forEach((listener) => listener());
}

function getMessageValue(bundle: MessageBundle, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[segment];
  }, bundle);
}

function isPluralMessage(value: unknown): value is PluralMessage {
  return isRecord(value) && typeof value.other === "string";
}

function selectPluralMessage(value: PluralMessage, count: number): string {
  if (count === 0 && typeof value.zero === "string") {
    return value.zero;
  }
  if (count === 1 && typeof value.one === "string") {
    return value.one;
  }

  return value.other;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => {
    const value = params[key];
    return value == null ? "" : String(value);
  });
}

function fallbackMissingKey(key: string): string {
  if (IS_DEV) {
    return key;
  }

  const tail = key.split(".").pop() ?? key;
  return tail.replace(/([A-Z])/g, " $1").replace(/[-_]/g, " ").trim() || key;
}

function warnMissingLocaleKey(locale: Locale, key: string) {
  if (!IS_DEV || locale === DEFAULT_LOCALE) {
    return;
  }

  const warningKey = `${locale}:${key}`;
  if (warnedMissingKeys.has(warningKey)) {
    return;
  }

  warnedMissingKeys.add(warningKey);
  console.warn(`[i18n] Missing "${key}" for locale "${locale}". Falling back to "${DEFAULT_LOCALE}".`);
}

export function getMessages(locale: Locale = currentLocale): Messages {
  return mergedMessagesByLocale[locale];
}

export function translate(
  key: MessageKey,
  params?: TranslationParams,
  locale: Locale = currentLocale,
): string {
  if (getMessageValue(rawMessagesByLocale[locale], key) == null) {
    warnMissingLocaleKey(locale, key);
  }

  const localized = getMessageValue(getMessages(locale), key);
  const fallback = getMessageValue(getMessages(DEFAULT_LOCALE), key);
  const resolved = localized ?? fallback;

  if (typeof resolved === "string") {
    return interpolate(resolved, params);
  }

  if (isPluralMessage(resolved)) {
    const countValue = typeof params?.count === "number" ? params.count : Number(params?.count ?? 0);
    return interpolate(selectPluralMessage(resolved, Number.isFinite(countValue) ? countValue : 0), params);
  }

  return fallbackMissingKey(key);
}

export const t = translate;

export function getLanguageLabel(locale: Locale, uiLocale: Locale = currentLocale): string {
  return getMessages(uiLocale).language.names[locale];
}

export function getLanguageMenuLabel(locale: Locale, uiLocale: Locale = currentLocale): string {
  const localizedName = getLanguageLabel(locale, uiLocale);
  const nativeName = getMessages(locale).language.names[locale];
  return `${localizedName} (${nativeName})`;
}
