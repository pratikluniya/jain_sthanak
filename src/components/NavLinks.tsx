"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="max-w-6xl mx-auto px-2 flex gap-1 overflow-x-auto text-sm">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap px-3 py-2 rounded-t-lg ${active ? "bg-stone-50 text-brand-900 font-semibold" : "text-brand-50 hover:bg-brand-600"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
