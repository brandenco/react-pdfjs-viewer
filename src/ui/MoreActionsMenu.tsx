"use client";

import { useId, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";

import { usePdfViewerState } from "../headless/context.tsx";
import { useCursorMode, useDownload, useRotation } from "../headless/hooks.ts";
import { useFullscreen } from "../headless/use-fullscreen.ts";
import { usePrint } from "../headless/use-print.ts";
import { withClassName, type StyleProps } from "./class-names.ts";
import {
  DownloadIcon,
  EnterFullscreenIcon,
  ExitFullscreenIcon,
  HandIcon,
  MoreIcon,
  PrintIcon,
  RotateClockwiseIcon,
} from "./icons.tsx";
import { useShell } from "./PdfViewerShell.tsx";
import { useMenuButton, usePopoverSupport } from "./use-menu-button.ts";

const NO_TARGET = { current: null };

/** How long a toggled check mark stays visible before the menu closes. */
const CHECK_FEEDBACK_MS = 300;

/**
 * Rotate, full screen, print and download in a "More actions" menu. `<PdfToolbar>` shows
 * it in place of those four buttons when it's too narrow for them, and when narrower
 * still, the hand tool too. You can also use it in your own toolbar. Renders nothing in
 * browsers without popover support.
 */
export function MoreActionsMenu(props: StyleProps): ReactNode {
  const supportsPopover = usePopoverSupport();
  if (!supportsPopover) return null;
  return <Menu {...props} />;
}

function Menu(props: StyleProps): ReactNode {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menu = useMenuButton(triggerRef, menuRef);

  const hasDocument = usePdfViewerState((state) => state.document !== null);
  const { rotateClockwise } = useRotation();
  const cursor = useCursorMode();
  const { print, canPrint, isPrinting } = usePrint();
  const { download, canDownload, isDownloading } = useDownload();
  const shell = useShell();
  const fullscreen = useFullscreen(shell?.rootRef ?? NO_TARGET);

  // Ties the menu to its trigger for CSS anchor positioning.
  const anchor: CSSProperties & Record<`--${string}`, string> = {
    "--rpv-menu-anchor": `--rpv-menu-${id.replaceAll(/[^\w-]/g, "")}`,
  };

  const item = (
    label: string,
    icon: ReactNode,
    action: () => void,
    disabled = false,
  ): ReactNode => (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(event: MouseEvent) => menu.choose(action, event)}
    >
      <span className="rpv-menu-icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  );

  return (
    <span className={withClassName("rpv-more", props.className)} style={props.style}>
      <button
        {...menu.triggerProps}
        ref={triggerRef}
        id={`${id}-trigger`}
        type="button"
        className="rpv-button"
        aria-label="More actions"
        style={anchor}
      >
        <MoreIcon />
      </button>
      {/* Right after its trigger, so browsers add no implicit aria-details. */}
      <div {...menu.menuProps} ref={menuRef} className="rpv-menu" style={anchor}>
        <div role="menu" className="rpv-menu-items" aria-labelledby={`${id}-trigger`}>
          {/* Shown only when a narrow <PdfToolbar> folds its cursor switch in here. A
              checkbox item: Enter toggles and closes (after a moment, so the change is
              visible); Space toggles and stays open. */}
          <button
            type="button"
            role="menuitemcheckbox"
            className="rpv-menu-cursor"
            aria-checked={cursor.mode === "hand"}
            onClick={(event) => {
              cursor.toggle();
              const fromPointer = event.detail > 0;
              setTimeout(() => menu.close(fromPointer), CHECK_FEEDBACK_MS);
            }}
            onKeyDown={(event) => {
              if (event.key !== " ") return;
              event.preventDefault(); // no click: Space keeps the menu open
              cursor.toggle();
            }}
          >
            <span className="rpv-menu-icon" aria-hidden="true">
              <HandIcon />
            </span>
            Hand tool
          </button>
          {item("Rotate clockwise", <RotateClockwiseIcon />, rotateClockwise, !hasDocument)}
          {fullscreen.isSupported &&
            shell &&
            item(
              fullscreen.isFullscreen ? "Exit full screen" : "Full screen",
              fullscreen.isFullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />,
              () => {
                fullscreen.toggle().catch(reportError);
              },
            )}
          {item(
            "Print",
            <PrintIcon />,
            () => {
              print().catch(reportError);
            },
            !canPrint || isPrinting,
          )}
          {item(
            "Download",
            <DownloadIcon />,
            () => {
              download().catch(reportError);
            },
            !canDownload || isDownloading,
          )}
        </div>
      </div>
    </span>
  );
}
