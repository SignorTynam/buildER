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

function parseErrorLine(parseError?: string): number | null {
  if (!parseError) {
    return null;
  }

  const match = parseError.match(/linea\s+(\d+)/i);
  if (!match) {
    return null;
  }

  const line = Number(match[1]);
  return Number.isFinite(line) && line > 0 ? line : null;
}

export function CodePanel(props: CodePanelProps) {
  const { t } = useI18n();
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const isReadOnly = !props.editable || !props.onCodeChange;
  const lineCount = Math.max(1, props.code.split(/\r?\n/).length);
  const errorLine = parseErrorLine(props.parseError);

  function syncGutterScroll() {
    if (!editorRef.current || !gutterRef.current) {
      return;
    }

    gutterRef.current.scrollTop = editorRef.current.scrollTop;
  }

  function moveCursor(selectionStart: number, selectionEnd = selectionStart) {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      if (!editorRef.current) {
        return;
      }

      editorRef.current.selectionStart = selectionStart;
      editorRef.current.selectionEnd = selectionEnd;
      syncGutterScroll();
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
      const nextValue = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;
      applyEditorEdit(nextValue, selectionStart + 1);
      return;
    }

    const pairClose = AUTO_PAIR_TOKENS[event.key];
    if (pairClose) {
      event.preventDefault();

      if (selectionStart !== selectionEnd) {
        const selectedText = value.slice(selectionStart, selectionEnd);
        const nextValue = `${value.slice(0, selectionStart)}${event.key}${selectedText}${pairClose}${value.slice(selectionEnd)}`;
        applyEditorEdit(nextValue, selectionStart + 1, selectionEnd + 1);
        return;
      }

      const nextValue = `${value.slice(0, selectionStart)}${event.key}${pairClose}${value.slice(selectionEnd)}`;
      applyEditorEdit(nextValue, selectionStart + 1);
      return;
    }

    if (
      (event.key === ")" || event.key === "]" || event.key === "}") &&
      selectionStart === selectionEnd &&
      value.charAt(selectionStart) === event.key
    ) {
      event.preventDefault();
      moveCursor(selectionStart + 1);
    }
  }

  useEffect(() => {
    syncGutterScroll();
  }, [props.code]);

  return (
    <aside
      className={props.embedded ? "diagram-code-panel technical-side-panel embedded" : "diagram-code-panel technical-side-panel"}
      aria-label={t("codePanel.shellAria")}
    >
      {!props.embedded ? (
        <header className="diagram-code-panel-head technical-side-panel-head">
        <div className="technical-side-panel-copy">
          <span className="technical-side-panel-kicker">Model code</span>
          <h2>{t("codePanel.title")}</h2>
          <p>Rappresentazione testuale sincronizzata del diagramma ER.</p>
        </div>

        <div className="technical-side-panel-head-actions">
          <span className={props.parseError ? "code-panel-status error" : "code-panel-status"}>
            {props.parseError
              ? t("codePanel.error")
              : isReadOnly
                ? t("common.status.readOnly")
                : t("common.status.write")}
          </span>

          {props.onClose ? (
            <button
              type="button"
              className="technical-side-panel-close"
              onClick={props.onClose}
              aria-label="Chiudi pannello codice"
            >
              Hide
            </button>
          ) : null}
        </div>
        </header>
      ) : null}

      <div className="diagram-code-editor-shell">
        <div ref={gutterRef} className="diagram-code-gutter" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => (
            <span
              key={`line-${index + 1}`}
              className={errorLine === index + 1 ? "diagram-code-line-number error" : "diagram-code-line-number"}
            >
              {index + 1}
            </span>
          ))}
        </div>

        <textarea
          ref={editorRef}
          className="diagram-code-panel-content"
          value={props.code}
          onChange={(event) => props.onCodeChange?.(event.target.value)}
          onKeyDown={handleEditorKeyDown}
          onScroll={syncGutterScroll}
          placeholder={props.placeholder ?? t("codePanel.placeholder")}
          spellCheck={false}
          wrap="soft"
          readOnly={isReadOnly}
          aria-label={t("codePanel.editorAria")}
        />
      </div>
    </aside>
  );
}
