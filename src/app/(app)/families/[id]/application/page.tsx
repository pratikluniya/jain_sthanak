import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { memberFullName } from "@/lib/members";
import ApplicationFieldsForm, { defaultsFromRecord } from "@/components/ApplicationFieldsForm";
import { updateApplicationAction } from "../../../upload/[id]/applicationActions";

// Correct the membership application details of a member (edit permission).
export default async function EditApplicationPage({ params, searchParams }: { params: { id: string }; searchParams: { m?: string } }) {
  await requireSession("edit");
  const t = getDict();
  const m = searchParams.m
    ? await prisma.member.findFirst({ where: { id: searchParams.m, familyId: params.id, deletedAt: null }, include: { application: true, family: true } })
    : null;
  if (!m?.application || m.family.deletedAt) notFound();
  return (
    <div className="max-w-2xl space-y-3">
      <h1 className="page-title">{t.applicationTitle} <span className="text-base text-stone-500">· {memberFullName(m)} · {m.family.code}</span></h1>
      <form action={updateApplicationAction} className="card space-y-3 p-4">
        <input type="hidden" name="memberId" value={m.id} />
        <ApplicationFieldsForm d={defaultsFromRecord(m.application)} t={t} />
        <button className="btn-primary w-full sm:w-auto">{t.save}</button>
      </form>
    </div>
  );
}
