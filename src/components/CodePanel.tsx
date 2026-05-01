import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { useI18n } from "../i18n/useI18n";

interface CodePanelProps {
  code: string;
  placeholder?: string;
  editable?: boolean;
  parseError?: string;
  onCodeChange?: (value: string) => void;
  onClose?: () => void;
  embedded?: boolean;
}

const AUTO_PAIR_TOKENS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightLine(line: string): string {
  if (/^\s*(\/\*|\*|\/\/|#)/.test(line)) {
    return `<span class="ers-token-comment">${escapeHtml(line)}</span>`;
  }

  const keywordPattern = /^(diagram|entity|relation|relationship|connector|attribute-link|attribute|identifier|multivalued|generalization|inheritance|external|connect|notes)$/i;
  const modifierPattern = /^(id|fromIdentifier|local|card|one|zero|many|partial|total|disjoint|overlap)$/i;
  const cardinalityPattern = /^\(?[0-9N]+,[0-9N]+\)?$/i;
  const namePattern = /^[A-Z][A-Za-z0-9_]*$/;

  return line
    .split(/(\s+|"(?:\\.|[^"\\])*"|\([0-9N]+,[0-9N]+\)|[{}()[\],])/g)
    .map((token) => {
      if (!token) {
        return "";
      }
      if (/^\s+$/.test(token)) {
        return token;
      }
      const escaped = escapeHtml(token);
      if (/^"/.test(token)) {
        const body = token.slice(1, -1);
        return cardinalityPattern.test(body)
          ? `<span class="ers-token-card">${escaped}</span>`
          : `<span class="ers-token-string">${escaped}</span>`;
      }
      if (cardinalityPattern.test(token)) {
        return `<span class="ers-token-card">${escaped}</span>`;
      }
      if (keywordPattern.test(token)) {
        return `<span class="ers-token-keyword">${escaped}</span>`;
      }
      if (modifierPattern.test(token)) {
        return `<span class="ers-token-modifier">${escaped}</span>`;
      }
      if (namePattern.test(token)) {
        return `<span class="ers-token-name">${escaped}</span>`;
      }
      return escaped;
    })
    .join("");
}

function highlightCode(code: string): string {
  return code.split(/\r?\n/).map(highlightLine).join("\n");
}

export function CodePanel(props: CodePanelProps) {
  const { t } = useI18n();
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const isReadOnly = !props.editable || !props.onCodeChange;

  function syncScroll() {
    if (!editorRef.current || !highlightRef.current) {
      return;
    }

    highlightRef.current.scrollTop = editorRef.current.scrollTop;
    highlightRef.current.scrollLeft = editorRef.current.scrollLeft;
  }

  function moveCursor(selectionStart: number, selectionEnd = selectionStart) {
    window.requestAnimationFrame(() => {
      if (!editorRef.current) {
        return;
      }
      editorRef.current.selectionStart = selectionStart;
      editorRef.current.selectionEnd = selectionEnd;
      syncScroll();
    });
  }

  function applyEditorEdit(nextValue: string, selectionStart: number, selectionEnd = selectionStart) {
    if (isReadOnly || !props.onCodeChange) {
      return;
    }
    props.onCodeChange(nextValue);
    moveCursor(selectionStart, selectionEnd);
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (isReadOnly || !props.onCodeChange || event.defaultPrevented || event.nativeEvent.isComposing) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const editor = event.currentTarget;
    const { selectionStart, selectionEnd, value } = editor;
    if (event.key === "Tab") {
      event.preventDefault();
      applyEditorEdit(`${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`, selectionStart + 2);
      return;
    }

    const pairClose = AUTO_PAIR_TOKENS[event.key];
    if (pairClose) {
      event.preventDefault();
      const selectedText = value.slice(selectionStart, selectionEnd);
      const nextValue = `${value.slice(0, selectionStart)}${event.key}${selectedText}${pairClose}${value.slice(selectionEnd)}`;
      applyEditorEdit(nextValue, selectionStart + 1, selectionEnd === selectionStart ? selectionStart + 1 : selectionEnd + 1);
    }
  }

  useEffect(() => {
    syncScroll();
  }, [props.code]);

  return (
    <aside className="designer-code-dock diagram-code-panel" aria-label={t("codePanel.shellAria")}>
      <div className="designer-panel-caption">CODE</div>
      <div className="designer-code-editor">
        <pre
          ref={highlightRef}
          className="designer-code-highlight"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlightCode(props.code || props.placeholder || "") }}
        />
        <textarea
          ref={editorRef}
          className="designer-code-input"
          value={props.code}
          onChange={(event) => props.onCodeChange?.(event.target.value)}
          onKeyDown={handleEditorKeyDown}
          onScroll={syncScroll}
          placeholder={props.placeholder ?? t("codePanel.placeholder")}
          spellCheck={false}
          wrap="off"
          readOnly={isReadOnly}
          aria-label={t("codePanel.editorAria")}
        />
      </div>
      {props.parseError ? <div className="designer-code-error">{props.parseError}</div> : null}
    </aside>
  );
}
