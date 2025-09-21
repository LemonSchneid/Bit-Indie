"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  /**
   * Controls whether the modal is visible. When `false`, the component renders nothing.
   */
  isOpen: boolean;
  /**
   * Called when the backdrop is dismissed or the escape key is pressed.
   */
  onClose?: () => void;
  children: ReactNode;
  /**
   * Additional classes for the fixed-position container that fills the viewport.
   */
  containerClassName?: string;
  /**
   * Additional classes for the dialog wrapper that contains children.
   */
  contentClassName?: string;
  /**
   * Optional React nodes rendered on top of the default backdrop layer.
   */
  backdrop?: ReactNode;
  /**
   * Tailwind classes merged into the default slate backdrop.
   */
  backdropClassName?: string;
  /**
   * Overrides whether clicking the backdrop invokes `onClose`.
   */
  shouldCloseOnBackdrop?: boolean;
  /**
   * Controls whether the escape key invokes `onClose`. Defaults to `true` when `onClose` is provided.
   */
  closeOnEscape?: boolean;
  /**
   * Accessible label applied to the modal container. Useful when no labelled element is rendered inside the dialog.
   */
  ariaLabel?: string;
  /**
   * ID of an element that labels the dialog.
   */
  ariaLabelledBy?: string;
  /**
   * Accessible label for the invisible backdrop dismissal button.
   */
  backdropAriaLabel?: string;
};

type ModalContentProps = {
  children: ReactNode;
  containerClassName?: string;
  contentClassName?: string;
  backdrop?: ReactNode;
  backdropClassName?: string;
  onClose?: () => void;
  shouldCloseOnBackdrop: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  backdropAriaLabel?: string;
};

let scrollLockDepth = 0;
let previousOverflow: string | null = null;

const joinClassNames = (...classes: Array<string | null | undefined | false>): string =>
  classes.filter(Boolean).join(" ");

const lockBodyScroll = (element: HTMLElement) => {
  if (scrollLockDepth === 0) {
    previousOverflow = element.style.overflow;
    element.style.overflow = "hidden";
  }
  scrollLockDepth += 1;
};

const unlockBodyScroll = (element: HTMLElement) => {
  if (scrollLockDepth === 0) {
    return;
  }

  scrollLockDepth -= 1;
  if (scrollLockDepth === 0) {
    element.style.overflow = previousOverflow ?? "";
    previousOverflow = null;
  }
};

const ModalContent = ({
  children,
  containerClassName,
  contentClassName,
  backdrop,
  backdropClassName,
  onClose,
  shouldCloseOnBackdrop,
  ariaLabel,
  ariaLabelledBy,
  backdropAriaLabel,
}: ModalContentProps): JSX.Element => {
  const mergedContainerClass = joinClassNames("fixed inset-0 z-50 flex", containerClassName);
  const mergedBackdropClass = joinClassNames(
    "pointer-events-none absolute inset-0 z-0 bg-slate-950/80",
    backdropClassName,
  );
  const mergedContentClass = joinClassNames("relative z-30", contentClassName);

  return (
    <div
      className={mergedContainerClass}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      <div className={mergedBackdropClass} aria-hidden="true" />
      {backdrop}
      {onClose && shouldCloseOnBackdrop ? (
        <button
          type="button"
          className="absolute inset-0 z-20 h-full w-full cursor-default bg-transparent"
          aria-label={backdropAriaLabel ?? "Close dialog"}
          onClick={onClose}
        />
      ) : null}
      <div className={mergedContentClass}>{children}</div>
    </div>
  );
};

export function Modal({
  isOpen,
  onClose,
  children,
  containerClassName,
  contentClassName,
  backdrop,
  backdropClassName,
  shouldCloseOnBackdrop = true,
  closeOnEscape = true,
  ariaLabel,
  ariaLabelledBy,
  backdropAriaLabel,
}: ModalProps): JSX.Element | null {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    setContainer(document.body);
  }, []);

  useEffect(() => {
    if (!isOpen || !container) {
      return;
    }

    lockBodyScroll(container);
    return () => {
      unlockBodyScroll(container);
    };
  }, [isOpen, container]);

  useEffect(() => {
    if (!isOpen || !onClose || !closeOnEscape) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, closeOnEscape]);

  if (!isOpen || !container) {
    return null;
  }

  return createPortal(
    <ModalContent
      onClose={onClose}
      shouldCloseOnBackdrop={shouldCloseOnBackdrop}
      containerClassName={containerClassName}
      contentClassName={contentClassName}
      backdrop={backdrop}
      backdropClassName={backdropClassName}
      ariaLabel={ariaLabel}
      ariaLabelledBy={ariaLabelledBy}
      backdropAriaLabel={backdropAriaLabel}
    >
      {children}
    </ModalContent>,
    container,
  );
}

export const __modalTesting = {
  resetScrollLocks: () => {
    scrollLockDepth = 0;
    previousOverflow = null;
  },
  lockBodyScrollForTesting: lockBodyScroll,
  unlockBodyScrollForTesting: unlockBodyScroll,
  ModalContent,
};

export type { ModalProps };
