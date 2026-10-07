import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import FamilyForm from "@/components/FamilyForm";

export default async function NewFamily() {
  await requireSession("edit");
  const t = getDict();
  return (
    <div className="space-y-3 max-w-xl">
      <h1 className="page-title">{t.addFamily}</h1>
      <FamilyForm t={t} />
    </div>
  );
}
