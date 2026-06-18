import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";

export interface FloatingExportMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}

interface FloatingExportMenuProps {
  open: boolean;
  anchorRef: RefObject<HTMLElement>;
  ariaLabel: string;
  items: FloatingExportMenuItem[];
  onClose: () => void;
}

interface MenuPosition {
  left: number;
  top: number;
}

const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getMenuPosition(anchorRect: DOMRect, menuRect: DOMRect): MenuPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const menuWidth = menuRect.width;
  const menuHeight = menuRect.height;
  const rightSideLeft = anchorRect.right + ANCHOR_GAP;
  const leftSideLeft = anchorRect.left - menuWidth - ANCHOR_GAP;
  const fitsRight = rightSideLeft + menuWidth <= viewportWidth - VIEWPORT_MARGIN;
  const left = fitsRight
    ? rightSideLeft
    : Math.max(VIEWPORT_MARGIN, leftSideLeft);
  const preferredTop = anchorRect.bottom - menuHeight;
  const maxTop = Math.max(VIEWPORT_MARGIN, viewportHeight - menuHeight - VIEWPORT_MARGIN);

  return {
    left: clamp(left, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, viewportWidth - menuWidth - VIEWPORT_MARGIN)),
    top: clamp(preferredTop, VIEWPORT_MARGIN, maxTop),
  };
}

export function FloatingExportMenu(props: FloatingExportMenuProps) {
  const { open, anchorRef, ariaLabel, items, onClose } = props;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor || !menu) {
        return;
      }

      setPosition(getMenuPosition(anchor.getBoundingClientRect(), menu.getBoundingClientRect()));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, open, items.length]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }

      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="floating-export-popover"
      role="menu"
      aria-label={ariaLabel}
      style={{
        left: position ? `${position.left}px` : `${VIEWPORT_MARGIN}px`,
        top: position ? `${position.top}px` : `${VIEWPORT_MARGIN}px`,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          title={item.title}
          onClick={() => {
            if (item.disabled) {
              return;
            }

            onClose();
            item.onClick();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
