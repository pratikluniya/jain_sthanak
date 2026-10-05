import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import UserForm from "../UserForm";
import { roleOptions, userFormLabels } from "../labels";

export default async function NewUserPage() {
  await requireSession("users");
  const t = getDict();
  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/users" className="text-sm text-brand-700">← {t.users}</Link>
      <h1 className="page-title">{t.addUser}</h1>
      <UserForm roles={roleOptions(t)} t={userFormLabels(t)} />
    </div>
  );
}
