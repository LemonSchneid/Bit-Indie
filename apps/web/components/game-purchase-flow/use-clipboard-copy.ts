import { useCallback, useEffect, useState } from "react";

import type { CopyState } from "./types";

type UseClipboardCopyOptions = {
  text: string | null | undefined;
  onError?: (error: unknown) => void;
};

export function useClipboardCopy({ text, onError }: UseClipboardCopyOptions) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    setCopyState("idle");
  }, [text]);

  useEffect(() => {
    if (copyState !== "copied") {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setCopyState("idle");
    }, 3000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copyState]);

  const handleCopy = useCallback(async () => {
    if (!text) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch (error) {
      setCopyState("error");
      onError?.(error);
    }
  }, [onError, text]);

  return { copyState, handleCopy } as const;
}
