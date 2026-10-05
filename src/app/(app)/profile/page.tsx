import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { initials } from "@/lib/initials";
import Icon from "@/components/Icon";
import { NameForm } from "./ProfileForms";
import { profileMsgs } from "./msgs";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const s = await requireSession("view");
  const t = getDict();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: s.uid } });
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="page-title">{t.profile}</h1>
      <div className="card flex items-center gap-4 p-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-600 font-heading text-2xl font-bold text-white">{initials(user.name)}</span>
        <div className="min-w-0">
          <div className="truncate font-heading text-xl font-bold">{user.name}</div>
          <div className="text-sm text-stone-600">{t[user.role]}</div>
        </div>
      </div>
      <div className="card space-y-4 p-4">
        <NameForm name={user.name} t={profileMsgs(t)} />
        <dl className="grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 text-sm">
          <div><dt className="label">{t.mobile}</dt><dd className="font-medium">{user.mobile}</dd></div>
          <div><dt className="label">{t.role}</dt><dd className="font-medium">{t[user.role]}</dd></div>
        </dl>
        <p className="text-xs text-stone-500">{t.profileHelp}</p>
      </div>
      <Link href="/profile/password" className="btn-secondary"><Icon name="key" className="h-4 w-4" />{t.changePassword}</Link>
    </div>
  );
}
