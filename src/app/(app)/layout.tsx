import Link from "next/link";
import { requireSession } from "@/lib/session";
import { getDict } from "@/lib/i18n";
import { can } from "@/lib/rbac";
import LangToggle from "@/components/LangToggle";
import { logoutAction } from "../login/actions";
import NavLinks from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession("view");
  const t = getDict();
  const links = [
    { href: "/", label: t.dashboard, show: true },
    { href: "/families", label: t.families, show: true },
    { href: "/members", label: t.members, show: true },
    { href: "/upload", label: t.upload, show: can(s.role, "upload") },
    { href: "/voters", label: t.voters, show: true },
    { href: "/export", label: t.exports, show: can(s.role, "export") },
    { href: "/receipts", label: t.receipts, show: can(s.role, "receipts") },
    { href: "/users", label: t.users, show: can(s.role, "users") },
    { href: "/settings", label: t.settings, show: can(s.role, "settings") },
  ].filter((l) => l.show);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="no-print bg-brand-700 text-white">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-11 w-auto rounded bg-white p-0.5 shrink-0" />
          <Link href="/" className="font-bold leading-tight flex-1 min-w-0">
            <span className="block truncate text-sm sm:text-base">{t.sangh}</span>
            <span className="block text-xs text-brand-100">{t.appName}</span>
          </Link>
          <LangToggle />
          <form action={logoutAction}>
            <button className="text-xs underline whitespace-nowrap" title={s.name}>{t.logout}</button>
          </form>
        </div>
        <NavLinks links={links.map(({ href, label }) => ({ href, label }))} />
        <div className="jain-stripe" />
      </header>
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-4">{children}</main>
      <footer className="no-print text-center text-xs text-stone-400 py-3">{s.name} · {t[s.role]}</footer>
    </div>
  );
}
