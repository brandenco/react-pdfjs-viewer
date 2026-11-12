import type { ReactNode } from "react";

function Icon({ children }: { children: ReactNode }): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const SidebarIcon = (): ReactNode => (
  <Icon>
    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </Icon>
);
export const ChevronLeftIcon = (): ReactNode => (
  <Icon>
    <path d="m15 18-6-6 6-6" />
  </Icon>
);
export const ChevronRightIcon = (): ReactNode => (
  <Icon>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);
export const ChevronUpIcon = (): ReactNode => (
  <Icon>
    <path d="m18 15-6-6-6 6" />
  </Icon>
);
export const ChevronDownIcon = (): ReactNode => (
  <Icon>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
export const MinusIcon = (): ReactNode => (
  <Icon>
    <path d="M5 12h14" />
  </Icon>
);
export const PlusIcon = (): ReactNode => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const TextCursorIcon = (): ReactNode => (
  <Icon>
    <path d="M4 7V5h10v2M9 5v14M7 19h4M14 12v-1h6v1M17 11v8M15.5 19h3" />
  </Icon>
);
export const HandIcon = (): ReactNode => (
  <Icon>
    <path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
  </Icon>
);
export const SearchIcon = (): ReactNode => (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);
export const DownloadIcon = (): ReactNode => (
  <Icon>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Icon>
);
export const CloseIcon = (): ReactNode => (
  <Icon>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);
