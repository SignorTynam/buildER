import { useMemo } from "react";
import { useI18n } from "../../i18n/useI18n";

interface VersionCompareTextDiffProps {
  leftLabel: string;
  rightLabel: string;
  fileName: string;
  leftContent: string;
  rightContent: string;
  language: "text" | "sql" | "unknown";
  leftMissing?: boolean;
  rightMissing?: boolean;
}

interface DiffLine {
  lineNumber: number;
  text: string;
  changed: boolean;
}

function splitLines(content: string): string[] {
  return content.length > 0 ? content.split(/\r?\n/) : [];
}

function buildSideBySideLines(leftContent: string, rightContent: string): { left: DiffLine[]; right: DiffLine[] } {
  const leftLines = splitLines(leftContent);
  const rightLines = splitLines(rightContent);
  const maxLength = Math.max(leftLines.length, rightLines.length);
  const left: DiffLine[] = [];
  const right: DiffLine[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    const leftText = leftLines[index] ?? "";
    const rightText = rightLines[index] ?? "";
    const changed = leftText !== rightText;
    left.push({ lineNumber: index + 1, text: leftText, changed });
    right.push({ lineNumber: index + 1, text: rightText, changed });
  }

  return { left, right };
}

function languageLabel(language: VersionCompareTextDiffProps["language"]) {
  if (language === "sql") {
    return "SQL";
  }

  if (language === "text") {
    return "Text";
  }

  return "File";
}

export function VersionCompareTextDiff({
  leftLabel,
  rightLabel,
  fileName,
  leftContent,
  rightContent,
  language,
  leftMissing = false,
  rightMissing = false,
}: VersionCompareTextDiffProps) {
  const { t } = useI18n();
  const lines = useMemo(() => buildSideBySideLines(leftContent, rightContent), [leftContent, rightContent]);

  function renderPane(side: "left" | "right", label: string, missing: boolean, sideLines: DiffLine[]) {
    return (
      <section className={`version-compare-text-pane is-${side}`} data-testid={`version-compare-text-${side}`}>
        <header className="version-compare-text-pane-header">
          <strong>{label}</strong>
          {missing ? (
            <span>{side === "left" ? t("versioning.compareScope.noFileInLeft") : t("versioning.compareScope.noFileInRight")}</span>
          ) : (
            <span>{sideLines.length} lines</span>
          )}
        </header>
        {missing ? (
          <div className="version-compare-text-missing">
            {side === "left" ? t("versioning.compareScope.noFileInLeft") : t("versioning.compareScope.noFileInRight")}
          </div>
        ) : (
          <pre className="version-compare-text-lines">
            {sideLines.map((line) => (
              <div key={`${side}-${line.lineNumber}`} className={line.changed ? "is-changed" : ""}>
                <span className="version-compare-text-line-number">{line.lineNumber}</span>
                <code>{line.text || " "}</code>
              </div>
            ))}
          </pre>
        )}
      </section>
    );
  }

  return (
    <section className="version-compare-text-diff" data-testid="version-compare-text-diff">
      <header className="version-compare-scope-header">
        <div>
          <span>{languageLabel(language)}</span>
          <strong>{fileName}</strong>
        </div>
      </header>
      <div className="version-compare-text-grid">
        {renderPane("left", leftLabel, leftMissing, lines.left)}
        {renderPane("right", rightLabel, rightMissing, lines.right)}
      </div>
    </section>
  );
}
