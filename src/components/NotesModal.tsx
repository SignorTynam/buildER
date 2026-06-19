import { useEffect, useRef, useState } from "react";
import type { MessageKey } from "../i18n";
import { useI18n } from "../i18n/useI18n";
import { StudioIcon } from "./icons/StudioIcon";

interface NotesModalProps {
  open: boolean;
  notes: string;
  editable?: boolean;
  onSave: (value: string) => void;
  onClose: () => void;
}

const ALLOWED_NOTES_TAGS = new Set(["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li"]);
const REMOVED_NOTES_TAGS = new Set(["script", "iframe", "object", "embed", "style", "img"]);

const FORMAT_BUTTONS = [
  { labelKey: "notesPanel.toolbar.normal", ariaKey: "notesPanel.toolbar.normal", command: "formatBlock", value: "p" },
  { label: "B", ariaKey: "notesPanel.toolbar.bold", command: "bold" },
  { label: "I", ariaKey: "notesPanel.toolbar.italic", command: "italic" },
  { label: "U", ariaKey: "notesPanel.toolbar.underline", command: "underline" },
  { label: "*", ariaKey: "notesPanel.toolbar.unorderedList", command: "insertUnorderedList" },
  { label: "1.", ariaKey: "notesPanel.toolbar.orderedList", command: "insertOrderedList" },
  { labelKey: "notesPanel.toolbar.clearFormatting", ariaKey: "notesPanel.toolbar.clearFormatting", command: "removeFormat" },
] satisfies Array<{ label?: string; labelKey?: MessageKey; ariaKey: MessageKey; command: string; value?: string }>;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sanitizeNode(node: Node, documentRef: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return documentRef.createTextNode(node.textContent ?? "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  if (REMOVED_NOTES_TAGS.has(tagName)) {
    return null;
  }

  const sanitizedChildren = Array.from(element.childNodes)
    .map((child) => sanitizeNode(child, documentRef))
    .filter((child): child is Node => child !== null);

  if (!ALLOWED_NOTES_TAGS.has(tagName)) {
    const fragment = documentRef.createDocumentFragment();
    sanitizedChildren.forEach((child) => fragment.appendChild(child));
    return fragment;
  }

  const sanitizedElement = documentRef.createElement(tagName);
  sanitizedChildren.forEach((child) => sanitizedElement.appendChild(child));
  return sanitizedElement;
}

export function sanitizeNotesHtml(value: string): string {
  if (!value.trim() || typeof DOMParser === "undefined") {
    return "";
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(value, "text/html");
  const fragment = doc.createDocumentFragment();
  Array.from(doc.body.childNodes).forEach((node) => {
    const sanitizedNode = sanitizeNode(node, doc);
    if (sanitizedNode) {
      fragment.appendChild(sanitizedNode);
    }
  });
  doc.body.replaceChildren(fragment);
  return doc.body.innerHTML.trim();
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
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function NotesModal(props: NotesModalProps) {
  const { t } = useI18n();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [initialHtml, setInitialHtml] = useState("");
  const [dirty, setDirty] = useState(false);
  const isReadOnly = props.editable === false;

  useEffect(() => {
    if (!props.open) {
      return;
    }

    const nextHtml = htmlFromNotes(props.notes);
    setInitialHtml(nextHtml);
    setDirty(false);
    window.setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = nextHtml;
        editorRef.current.focus();
      }
    }, 0);
  }, [props.notes, props.open]);

  useEffect(() => {
    if (!props.open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  if (!props.open) {
    return null;
  }

  function getCurrentHtml(): string {
    return sanitizeNotesHtml(editorRef.current?.innerHTML ?? "");
  }

  function requestClose() {
    if (!dirty || window.confirm(t("notesPanel.unsavedConfirm"))) {
      props.onClose();
    }
  }

  function handleInput() {
    setDirty(getCurrentHtml() !== initialHtml);
  }

  function runCommand(command: string, value?: string) {
    if (isReadOnly) {
      return;
    }
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleInput();
  }

  function handleSave() {
    props.onSave(getCurrentHtml());
    props.onClose();
  }

  return (
    <div className="notes-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        requestClose();
      }
    }}>
      <section className="notes-modal" role="dialog" aria-modal="true" aria-labelledby="notes-modal-title">
        <header className="notes-modal-header">
          <div>
            <h2 id="notes-modal-title">{t("notesPanel.title")}</h2>
            <p>{t("notesPanel.description")}</p>
          </div>
          <button type="button" className="notes-modal-close" onClick={requestClose} aria-label={t("notesPanel.closeAria")} title={t("notesPanel.closeAria")}>
            <StudioIcon name="close" aria-hidden="true" />
          </button>
        </header>
        <div className="notes-modal-toolbar" role="toolbar" aria-label={t("notesPanel.toolbar.aria")}>
          {FORMAT_BUTTONS.map((button) => (
            <button
              key={`${button.command}-${button.value ?? ""}`}
              type="button"
              onClick={() => runCommand(button.command, button.value)}
              disabled={isReadOnly}
              aria-label={t(button.ariaKey)}
              title={t(button.ariaKey)}
            >
              {button.labelKey ? t(button.labelKey) : button.label}
            </button>
          ))}
        </div>
        <div
          ref={editorRef}
          className="notes-modal-editor"
          contentEditable={!isReadOnly}
          suppressContentEditableWarning
          onInput={handleInput}
          data-placeholder={t("notesPanel.placeholder")}
          aria-label={t("notesPanel.editorAria")}
        />
        <footer className="notes-modal-actions">
          <button type="button" className="studio-secondary-button" onClick={requestClose}>
            {t("common.actions.cancel")}
          </button>
          <button type="button" className="studio-primary-button" onClick={handleSave} disabled={isReadOnly}>
            {t("common.actions.save")}
          </button>
        </footer>
      </section>
    </div>
  );
}
