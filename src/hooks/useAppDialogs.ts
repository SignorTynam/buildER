import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

export interface PromptDialogState {
  title: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel: string;
  required: boolean;
  requiredMessage: string;
}

interface RequestConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface RequestPromptOptions {
  title: string;
  label: string;
  initialValue: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
  requiredMessage?: string;
}

interface UseAppDialogsOptions {
  defaultConfirmLabel: string;
  defaultCancelLabel: string;
  defaultSaveLabel: string;
  defaultRequiredMessage: string;
}

export interface UseAppDialogsResult {
  confirmDialog: ConfirmDialogState | null;
  promptDialog: PromptDialogState | null;
  promptValue: string;
  promptError: string;
  promptInputRef: React.RefObject<HTMLInputElement>;
  setPromptValue: Dispatch<SetStateAction<string>>;
  setPromptError: Dispatch<SetStateAction<string>>;
  requestConfirmDialog: (options: RequestConfirmOptions) => Promise<boolean>;
  requestPromptDialog: (options: RequestPromptOptions) => Promise<string | null>;
  closeConfirmDialog: (confirmed: boolean) => void;
  closePromptDialog: (value: string | null) => void;
  submitPromptDialog: () => void;
}

export function useAppDialogs({
  defaultConfirmLabel,
  defaultCancelLabel,
  defaultSaveLabel,
  defaultRequiredMessage,
}: UseAppDialogsOptions): UseAppDialogsResult {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [promptError, setPromptError] = useState("");
  const confirmDialogResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const promptDialogResolverRef = useRef<((value: string | null) => void) | null>(null);
  const promptInputRef = useRef<HTMLInputElement | null>(null);

  function closeConfirmDialog(confirmed: boolean) {
    const resolve = confirmDialogResolverRef.current;
    confirmDialogResolverRef.current = null;
    setConfirmDialog(null);
    resolve?.(confirmed);
  }

  function requestConfirmDialog(options: RequestConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      if (confirmDialogResolverRef.current) {
        confirmDialogResolverRef.current(false);
      }

      confirmDialogResolverRef.current = resolve;
      setConfirmDialog({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? defaultConfirmLabel,
        cancelLabel: options.cancelLabel ?? defaultCancelLabel,
      });
    });
  }

  function closePromptDialog(value: string | null) {
    const resolve = promptDialogResolverRef.current;
    promptDialogResolverRef.current = null;
    setPromptDialog(null);
    setPromptValue("");
    setPromptError("");
    resolve?.(value);
  }

  function requestPromptDialog(options: RequestPromptOptions): Promise<string | null> {
    return new Promise((resolve) => {
      if (promptDialogResolverRef.current) {
        promptDialogResolverRef.current(null);
      }

      promptDialogResolverRef.current = resolve;
      setPromptDialog({
        title: options.title,
        label: options.label,
        placeholder: options.placeholder,
        confirmLabel: options.confirmLabel ?? defaultSaveLabel,
        cancelLabel: options.cancelLabel ?? defaultCancelLabel,
        required: options.required === true,
        requiredMessage: options.requiredMessage ?? defaultRequiredMessage,
      });
      setPromptValue(options.initialValue);
      setPromptError("");
    });
  }

  function submitPromptDialog() {
    if (!promptDialog) {
      return;
    }

    const normalized = promptValue.trim();
    if (promptDialog.required && !normalized) {
      setPromptError(promptDialog.requiredMessage);
      return;
    }

    closePromptDialog(normalized);
  }

  useEffect(() => {
    if (!promptDialog) {
      return;
    }

    const timeout = window.setTimeout(() => {
      promptInputRef.current?.focus();
      promptInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [promptDialog]);

  useEffect(() => {
    return () => {
      if (confirmDialogResolverRef.current) {
        confirmDialogResolverRef.current(false);
        confirmDialogResolverRef.current = null;
      }

      if (promptDialogResolverRef.current) {
        promptDialogResolverRef.current(null);
        promptDialogResolverRef.current = null;
      }
    };
  }, []);

  return {
    confirmDialog,
    promptDialog,
    promptValue,
    promptError,
    promptInputRef,
    setPromptValue,
    setPromptError,
    requestConfirmDialog,
    requestPromptDialog,
    closeConfirmDialog,
    closePromptDialog,
    submitPromptDialog,
  };
}
