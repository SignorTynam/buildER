import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { useI18n } from "../i18n/useI18n";
import { StudioIcon } from "./icons/StudioIcon";
import { applyAutoPairEdit, applyTabEdit, buildLineNumbers } from "../utils/codeEditor";

interface CodePanelProps {
  code: string;
  placeholder?: string;
  editable?: boolean;
  parseError?: string;
  onCodeChange?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onClose?: () => void;
  embedded?: boolean;
  showHeader?: boolean;
  showCloseButton?: boolean;
}

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
  const lineNumberRef = useRef<HTMLDivElement | null>(null);
  const isReadOnly = !props.editable || !props.onCodeChange;
  const lineNumbers = buildLineNumbers(props.code);
  const placeholder = props.placeholder ?? t("codePanel.placeholder");
  const showHeader = props.showHeader ?? !props.embedded;
  const showCloseButton = props.showCloseButton ?? (!props.embedded && Boolean(props.onClose));

  function syncScroll() {
    if (!editorRef.current || !highlightRef.current) {
      return;
    }

    highlightRef.current.scrollTop = editorRef.current.scrollTop;
    highlightRef.current.scrollLeft = editorRef.current.scrollLeft;
    if (lineNumberRef.current) {
      lineNumberRef.current.scrollTop = editorRef.current.scrollTop;
    }
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
      const edit = applyTabEdit(value, selectionStart, selectionEnd);
      applyEditorEdit(edit.value, edit.selectionStart, edit.selectionEnd);
      return;
    }

    const pairEdit = applyAutoPairEdit(value, selectionStart, selectionEnd, event.key);
    if (pairEdit) {
      event.preventDefault();
      applyEditorEdit(pairEdit.value, pairEdit.selectionStart, pairEdit.selectionEnd);
    }
  }

  useEffect(() => {
    syncScroll();
  }, [props.code]);

  return (
    <aside className={props.embedded ? "designer-code-dock diagram-code-panel embedded" : "designer-code-dock diagram-code-panel"} aria-label={t("codePanel.shellAria")}>
      {showHeader ? (
        <div className="designer-panel-caption">
          <span>{t("codePanel.title")}</span>
          {showCloseButton ? (
          <button type="button" className="designer-panel-close" onClick={props.onClose} aria-label={t("codePanel.closeAria")}>
            <StudioIcon name="close" aria-hidden="true" />
          </button>
          ) : null}
        </div>
      ) : null}
      <div className="designer-code-editor">
        <div ref={lineNumberRef} className="designer-code-line-numbers" aria-hidden="true">
          {lineNumbers.map((lineNumber) => (
            <span key={lineNumber}>{lineNumber}</span>
          ))}
        </div>
        <div className="designer-code-scroll-layer">
          <pre
            ref={highlightRef}
            className="designer-code-highlight"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlightCode(props.code) }}
          />
          {props.code.length === 0 ? (
            <div className="designer-code-placeholder" aria-hidden="true">
              {placeholder}
            </div>
          ) : null}
          <textarea
            ref={editorRef}
            className="designer-code-input"
            value={props.code}
            onChange={(event) => props.onCodeChange?.(event.target.value)}
            onFocus={props.onFocus}
            onBlur={props.onBlur}
            onKeyDown={handleEditorKeyDown}
            onScroll={syncScroll}
            spellCheck={false}
            wrap="off"
            readOnly={isReadOnly}
            aria-label={t("codePanel.editorAria")}
          />
        </div>
      </div>
      {props.parseError ? <div className="designer-code-error">{props.parseError}</div> : null}
    </aside>
  );
}
