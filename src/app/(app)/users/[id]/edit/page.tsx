import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import ConfirmButton from "@/components/ConfirmButton";
import UserForm from "../../UserForm";
import { deleteUser } from "../../actions";
import { roleOptions, userFormLabels } from "../../labels";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params, searchParams }: { params: { id: string }; searchParams: { e?: string } }) {
  const s = await requireSession("users");
  const t = getDict();
  const u = await prisma.user.findUnique({ where: { id: params.id } });
  if (!u || u.deletedAt) notFound();
  const self = u.id === s.uid;
  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/users" className="text-sm text-brand-700">← {t.users}</Link>
      <h1 className="page-title">{t.editUser}</h1>
      {searchParams.e === "cannotChangeSelf" && <p className="text-sm text-red-600">{t.cannotChangeSelf}</p>}
      <UserForm user={{ id: u.id, name: u.name, mobile: u.mobile, role: u.role, active: u.active }} roles={roleOptions(t)} t={userFormLabels(t)} />
      {!self && (
        <form action={deleteUser} className="card flex flex-wrap items-center justify-between gap-3 border-red-200 p-4">
          <input type="hidden" name="id" value={u.id} />
          <p className="text-sm text-stone-600">{t.deleteConfirmSoft}</p>
          <ConfirmButton className="btn-danger" message={`${u.name}: ${t.deleteConfirmSoft}`}>{t.deleteUser}</ConfirmButton>
        </form>
      )}
    </div>
  );
}
