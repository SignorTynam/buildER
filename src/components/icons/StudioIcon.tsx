import type { SVGProps } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  Braces,
  ChevronsDown,
  ChevronsUp,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  ClipboardPaste,
  Copy as CopyIcon,
  CopyPlus,
  Crosshair,
  Database,
  DatabaseZap,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  FileImage,
  FilePlus,
  FileText,
  FileType,
  Focus,
  FolderOpen,
  GitBranchPlus,
  GitBranch,
  Globe2,
  History,
  Image,
  Info,
  KeyRound,
  Keyboard,
  Lightbulb,
  Menu,
  Merge,
  Minus,
  MousePointer2,
  Move as MoveIcon,
  NotebookText,
  OctagonAlert,
  PanelLeftOpen,
  PanelRightOpen,
  PanelsTopLeft,
  Pencil,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Scan,
  Search,
  Sparkles,
  Split,
  Tag,
  Trash2,
  TriangleAlert,
  Undo2,
  Redo2,
  Unlink,
  Upload,
  WandSparkles,
  Workflow,
  X as XIcon,
  type LucideIcon,
} from "lucide-react";

export type StudioIconName =
  | "arrowDown"
  | "arrowRight"
  | "arrowUp"
  | "attribute"
  | "bookOpen"
  | "branch"
  | "braces"
  | "cardinality"
  | "center"
  | "close"
  | "code"
  | "compositeId"
  | "connector"
  | "copy"
  | "database"
  | "databaseReverse"
  | "delete"
  | "design"
  | "done"
  | "download"
  | "duplicate"
  | "entity"
  | "error"
  | "errors"
  | "export"
  | "externalId"
  | "fileImage"
  | "fileText"
  | "fit"
  | "fix"
  | "focus"
  | "globe"
  | "help"
  | "history"
  | "image"
  | "info"
  | "isa"
  | "isaType"
  | "keyboard"
  | "lightbulb"
  | "menu"
  | "merge"
  | "mixedId"
  | "move"
  | "moveDown"
  | "moveToBottom"
  | "moveToTop"
  | "moveUp"
  | "newProject"
  | "notes"
  | "openProject"
  | "panelLeft"
  | "pan"
  | "paste"
  | "parent"
  | "redo"
  | "relationship"
  | "refresh"
  | "removeHierarchy"
  | "rename"
  | "reset"
  | "role"
  | "save"
  | "search"
  | "select"
  | "show"
  | "simpleId"
  | "split"
  | "success"
  | "translate"
  | "type"
  | "undo"
  | "unique"
  | "upload"
  | "viewOff"
  | "viewOn"
  | "warning"
  | "zoomIn"
  | "zoomOut";

export type StudioIconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: StudioIconName;
  size?: number | string;
  strokeWidth?: number;
  title?: string;
};

const lucideIcons: Partial<Record<StudioIconName, LucideIcon>> = {
  arrowDown: ArrowDown,
  arrowRight: ArrowRight,
  arrowUp: ArrowUp,
  bookOpen: BookOpen,
  branch: GitBranch,
  braces: Braces,
  center: Crosshair,
  close: XIcon,
  code: FileCode2,
  copy: CopyIcon,
  database: Database,
  databaseReverse: DatabaseZap,
  delete: Trash2,
  design: PanelsTopLeft,
  done: CircleCheck,
  download: Download,
  duplicate: CopyPlus,
  error: OctagonAlert,
  errors: CircleAlert,
  export: Download,
  fileImage: FileImage,
  fileText: FileText,
  fit: Scan,
  fix: WandSparkles,
  focus: Focus,
  globe: Globe2,
  help: CircleHelp,
  history: History,
  image: Image,
  info: Info,
  keyboard: Keyboard,
  lightbulb: Lightbulb,
  menu: Menu,
  merge: Merge,
  move: ArrowUpDown,
  moveDown: ArrowDown,
  moveToBottom: ChevronsDown,
  moveToTop: ChevronsUp,
  moveUp: ArrowUp,
  newProject: FilePlus,
  notes: NotebookText,
  openProject: FolderOpen,
  panelLeft: PanelLeftOpen,
  pan: MoveIcon,
  paste: ClipboardPaste,
  parent: GitBranchPlus,
  redo: Redo2,
  refresh: RefreshCcw,
  removeHierarchy: Unlink,
  rename: Pencil,
  reset: RotateCcw,
  role: Tag,
  save: Save,
  search: Search,
  select: MousePointer2,
  show: PanelRightOpen,
  split: Split,
  success: CircleCheck,
  translate: Workflow,
  type: FileType,
  undo: Undo2,
  unique: KeyRound,
  upload: Upload,
  viewOff: EyeOff,
  viewOn: Eye,
  warning: TriangleAlert,
  zoomIn: Plus,
  zoomOut: Minus,
};

function CustomIcon({
  name,
  common,
}: {
  name: StudioIconName;
  common: Pick<SVGProps<SVGSVGElement>, "fill" | "stroke" | "strokeWidth" | "strokeLinecap" | "strokeLinejoin">;
}) {
  if (name === "entity") {
    return <rect {...common} x="5" y="7" width="14" height="10" rx="1.5" />;
  }

  if (name === "relationship") {
    return <path {...common} d="M12 4 21 12 12 20 3 12 12 4z" />;
  }

  if (name === "attribute") {
    return (
      <>
        <path {...common} d="M4 12h7" />
        <ellipse {...common} cx="16" cy="12" rx="4.5" ry="3.5" />
      </>
    );
  }

  if (name === "connector") {
    return (
      <>
        <circle {...common} cx="7" cy="7" r="2.5" />
        <circle {...common} cx="17" cy="17" r="2.5" />
        <path {...common} d="M9 9l6 6" />
      </>
    );
  }

  if (name === "isa" || name === "isaType") {
    return (
      <>
        <path {...common} d="M12 5 5 18h14L12 5z" />
        <path {...common} d="M12 18v-5" />
      </>
    );
  }

  if (name === "simpleId") {
    return (
      <>
        <ellipse {...common} cx="12" cy="12" rx="5.5" ry="4.2" />
        <circle cx="12" cy="12" r="2.3" fill="currentColor" />
      </>
    );
  }

  if (name === "compositeId") {
    return (
      <>
        <ellipse {...common} cx="8" cy="12" rx="3.4" ry="3" />
        <ellipse {...common} cx="16" cy="12" rx="3.4" ry="3" />
        <circle cx="8" cy="12" r="1.55" fill="currentColor" />
        <circle cx="16" cy="12" r="1.55" fill="currentColor" />
      </>
    );
  }

  if (name === "externalId") {
    return (
      <>
        <ellipse {...common} cx="9" cy="12" rx="4" ry="3.4" />
        <path {...common} d="M13 12h5" />
        <circle cx="18" cy="12" r="2.2" fill="currentColor" />
      </>
    );
  }

  if (name === "mixedId") {
    return (
      <>
        <ellipse {...common} cx="8" cy="12" rx="3.4" ry="3" />
        <circle cx="8" cy="12" r="1.5" fill="currentColor" />
        <path {...common} d="M12 12h5" />
        <circle {...common} cx="18" cy="12" r="2.8" />
      </>
    );
  }

  if (name === "cardinality") {
    return (
      <>
        <rect {...common} x="4" y="7" width="16" height="10" rx="2" />
        <path {...common} d="M8 10v4M12 10v4M16 10v4" />
      </>
    );
  }

  return null;
}

export function StudioIcon({
  name,
  size = 18,
  strokeWidth = 2,
  className,
  title,
  "aria-hidden": ariaHidden,
  ...rest
}: StudioIconProps) {
  const classNames = ["studio-icon", className].filter(Boolean).join(" ");
  const Icon = lucideIcons[name];

  if (Icon) {
    return (
      <Icon
        aria-hidden={ariaHidden ?? (title ? undefined : true)}
        className={classNames}
        size={size}
        strokeWidth={strokeWidth}
        role={title ? "img" : undefined}
        {...rest}
      >
        {title ? <title>{title}</title> : null}
      </Icon>
    );
  }

  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      aria-hidden={ariaHidden ?? (title ? undefined : true)}
      className={classNames}
      fill="none"
      height={size}
      role={title ? "img" : undefined}
      viewBox="0 0 24 24"
      width={size}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <CustomIcon name={name} common={common} />
    </svg>
  );
}
