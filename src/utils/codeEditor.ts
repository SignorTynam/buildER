export interface CodeEditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export type CodeDraftSyncSource = "code-parse" | "external";

const AUTO_PAIR_TOKENS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
};

export function getCodeLineCount(code: string): number {
  return Math.max(1, code.split(/\r?\n/).length);
}

export function buildLineNumbers(code: string): string[] {
  return Array.from({ length: getCodeLineCount(code) }, (_, index) => String(index + 1));
}

export function applyTabEdit(value: string, selectionStart: number, selectionEnd: number): CodeEditResult {
  return {
    value: `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`,
    selectionStart: selectionStart + 2,
    selectionEnd: selectionStart + 2,
  };
}

export function applyAutoPairEdit(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  key: string,
): CodeEditResult | null {
  const pairClose = AUTO_PAIR_TOKENS[key];
  if (!pairClose) {
    return null;
  }

  const selectedText = value.slice(selectionStart, selectionEnd);
  return {
    value: `${value.slice(0, selectionStart)}${key}${selectedText}${pairClose}${value.slice(selectionEnd)}`,
    selectionStart: selectionStart + 1,
    selectionEnd: selectionEnd === selectionStart ? selectionStart + 1 : selectionEnd + 1,
  };
}

export function shouldSyncCodeDraftFromDiagram(options: {
  focused: boolean;
  dirty: boolean;
  source: CodeDraftSyncSource;
}): boolean {
  return options.source === "external" && !options.focused && !options.dirty;
}
