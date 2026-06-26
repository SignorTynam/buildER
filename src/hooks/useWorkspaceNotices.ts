import { useEffect, useRef, useState } from "react";
import type { ValidationIssue } from "../types/diagram";

export interface WorkspaceNotice {
  id: number;
  title?: string;
  message: string;
  tone: "success" | "warning" | "error" | "info";
  sticky?: boolean;
  stickyType?: "source-selection" | "selection-warning";
  targetId?: string;
  createdAt: number;
  actionLabel?: string;
  onAction?: () => void;
}

export const NOTICE_DURATION_MS = {
  success: 3200,
  info: 3600,
  warning: 4400,
  error: 6200,
} as const;
export const STATUS_FOLLOWUP_NOTICE_MS = 2600;
export const MAX_NOTICE_HISTORY = 8;

type WorkspaceNoticeOptions = {
  title?: string;
  sticky?: boolean;
  stickyType?: WorkspaceNotice["stickyType"];
  targetId?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function getWorkspaceNoticeDeduplicationKey(
  notice: Pick<WorkspaceNotice, "message" | "tone"> &
    Partial<Pick<WorkspaceNotice, "title" | "stickyType" | "targetId">>,
): string {
  return [
    notice.tone,
    notice.title ?? "",
    notice.message,
    notice.stickyType ?? "",
    notice.targetId ?? "",
  ].join("\u001f");
}

interface UseWorkspaceNoticesOptions {
  formatErrorMessage: (message: string) => string;
}

export function useWorkspaceNotices({ formatErrorMessage }: UseWorkspaceNoticesOptions) {
  const [statusMessage, setStatusMessage] = useState("");
  const [notices, setNotices] = useState<WorkspaceNotice[]>([]);
  const nextNoticeIdRef = useRef(1);
  const noticeTimeoutsRef = useRef(new Map<number, number>());

  function clearNoticeTimer(noticeId: number) {
    const timeoutId = noticeTimeoutsRef.current.get(noticeId);
    if (timeoutId === undefined) {
      return;
    }

    window.clearTimeout(timeoutId);
    noticeTimeoutsRef.current.delete(noticeId);
  }

  function removeNotice(noticeId: number) {
    clearNoticeTimer(noticeId);
    setNotices((current) => current.filter((notice) => notice.id !== noticeId));
  }

  function clearNotices() {
    noticeTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    noticeTimeoutsRef.current.clear();
    setNotices([]);
  }

  function dismissStickyNotices(stickyType?: WorkspaceNotice["stickyType"]) {
    setNotices((current) => {
      const stickyNotices = current.filter(
        (notice) => notice.sticky && (stickyType === undefined || notice.stickyType === stickyType),
      );
      if (stickyNotices.length === 0) {
        return current;
      }

      stickyNotices.forEach((notice) => clearNoticeTimer(notice.id));
      return current.filter((notice) => !stickyNotices.some((stickyNotice) => stickyNotice.id === notice.id));
    });
  }

  function showSelectionWarningNotice(issue: ValidationIssue) {
    if (issue.level !== "warning") {
      return;
    }

    setNotices((current) => {
      const existing = current.find((notice) => notice.stickyType === "selection-warning");
      if (existing && existing.targetId === issue.targetId && existing.message === issue.message) {
        return current;
      }

      const selectionWarningNotices = current.filter((notice) => notice.stickyType === "selection-warning");
      selectionWarningNotices.forEach((notice) => clearNoticeTimer(notice.id));

      const retained = current.filter((notice) => notice.stickyType !== "selection-warning");
      return [
        {
          id: nextNoticeIdRef.current++,
          title: "Avviso di validazione",
          message: issue.message,
          tone: "warning",
          sticky: true,
          stickyType: "selection-warning",
          targetId: issue.targetId,
          createdAt: Date.now(),
        },
        ...retained,
      ];
    });
  }

  function showNotice(notice: Omit<WorkspaceNotice, "id" | "createdAt">, duration: number | null = NOTICE_DURATION_MS[notice.tone]) {
    let id = nextNoticeIdRef.current++;
    const createdAt = Date.now();

    setNotices((current) => {
      const nextKey = getWorkspaceNoticeDeduplicationKey(notice);
      const duplicate = current.find((item) => getWorkspaceNoticeDeduplicationKey(item) === nextKey);
      if (duplicate) {
        id = duplicate.id;
        clearNoticeTimer(id);
        const updated: WorkspaceNotice = {
          ...duplicate,
          ...notice,
          id,
          createdAt,
        };
        return [updated, ...current.filter((item) => item.id !== id)];
      }

      const preservedSelectionWarningNotices =
        notice.stickyType === "selection-warning"
          ? []
          : current.filter((item) => item.stickyType === "selection-warning");
      const retained = current
        .filter((item) => item.message !== notice.message && !item.sticky)
        .slice(0, MAX_NOTICE_HISTORY - preservedSelectionWarningNotices.length - 1);
      const removed = current.filter(
        (item) =>
          !retained.some((kept) => kept.id === item.id) &&
          !preservedSelectionWarningNotices.some((kept) => kept.id === item.id),
      );
      removed.forEach((item) => clearNoticeTimer(item.id));
      return [{ id, createdAt, ...notice }, ...preservedSelectionWarningNotices, ...retained];
    });

    if (duration !== null) {
      const timeoutId = window.setTimeout(() => {
        removeNotice(id);
      }, duration);
      noticeTimeoutsRef.current.set(id, timeoutId);
    }
  }

  function showErrorNotice(message: string, options?: WorkspaceNoticeOptions) {
    showNotice({
      title: options?.title,
      message: formatErrorMessage(message),
      tone: "error",
      sticky: options?.sticky,
      stickyType: options?.stickyType,
      targetId: options?.targetId,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
    });
  }

  function showWarningNotice(message: string, options?: WorkspaceNoticeOptions) {
    const sticky = options?.sticky === true || options?.stickyType !== undefined;
    showNotice(
      {
        title: options?.title,
        message,
        tone: "warning",
        sticky,
        stickyType: options?.stickyType,
        targetId: options?.targetId,
        actionLabel: options?.actionLabel,
        onAction: options?.onAction,
      },
      sticky ? null : NOTICE_DURATION_MS.warning,
    );
  }

  function showSuccessNotice(message: string, options?: WorkspaceNoticeOptions) {
    showNotice({
      title: options?.title,
      message,
      tone: "success",
      sticky: options?.sticky,
      stickyType: options?.stickyType,
      targetId: options?.targetId,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
    });
  }

  function showInfoNotice(message: string, options?: WorkspaceNoticeOptions) {
    showNotice({
      title: options?.title,
      message,
      tone: "info",
      sticky: options?.sticky,
      stickyType: options?.stickyType,
      targetId: options?.targetId,
      actionLabel: options?.actionLabel,
      onAction: options?.onAction,
    });
  }

  function setStatus(message: string) {
    setStatusMessage(message);
    if (!message.trim()) {
      dismissStickyNotices("source-selection");
    }
  }

  function setStatusWarning(message: string, options?: WorkspaceNoticeOptions) {
    setStatusMessage(message);
    showWarningNotice(message, { ...options, title: options?.title ?? "Operazione non valida" });
  }

  function setStatusSuccess(message: string) {
    setStatusMessage(message);
  }

  function setStatusError(message: string, options?: WorkspaceNoticeOptions) {
    const normalizedError = formatErrorMessage(message);
    setStatusMessage(normalizedError);
    showErrorNotice(normalizedError, { ...options, title: options?.title ?? "Errore" });
  }

  useEffect(() => {
    if (!statusMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatusMessage("");
    }, STATUS_FOLLOWUP_NOTICE_MS);

    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    return () => {
      noticeTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      noticeTimeoutsRef.current.clear();
    };
  }, []);

  return {
    notices,
    statusMessage,
    setStatusMessage,
    setStatus,
    setStatusWarning,
    setStatusSuccess,
    setStatusError,
    showNotice,
    showErrorNotice,
    showWarningNotice,
    showSuccessNotice,
    showInfoNotice,
    showSelectionWarningNotice,
    removeNotice,
    clearNotices,
    dismissStickyNotices,
  };
}
