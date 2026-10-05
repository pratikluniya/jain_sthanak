import { requireSession } from "@/lib/session";
import { getDict } from "@/lib/i18n";
import { can } from "@/lib/rbac";
import LangToggle from "@/components/LangToggle";
import { logoutAction } from "../login/actions";
import AppShell, { type NavLink } from "@/components/AppShell";
import ProfileMenu from "@/components/ProfileMenu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession("view");
  const t = getDict();
  const links: (NavLink & { show: boolean })[] = [
    { href: "/", label: t.dashboard, icon: "home", show: true },
    { href: "/families", label: t.families, icon: "families", show: true },
    { href: "/members", label: t.members, icon: "member", show: true },
    { href: "/upload", label: t.upload, icon: "upload", show: can(s.role, "upload") },
    { href: "/voters", label: t.voters, icon: "voters", show: true },
    { href: "/receipts", label: t.receipts, icon: "receipt", show: can(s.role, "receipts") },
    { href: "/users", label: t.users, icon: "users", show: can(s.role, "users") },
    { href: "/settings", label: t.settings, icon: "settings", show: can(s.role, "settings") },
  ];

  return (
    <AppShell
      links={links.filter((l) => l.show).map(({ href, label, icon }) => ({ href, label, icon }))}
      sangh={t.sangh}
      appName={t.appName}
      t={{ menu: t.menu, close: t.close, language: t.language }}
      langToggle={<LangToggle />}
      profileMenu={
        <ProfileMenu name={s.name} roleLabel={t[s.role]} logout={logoutAction} t={{ profile: t.profile, changePassword: t.changePassword, logout: t.logout }} />
      }
    >
      {children}
    </AppShell>
  );
}
