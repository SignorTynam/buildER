import { useEffect, useRef } from "react";
import type { MessageKey } from "../i18n";
import { useI18n } from "../i18n/useI18n";
import { StudioIcon } from "./icons/StudioIcon";

interface NotesPanelProps {
  notes: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  onClose?: () => void;
  embedded?: boolean;
}

const FORMAT_BUTTONS = [
  { label: "B", ariaKey: "notesPanel.toolbar.bold", command: "bold" },
  { label: "I", ariaKey: "notesPanel.toolbar.italic", command: "italic" },
  { label: "U", ariaKey: "notesPanel.toolbar.underline", command: "underline" },
  { label: "S", ariaKey: "notesPanel.toolbar.strike", command: "strikeThrough" },
  { label: "Quote", ariaKey: "notesPanel.toolbar.quote", command: "formatBlock", value: "blockquote" },
  { label: "Code", ariaKey: "notesPanel.toolbar.codeBlock", command: "formatBlock", value: "pre" },
  { label: "H1", ariaKey: "notesPanel.toolbar.heading1", command: "formatBlock", value: "h1" },
  { label: "H2", ariaKey: "notesPanel.toolbar.heading2", command: "formatBlock", value: "h2" },
  { label: "P", ariaKey: "notesPanel.toolbar.paragraph", command: "formatBlock", value: "p" },
  { label: "1.", ariaKey: "notesPanel.toolbar.orderedList", command: "insertOrderedList" },
  { label: "•", ariaKey: "notesPanel.toolbar.unorderedList", command: "insertUnorderedList" },
  { label: "x₂", ariaKey: "notesPanel.toolbar.subscript", command: "subscript" },
  { label: "x²", ariaKey: "notesPanel.toolbar.superscript", command: "superscript" },
  { label: "L", ariaKey: "notesPanel.toolbar.alignLeft", command: "justifyLeft" },
  { label: "C", ariaKey: "notesPanel.toolbar.alignCenter", command: "justifyCenter" },
  { label: "R", ariaKey: "notesPanel.toolbar.alignRight", command: "justifyRight" },
  { label: "Clear", ariaKey: "notesPanel.toolbar.clearFormatting", command: "removeFormat" },
] satisfies Array<{ label: string; ariaKey: MessageKey; command: string; value?: string }>;

function sanitizeNotesHtml(value: string): string {
  if (!value.trim()) {
    return "";
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(value, "text/html");
  doc.querySelectorAll("script, iframe, object, embed").forEach((node) => node.remove());
  doc.body.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const content = attribute.value.trim().toLowerCase();
      if (name.startsWith("on") || content.startsWith("javascript:")) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return doc.body.innerHTML;
}

function htmlFromNotes(notes: string): string {
  const trimmed = notes.trim();
  if (!trimmed) {
    return "";
  }
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return sanitizeNotesHtml(trimmed);
  }
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function NotesPanel(props: NotesPanelProps) {
  const { t } = useI18n();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastRenderedHtmlRef = useRef("");
  const isReadOnly = !props.editable || !props.onChange;

  useEffect(() => {
    const nextHtml = htmlFromNotes(props.notes);
    if (editorRef.current && nextHtml !== lastRenderedHtmlRef.current && editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
      lastRenderedHtmlRef.current = nextHtml;
    }
  }, [props.notes]);

  function emitChange() {
    if (!editorRef.current || isReadOnly) {
      return;
    }
    const sanitized = sanitizeNotesHtml(editorRef.current.innerHTML);
    lastRenderedHtmlRef.current = sanitized;
    props.onChange?.(sanitized);
  }

  function runCommand(command: string, value?: string) {
    if (isReadOnly) {
      return;
    }
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emitChange();
  }

  function insertLink() {
    const url = window.prompt(t("notesPanel.prompts.linkUrl"));
    if (!url || url.trim().toLowerCase().startsWith("javascript:")) {
      return;
    }
    runCommand("createLink", url.trim());
  }

  function insertImage() {
    const url = window.prompt(t("notesPanel.prompts.imageUrl"));
    if (!url || url.trim().toLowerCase().startsWith("javascript:")) {
      return;
    }
    runCommand("insertImage", url.trim());
  }

  return (
    <aside className="designer-notes-overlay diagram-notes-panel" aria-label={t("notesPanel.shellAria")}>
      <div className="designer-notes-toolbar">
        {FORMAT_BUTTONS.map((button) => (
          <button
            key={`${button.command}-${button.value ?? ""}`}
            type="button"
            onClick={() => runCommand(button.command, button.value)}
            aria-label={t(button.ariaKey)}
            title={t(button.ariaKey)}
          >
            {button.label}
          </button>
        ))}
        <button type="button" onClick={insertLink} aria-label={t("notesPanel.toolbar.link")} title={t("notesPanel.toolbar.link")}>
          {t("notesPanel.toolbar.link")}
        </button>
        <button type="button" onClick={insertImage} aria-label={t("notesPanel.toolbar.image")} title={t("notesPanel.toolbar.image")}>
          {t("notesPanel.toolbar.image")}
        </button>
        {props.onClose ? (
          <button type="button" className="designer-notes-hide" onClick={props.onClose} aria-label={t("notesPanel.toolbar.hide")} title={t("notesPanel.toolbar.hide")}>
            <StudioIcon name="close" aria-hidden="true" />
            {t("notesPanel.toolbar.hide")}
          </button>
        ) : null}
      </div>
      <div
        ref={editorRef}
        className="designer-notes-editor"
        contentEditable={!isReadOnly}
        suppressContentEditableWarning
        onInput={emitChange}
        data-placeholder={t("notesPanel.placeholder")}
        aria-label={t("notesPanel.editorAria")}
      />
    </aside>
  );
}
