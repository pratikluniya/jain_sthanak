"use client";
// Page frame: left sidebar (always open and sticky on laptops, slide-in drawer behind the hamburger on phones),
// a top header, and the page content.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon, { type IconName } from "./Icon";

export interface NavLink {
  href: string;
  label: string;
  icon: IconName;
}

export default function AppShell(props: {
  links: NavLink[];
  sangh: string;
  appName: string;
  t: { menu: string; close: string; language: string };
  langToggle: React.ReactNode;
  profileMenu: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // close the drawer after navigating
  useEffect(() => setOpen(false), [path]);
  // no page scrolling behind the open drawer; Escape closes it
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  return (
    <div className="min-h-screen lg:flex">
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden no-print" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-brand-700 text-white shadow-xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:translate-x-0 lg:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label={props.t.menu}
      >
        <div className="flex items-start gap-3 px-4 pt-5 pb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-16 w-16 shrink-0 rounded-xl bg-white p-1 shadow" />
          <Link href="/" className="min-w-0 flex-1">
            <span className="block font-heading text-lg font-bold leading-snug">{props.sangh}</span>
            <span className="mt-0.5 block text-sm text-brand-100">{props.appName}</span>
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="-mr-1 rounded-lg p-1.5 hover:bg-brand-600 lg:hidden" aria-label={props.t.close}>
            <Icon name="close" />
          </button>
        </div>
        <div className="jain-stripe" />
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {props.links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition ${active ? "bg-white font-semibold text-brand-700 shadow-sm" : "text-brand-50 hover:bg-brand-600"}`}
              >
                <Icon name={l.icon} className="h-5 w-5 shrink-0" />
                <span className="truncate">{l.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-brand-600 p-4 lg:hidden">
          <p className="mb-2 text-xs text-brand-100">{props.t.language}</p>
          {props.langToggle}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 bg-brand-700 text-white shadow-sm lg:border-b lg:border-stone-200 lg:bg-white/90 lg:text-stone-900 lg:shadow-none lg:backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-3 sm:px-4 lg:px-6">
            <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-brand-600 lg:hidden" aria-label={props.t.menu} aria-expanded={open}>
              <Icon name="menu" className="h-6 w-6" />
            </button>
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white p-0.5" />
              <span className="line-clamp-2 font-heading text-[15px] font-bold leading-tight">{props.sangh}</span>
            </Link>
            <div className="hidden flex-1 lg:block" />
            <div className="hidden lg:block">{props.langToggle}</div>
            {props.profileMenu}
          </div>
          <div className="jain-stripe lg:hidden" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-5 sm:px-4 lg:px-6">{props.children}</main>
      </div>
    </div>
  );
}
