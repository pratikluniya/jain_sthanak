import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { PasswordForm } from "../ProfileForms";
import { profileMsgs } from "../msgs";

export default async function PasswordPage() {
  await requireSession("view");
  const t = getDict();
  return (
    <div className="max-w-md space-y-4">
      <h1 className="page-title">{t.changePassword}</h1>
      <div className="card p-4">
        <PasswordForm t={profileMsgs(t)} />
      </div>
    </div>
  );
}
