"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { nextFamilyCode } from "@/lib/counters";
import { inferHeadGender, prepareMember } from "@/lib/members";
import { runExtraction } from "@/lib/uploads";

const Payload = z.object({
  uploadId: z.string(),
  mode: z.enum(["new", "merge", "linked"]),
  targetFamilyId: z.string().optional(),
  headName: z.string(),
  address: z.string(),
  panth: z.enum(["STHANAKVASI", "MANDIRMARGI", "TERAPANTH", "DIGAMBAR", "UNKNOWN"]),
  panthConfirmed: z.boolean(),
  notes: z.string(),
  members: z.array(
    z.object({
      nameRaw: z.string(),
      title: z.string(),
      firstName: z.string(),
      middleName: z.string(),
      surname: z.string(),
      age: z.string(),
      relation: z.string(),
      relationRaw: z.string(),
      education: z.string(),
      occupation: z.string(),
      mobile: z.string(),
      bloodGroup: z.string(),
    }),
  ),
});
export type VerifyPayload = z.infer<typeof Payload>;

export async function saveVerified(raw: VerifyPayload): Promise<{ familyId?: string; error?: string }> {
  const s = await requireSession("upload");
  const p = Payload.parse(raw);
  const up = await prisma.formUpload.findUniqueOrThrow({ where: { id: p.uploadId } });
  if (up.status === "VERIFIED") return { error: "already saved" };
  const formDate = up.createdAt;

  const familyId = await prisma.$transaction(async (tx) => {
    let fam;
    if (p.mode === "merge") {
      if (!p.targetFamilyId) throw new Error("choose a family");
      fam = await tx.family.findUniqueOrThrow({ where: { id: p.targetFamilyId } });
      if (fam.panthStatus === "TO_VERIFY" && p.panth !== "UNKNOWN") {
        fam = await tx.family.update({
          where: { id: fam.id },
          data: { panth: p.panth, panthStatus: p.panthConfirmed ? "CONFIRMED" : "TO_VERIFY" },
        });
      }
    } else {
      const code = await nextFamilyCode(tx);
      fam = await tx.family.create({
        data: {
          code,
          headName: p.headName,
          address: p.address,
          panth: p.panth,
          panthStatus: p.panth !== "UNKNOWN" && p.panthConfirmed ? "CONFIRMED" : "TO_VERIFY",
          notes: p.notes,
          formDate,
          parentFamilyId: p.mode === "linked" ? p.targetFamilyId : null,
        },
      });
    }
    const start = await tx.member.count({ where: { familyId: fam.id } });
    let i = 0;
    for (const m of p.members) {
      if (!m.firstName.trim() && !m.nameRaw.trim()) continue;
      i++;
      const data = prepareMember({ ...m, serial: start + i }, fam.code, formDate);
      data.nameRaw = m.nameRaw || data.nameRaw;
      await tx.member.create({ data: { ...data, familyId: fam.id } });
    }
    await inferHeadGender(fam.id, tx);
    await tx.formUpload.update({ where: { id: up.id }, data: { status: "VERIFIED", familyId: fam.id, verifiedBy: s.name } });
    return fam.id;
  });
  await audit(s.uid, "verify", "Upload", up.id, { familyId, mode: p.mode, members: p.members.length });
  revalidatePath("/upload");
  return { familyId };
}

export async function rejectUpload(fd: FormData) {
  const s = await requireSession("upload");
  const id = String(fd.get("id"));
  await prisma.formUpload.update({ where: { id }, data: { status: "REJECTED" } });
  await audit(s.uid, "reject", "Upload", id);
  redirect("/upload");
}

export async function retryUpload(fd: FormData) {
  await requireSession("upload");
  const id = String(fd.get("id"));
  await runExtraction(id);
  revalidatePath(`/upload/${id}`);
}
