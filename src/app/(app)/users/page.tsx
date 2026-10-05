import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { ROLES } from "@/lib/rbac";
import { updateUser } from "./actions";
import NewUserForm from "./NewUserForm";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireSession("users");
  const t = getDict();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const roleLabels = Object.fromEntries(ROLES.map((r) => [r, t[r]]));
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="page-title">{t.users}</h1>
      <NewUserForm roles={ROLES} roleLabels={roleLabels} t={{ name: t.name, mobile: t.mobile, password: t.password, role: t.role, add: t.add, save: t.save }} />
      <div className="space-y-2">
        {users.map((u) => (
          <form key={u.id} action={updateUser} className="card p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 items-center text-sm">
            <input type="hidden" name="id" value={u.id} />
            <div className="col-span-2 sm:col-span-1"><b>{u.name}</b><div className="text-stone-500">{u.mobile}</div></div>
            <select name="role" defaultValue={u.role} className="input">
              {ROLES.map((r) => <option key={r} value={r}>{t[r]}</option>)}
            </select>
            <input name="password" type="password" placeholder={`${t.password} ${t.newPasswordHint}`} className="input" autoComplete="new-password" />
            <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={u.active} /> {t.ACTIVE}</label>
            <button className="btn-secondary btn-sm">{t.save}</button>
          </form>
        ))}
      </div>
    </div>
  );
}
