import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { can } from "@/lib/rbac";
import { initials } from "@/lib/initials";
import { restoreUser } from "./actions";

export const dynamic = "force-dynamic";

const day = (d: Date) => d.toLocaleDateString("en-IN");

export default async function UsersPage({ searchParams }: { searchParams: { deleted?: string } }) {
  const s = await requireSession("users");
  const t = getDict();
  const showDeleted = searchParams.deleted === "1" && can(s.role, "restore");
  const all = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const nameOf = new Map(all.map((u) => [u.id, u.name]));
  const users = all.filter((u) => (showDeleted ? u.deletedAt : !u.deletedAt));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="page-title">{t.users} <span className="text-base text-stone-500">({users.length})</span></h1>
        {!showDeleted && <Link href="/users/new" className="btn-primary">+ {t.addUser}</Link>}
      </div>
      {can(s.role, "restore") && (
        <div className="flex gap-2 text-sm">
          <Link href={showDeleted ? "/users" : "/users?deleted=1"} className={showDeleted ? "badge-red font-semibold" : "badge-red opacity-60"}>
            {showDeleted ? t.showActive : t.showDeleted}
          </Link>
        </div>
      )}
      {users.length === 0 && <p className="text-stone-500">{t.noResults}</p>}
      {users.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t.name}</th>
                <th>{t.mobile}</th>
                <th>{t.role}</th>
                <th>{t.status}</th>
                <th>{t.createdOn}</th>
                <th>{t.createdBy}</th>
                {showDeleted && <th>{t.deletedOn}</th>}
                <th className="text-right">{t.actionsCol}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 font-heading text-xs font-bold text-brand-700">{initials(u.name)}</span>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap">{u.mobile}</td>
                  <td className="whitespace-nowrap">{t[u.role]}</td>
                  <td>{u.active ? <span className="badge-green">{t.ACTIVE}</span> : <span className="badge-gray">{t.disabled}</span>}</td>
                  <td className="whitespace-nowrap">{day(u.createdAt)}</td>
                  <td className="whitespace-nowrap">{(u.createdById && nameOf.get(u.createdById)) || "—"}</td>
                  {showDeleted && <td className="whitespace-nowrap">{u.deletedAt && day(u.deletedAt)}{u.deletedById && ` · ${nameOf.get(u.deletedById) ?? ""}`}</td>}
                  <td className="text-right">
                    {showDeleted ? (
                      <form action={restoreUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="btn-secondary btn-sm">{t.restore}</button>
                      </form>
                    ) : (
                      <Link href={`/users/${u.id}/edit`} className="btn-secondary btn-sm">{t.edit}</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
