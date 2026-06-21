import { useEffect, useRef, useState } from "react";
import type { ValidationIssue } from "../types/diagram";

export interface WorkspaceNotice {
  id: number;
  message: string;
  tone: "success" | "warning" | "error";
  sticky?: boolean;
  stickyType?: "source-selection" | "selection-warning";
  targetId?: string;
}

export const NOTICE_DURATION_MS = {
  success: 3200,
  warning: 4400,
  error: 6200,
} as const;
export const STATUS_FOLLOWUP_NOTICE_MS = 2600;

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
          message: issue.message,
          tone: "warning",
          sticky: true,
          stickyType: "selection-warning",
          targetId: issue.targetId,
        },
        ...retained,
      ];
    });
  }

  function showNotice(notice: Omit<WorkspaceNotice, "id">, duration: number | null = NOTICE_DURATION_MS[notice.tone]) {
    const id = nextNoticeIdRef.current++;

    setNotices((current) => {
      const preservedSelectionWarningNotices =
        notice.stickyType === "selection-warning"
          ? []
          : current.filter((item) => item.stickyType === "selection-warning");
      const retained = current.filter((item) => item.message !== notice.message && !item.sticky).slice(0, 1);
      const removed = current.filter(
        (item) =>
          !retained.some((kept) => kept.id === item.id) &&
          !preservedSelectionWarningNotices.some((kept) => kept.id === item.id),
      );
      removed.forEach((item) => clearNoticeTimer(item.id));
      return [{ id, ...notice }, ...preservedSelectionWarningNotices, ...retained];
    });

    if (duration !== null) {
      const timeoutId = window.setTimeout(() => {
        removeNotice(id);
      }, duration);
      noticeTimeoutsRef.current.set(id, timeoutId);
    }
  }

  function showErrorNotice(message: string) {
    showNotice({
      message: formatErrorMessage(message),
      tone: "error",
    });
  }

  function showWarningNotice(message: string, options?: { stickyType?: WorkspaceNotice["stickyType"] }) {
    const sticky = options?.stickyType !== undefined;
    showNotice(
      {
        message,
        tone: "warning",
        sticky,
        stickyType: options?.stickyType,
      },
      sticky ? null : NOTICE_DURATION_MS.warning,
    );
  }

  function showSuccessNotice(message: string) {
    showNotice({
      message,
      tone: "success",
    });
  }

  function setStatus(message: string) {
    setStatusMessage(message);
    if (!message.trim()) {
      dismissStickyNotices("source-selection");
      return;
    }

    if (notices.some((notice) => notice.sticky)) {
      showNotice(
        {
          message,
          tone: "success",
        },
        STATUS_FOLLOWUP_NOTICE_MS,
      );
    }
  }

  function setStatusWarning(message: string) {
    setStatusMessage(message);
    showWarningNotice(message);
  }

  function setStatusSuccess(message: string) {
    setStatusMessage(message);
    showSuccessNotice(message);
  }

  function setStatusError(message: string) {
    const normalizedError = formatErrorMessage(message);
    setStatusMessage(normalizedError);
    showErrorNotice(normalizedError);
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
    showSelectionWarningNotice,
    removeNotice,
    clearNotices,
    dismissStickyNotices,
  };
}
