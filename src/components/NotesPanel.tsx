import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/useI18n";

interface NotesPanelProps {
  notes: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  onClose?: () => void;
  embedded?: boolean;
}

const FORMAT_BUTTONS: Array<{ label: string; command: string; value?: string }> = [
  { label: "B", command: "bold" },
  { label: "I", command: "italic" },
  { label: "U", command: "underline" },
  { label: "S", command: "strikeThrough" },
  { label: "Quote", command: "formatBlock", value: "blockquote" },
  { label: "Code", command: "formatBlock", value: "pre" },
  { label: "H1", command: "formatBlock", value: "h1" },
  { label: "H2", command: "formatBlock", value: "h2" },
  { label: "P", command: "formatBlock", value: "p" },
  { label: "1.", command: "insertOrderedList" },
  { label: "•", command: "insertUnorderedList" },
  { label: "x₂", command: "subscript" },
  { label: "x²", command: "superscript" },
  { label: "L", command: "justifyLeft" },
  { label: "C", command: "justifyCenter" },
  { label: "R", command: "justifyRight" },
  { label: "Clear", command: "removeFormat" },
];

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
    const url = window.prompt("URL");
    if (!url || url.trim().toLowerCase().startsWith("javascript:")) {
      return;
    }
    runCommand("createLink", url.trim());
  }

  function insertImage() {
    const url = window.prompt("Image URL");
    if (!url || url.trim().toLowerCase().startsWith("javascript:")) {
      return;
    }
    runCommand("insertImage", url.trim());
  }

  return (
    <aside className="designer-notes-overlay diagram-notes-panel" aria-label={t("notesPanel.shellAria")}>
      <div className="designer-notes-toolbar">
        {FORMAT_BUTTONS.map((button) => (
          <button key={`${button.command}-${button.value ?? ""}`} type="button" onClick={() => runCommand(button.command, button.value)}>
            {button.label}
          </button>
        ))}
        <button type="button" onClick={insertLink}>Link</button>
        <button type="button" onClick={insertImage}>Image</button>
        {props.onClose ? <button type="button" className="designer-notes-hide" onClick={props.onClose}>Hide</button> : null}
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
