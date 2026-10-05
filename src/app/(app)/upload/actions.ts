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
import { toEnglishName } from "@/lib/translit";
import type { ExtractedForm } from "@/lib/extract";

const Payload = z.object({
  uploadId: z.string(),
  mode: z.enum(["new", "merge", "linked"]),
  targetFamilyId: z.string().optional(),
  headName: z.string(),
  headNameEn: z.string().default(""),
  address: z.string(),
  panth: z.enum(["STHANAKVASI", "MANDIRMARGI", "TERAPANTH", "DIGAMBAR", "UNKNOWN"]),
  panthConfirmed: z.boolean(),
  notes: z.string(),
  kycAssign: z.array(z.object({ idx: z.number().int(), key: z.string() })).default([]),
  members: z.array(
    z.object({
      key: z.string(),
      nameRaw: z.string(),
      title: z.string(),
      firstName: z.string(),
      middleName: z.string(),
      surname: z.string(),
      firstNameEn: z.string().default(""),
      middleNameEn: z.string().default(""),
      surnameEn: z.string().default(""),
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
      fam = await tx.family.findUniqueOrThrow({ where: { id: p.targetFamilyId, deletedAt: null } });
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
          headNameEn: p.headNameEn.trim() || toEnglishName(p.headName),
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
    const idByKey = new Map<string, string>();
    for (const m of p.members) {
      if (!m.firstName.trim() && !m.nameRaw.trim()) continue;
      i++;
      const { key, ...input } = m;
      const data = prepareMember({ ...input, serial: start + i }, fam.code, formDate);
      data.nameRaw = m.nameRaw || data.nameRaw;
      const created = await tx.member.create({ data: { ...data, familyId: fam.id } });
      idByKey.set(key, created.id);
    }
    // Attach imported KYC documents (encrypted number + scan) to the chosen members
    const extracted = up.extracted as unknown as ExtractedForm | null;
    for (const a of p.kycAssign) {
      const k = extracted?.kyc?.[a.idx];
      const memberId = idByKey.get(a.key);
      if (!k || !memberId) continue;
      await tx.member.update({
        where: { id: memberId },
        data: {
          kycFileKey: k.fileKey,
          kycDocType: k.docType,
          aadhaarEnc: k.enc ?? undefined,
          aadhaarLast4: k.last4 ?? undefined,
          dob: k.dob ? new Date(k.dob) : undefined,
          kycVerified: false,
        },
      });
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
