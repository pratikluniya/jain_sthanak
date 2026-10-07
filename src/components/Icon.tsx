// Simple line icons (24x24, drawn with the current text colour). No icon package needed.
export type IconName =
  | "home" | "families" | "member" | "upload" | "voters" | "download" | "receipt" | "users" | "settings"
  | "menu" | "close" | "logout" | "key" | "chevron";

const PATHS: Record<IconName, JSX.Element> = {
  home: <path d="M3 11l9-8 9 8M5 9.5V20h5v-6h4v6h5V9.5" />,
  families: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.3c.6-.2 1.3-.3 2-.3 2.8 0 5 2.2 5 5" />
    </>
  ),
  member: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </>
  ),
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 15v5h16v-5" />,
  voters: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  download: <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6" />,
  users: (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M3 21c0-3.9 3.1-7 7-7 1.3 0 2.5.3 3.5.9M18 13.5l3 1.3v2.4c0 1.9-1.3 3.2-3 3.8-1.7-.6-3-1.9-3-3.8v-2.4z" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h9M19 6h1M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  logout: <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h11" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8M16 7l2 2M19 4l2 2" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
};

export default function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
