"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type ToggleEvent,
} from "react";

/**
 * A menu button: a trigger that opens a popover menu of commands. Follows the menu
 * button pattern:
 *
 * - Click (or Enter / Space) toggles. Keyboard opens move focus to the first item;
 *   pointer opens leave it on the trigger, and ArrowDown then enters the menu.
 * - ArrowUp / ArrowDown / Home / End move between enabled items, wrapping around.
 *   (Not native `focusgroup`: Chromium supports it, but doesn't expose the menu roles it
 *   should infer, so the markup sets the roles and this handles the keys everywhere.)
 * - Escape, or choosing a command, closes the menu and returns focus to the trigger
 *   (without a focus ring after pointer use). Tab or clicking outside closes it.
 * - The menu is a `popover="auto"`, positioned by CSS anchor positioning where
 *   supported and by script otherwise.
 */
export interface MenuButton {
  isOpen: boolean;
  triggerProps: {
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  };
  menuProps: {
    popover: "auto";
    onToggle: (event: ToggleEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  };
  /** Runs `action` for a chosen item, then closes the menu and restores focus. */
  choose: (action: () => void, event: MouseEvent) => void;
  /** Closes the menu, returning focus to the trigger (without a ring after pointer use). */
  close: (fromPointer: boolean) => void;
}

/** Whether this browser supports popovers. `false` during SSR and the first render. */
export function usePopoverSupport(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => Object.hasOwn(HTMLElement.prototype, "popover"),
    () => false,
  );
}

function noSubscription(): () => void {
  return () => {};
}

const hasAnchorPositioning = (): boolean =>
  typeof CSS !== "undefined" && CSS.supports("position-area: block-end");

/** The menu's items, in order: enabled, shown buttons in its own item list. */
function itemsOf(menu: HTMLElement): HTMLButtonElement[] {
  return [...menu.querySelectorAll<HTMLButtonElement>(".rpv-menu-items > button")].filter(
    // Items can be hidden by CSS (the hand tool, when the toolbar shows its own switch).
    (item) => !item.disabled && item.getClientRects().length > 0,
  );
}

export function useMenuButton(
  triggerRef: RefObject<HTMLButtonElement | null>,
  menuRef: RefObject<HTMLElement | null>,
): MenuButton {
  const [isOpen, setIsOpen] = useState(false);
  // Whether the next open came from the keyboard, and should move focus into the menu.
  // A ref: the toggle event can arrive before React re-renders.
  const enterOnOpen = useRef(false);

  // Close when focus moves anywhere outside the trigger and menu (Tab, say).
  useEffect(() => {
    if (!isOpen) return;
    function onFocusIn(event: FocusEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      menuRef.current?.hidePopover();
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [isOpen, triggerRef, menuRef]);

  const open = useCallback(
    (fromKeyboard: boolean) => {
      const menu = menuRef.current;
      const trigger = triggerRef.current;
      if (!menu || !trigger) return;
      enterOnOpen.current = fromKeyboard;
      menu.showPopover({ source: trigger });
    },
    [menuRef, triggerRef],
  );

  const close = useCallback(
    (fromPointer: boolean) => {
      // Focus the trigger first, so closing never leaves focus in hidden content.
      triggerRef.current?.focus({ focusVisible: !fromPointer });
      menuRef.current?.hidePopover();
    },
    [triggerRef, menuRef],
  );

  return {
    isOpen,
    triggerProps: {
      "aria-haspopup": "menu",
      "aria-expanded": isOpen,
      onClick(event) {
        if (isOpen) {
          close(event.detail > 0);
        } else {
          // A click with `detail === 0` came from Enter or Space.
          open(event.detail === 0);
        }
      },
      onKeyDown(event) {
        // After a pointer open focus stays here, so Escape must close from here too.
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          close(false);
          return;
        }
        if (event.key !== "ArrowDown") return;
        event.preventDefault();
        if (isOpen) itemsOf(menuRef.current!)[0]?.focus();
        else open(true);
      },
    },
    menuProps: {
      popover: "auto",
      onToggle(event) {
        const nowOpen = event.newState === "open";
        setIsOpen(nowOpen);
        const menu = event.currentTarget;
        const trigger = triggerRef.current;
        if (!nowOpen || !trigger) return;

        if (!hasAnchorPositioning()) positionBelow(menu, trigger);
        if (enterOnOpen.current) itemsOf(menu)[0]?.focus();
        // After a pointer open, keep focus on the trigger (without a ring), so arrow
        // keys still work: Safari doesn't focus buttons on click.
        else trigger.focus({ focusVisible: false });
      },
      onKeyDown(event) {
        const menu = event.currentTarget;
        if (event.key === "Escape") {
          event.preventDefault();
          close(false);
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

        const items = itemsOf(menu);
        if (items.length === 0) return;
        const current = items.findIndex((item) => item === document.activeElement);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
        event.preventDefault();
        items[next]?.focus();
      },
      onPointerMove(event) {
        // Hover follows focus, so pointer and keyboard agree on the current item.
        const item =
          event.target instanceof Element ? event.target.closest(".rpv-menu-items > button") : null;
        if (
          item instanceof HTMLButtonElement &&
          !item.disabled &&
          document.activeElement !== item
        ) {
          item.focus({ focusVisible: false });
        }
      },
    },
    choose(action, event) {
      action();
      close(event.detail > 0);
    },
    close,
  };
}

/**
 * Places the menu under the trigger, aligned to its end edge, flipping above when there
 * isn't room below and keeping it inside the viewport. Only for browsers without CSS
 * anchor positioning.
 */
function positionBelow(menu: HTMLElement, trigger: HTMLElement): void {
  const gap = 4;
  const margin = 8;
  const anchor = trigger.getBoundingClientRect();
  const { offsetWidth: width, offsetHeight: height } = menu;
  const isRtl = getComputedStyle(trigger).direction === "rtl";

  let left = isRtl ? anchor.left : anchor.right - width;
  left = Math.min(Math.max(left, margin), window.innerWidth - width - margin);
  let top = anchor.bottom + gap;
  if (top + height > window.innerHeight - margin && anchor.top - gap - height >= margin) {
    top = anchor.top - gap - height;
  }
  Object.assign(menu.style, {
    position: "fixed",
    inset: "auto",
    margin: "0",
    left: `${left}px`,
    top: `${top}px`,
  });
}
