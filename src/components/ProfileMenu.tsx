"use client";
// Initials circle in the header; opens a small menu: Profile, Change password, Logout.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { initials } from "@/lib/initials";

export default function ProfileMenu(props: {
  name: string;
  roleLabel: string;
  logout: () => Promise<void>;
  t: { profile: string; changePassword: string; logout: string };
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full p-0.5 pr-1 hover:bg-brand-600 lg:pr-2 lg:hover:bg-stone-100"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-heading text-base font-bold text-brand-700 ring-2 ring-white/60 lg:bg-brand-600 lg:text-white lg:ring-brand-100">
          {initials(props.name)}
        </span>
        <span className="hidden max-w-[10rem] text-left leading-tight lg:block">
          <span className="block truncate text-sm font-semibold">{props.name}</span>
          <span className="block truncate text-xs text-stone-500">{props.roleLabel}</span>
        </span>
        <Icon name="chevron" className="hidden h-4 w-4 text-stone-500 lg:block" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-stone-200 bg-white p-2 text-stone-900 shadow-lg">
          <div className="border-b border-stone-100 px-3 pb-2 pt-1">
            <div className="truncate font-semibold">{props.name}</div>
            <div className="text-xs text-stone-500">{props.roleLabel}</div>
          </div>
          <div className="pt-1">
            <Link role="menuitem" href="/profile" className={item} onClick={() => setOpen(false)}>
              <Icon name="member" className="h-4 w-4" /> {props.t.profile}
            </Link>
            <Link role="menuitem" href="/profile/password" className={item} onClick={() => setOpen(false)}>
              <Icon name="key" className="h-4 w-4" /> {props.t.changePassword}
            </Link>
            <form action={props.logout}>
              <button role="menuitem" className={`${item} text-brand-700`}>
                <Icon name="logout" className="h-4 w-4" /> {props.t.logout}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
