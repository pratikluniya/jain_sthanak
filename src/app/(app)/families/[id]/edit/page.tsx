import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import FamilyForm from "@/components/FamilyForm";

export default async function EditFamily({ params }: { params: { id: string } }) {
  await requireSession("edit");
  const t = getDict();
  const fam = await prisma.family.findUnique({ where: { id: params.id } });
  if (!fam) notFound();
  return (
    <div className="space-y-3 max-w-xl">
      <h1 className="text-xl font-bold">{t.edit}: {fam.code}</h1>
      <FamilyForm t={t} fam={fam} />
    </div>
  );
}
