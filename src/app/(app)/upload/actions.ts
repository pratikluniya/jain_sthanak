"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { nextFamilyCode } from "@/lib/counters";
import { computeSearchKey, inferHeadGender, prepareMember } from "@/lib/members";
import { runExtraction } from "@/lib/uploads";
import { toEnglishName } from "@/lib/translit";
import { addressToEnglish } from "@/lib/addressEn";
import type { ExtractedForm } from "@/lib/extract";
import { flashErr, flashOk } from "@/lib/flash";

const Payload = z.object({
  uploadId: z.string(),
  mode: z.enum(["new", "merge", "linked"]),
  targetFamilyId: z.string().optional(),
  headName: z.string(),
  headNameEn: z.string().default(""),
  address: z.string(),
  addressEn: z.string().default(""),
  panth: z.enum(["STHANAKVASI", "MANDIRMARGI", "TERAPANTH", "DIGAMBAR", "UNKNOWN"]),
  panthConfirmed: z.boolean(),
  notes: z.string(),
  kycAssign: z.array(z.object({ idx: z.number().int(), key: z.string() })).default([]),
  // merge mode: form row key -> existing member id ("" or missing = new member)
  matches: z.record(z.string()).default({}),
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
      dob: z.string().default(""),
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
  if (up.status === "VERIFIED") {
    flashErr("error");
    return { error: "already saved" };
  }
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
          addressEn: p.addressEn.trim() || addressToEnglish(p.address),
          panth: p.panth,
          panthStatus: p.panth !== "UNKNOWN" && p.panthConfirmed ? "CONFIRMED" : "TO_VERIFY",
          notes: p.notes,
          formDate,
          parentFamilyId: p.mode === "linked" ? p.targetFamilyId : null,
        },
      });
    }
    const start = await tx.member.count({ where: { familyId: fam.id } });
    // merge: the family's members a form row may be matched to (smart merge, 23 Oct 2026)
    const existing = p.mode === "merge" ? await tx.member.findMany({ where: { familyId: fam.id, deletedAt: null } }) : [];
    const byId = new Map(existing.map((m) => [m.id, m]));
    let i = 0;
    const idByKey = new Map<string, string>();
    const keepKyc = new Set<string>(); // matched members that already have an Aadhaar: the new card is skipped
    for (const m of p.members) {
      if (!m.firstName.trim() && !m.nameRaw.trim()) continue;
      const { key, ...rest } = m;
      const input = { ...rest, dob: /^\d{4}-\d{2}-\d{2}$/.test(rest.dob) ? rest.dob : null };
      const old = p.mode === "merge" ? byId.get(p.matches[key] ?? "") : undefined;
      if (old) {
        // same person: fill only what is blank in the app, never overwrite
        const d = prepareMember({ ...input, serial: old.serial }, fam.code, formDate);
        const data: Prisma.MemberUpdateInput = {};
        if (!old.mobile && d.mobile) data.mobile = d.mobile;
        if (!old.bloodGroup && d.bloodGroup) data.bloodGroup = d.bloodGroup;
        if (!old.education && d.education) data.education = d.education;
        if (!old.occupation && d.occupation) data.occupation = d.occupation;
        if (!old.dob && d.dob) {
          data.dob = d.dob;
          data.age = d.age;
          data.ageRecordedOn = d.ageRecordedOn;
        } else if (!old.dob && old.age === null && d.age !== null) {
          data.age = d.age;
          data.ageRecordedOn = d.ageRecordedOn;
        }
        if (!old.firstNameEn && d.firstNameEn) Object.assign(data, { firstNameEn: d.firstNameEn, middleNameEn: d.middleNameEn, surnameEn: d.surnameEn });
        if (old.gender === "UNKNOWN" && d.gender !== "UNKNOWN") data.gender = d.gender;
        if (Object.keys(data).length) {
          data.searchKey = computeSearchKey(
            {
              firstName: old.firstName, middleName: old.middleName, surname: old.surname,
              firstNameEn: (data.firstNameEn as string) ?? old.firstNameEn, middleNameEn: (data.middleNameEn as string) ?? old.middleNameEn, surnameEn: (data.surnameEn as string) ?? old.surnameEn,
              mobile: (data.mobile as string) ?? old.mobile,
            },
            fam.code,
          );
          await tx.member.update({ where: { id: old.id }, data });
        }
        idByKey.set(key, old.id);
        if (old.kycFileKey) keepKyc.add(old.id);
        continue;
      }
      i++;
      const data = prepareMember({ ...input, serial: start + i }, fam.code, formDate);
      data.nameRaw = m.nameRaw || data.nameRaw;
      const created = await tx.member.create({ data: { ...data, familyId: fam.id } });
      idByKey.set(key, created.id);
    }
    // merge: fill the family's blank address / notes from the form
    if (p.mode === "merge") {
      const famData: Prisma.FamilyUpdateInput = {};
      if (!fam.address && p.address.trim()) famData.address = p.address;
      if (!fam.addressEn && (p.addressEn.trim() || p.address.trim())) famData.addressEn = p.addressEn.trim() || addressToEnglish(p.address);
      if (p.notes.trim()) famData.notes = [fam.notes, `${new Date().toLocaleDateString("en-IN")}: ${p.notes.trim()}`].filter(Boolean).join("\n");
      if (Object.keys(famData).length) await tx.family.update({ where: { id: fam.id }, data: famData });
    }
    // Attach imported KYC documents (encrypted number + scan) to the chosen members
    const extracted = up.extracted as unknown as ExtractedForm | null;
    for (const a of p.kycAssign) {
      const k = extracted?.kyc?.[a.idx];
      const memberId = idByKey.get(a.key);
      if (!k || !memberId || keepKyc.has(memberId)) continue;
      await tx.member.update({
        where: { id: memberId },
        data: {
          kycFileKey: k.fileKey,
          kycDocType: k.docType,
          aadhaarEnc: k.enc ?? undefined,
          aadhaarLast4: k.last4 ?? undefined,
          // a date typed on the check screen wins over the one read from the Aadhaar; a saved date is never replaced
          dob: k.dob && !p.members.find((m) => m.key === a.key)?.dob && !byId.get(memberId)?.dob ? new Date(k.dob) : undefined,
          kycVerified: false,
        },
      });
    }
    await inferHeadGender(fam.id, tx);
    await tx.formUpload.update({ where: { id: up.id }, data: { status: "VERIFIED", familyId: fam.id, verifiedBy: s.name } });
    return fam.id;
  });
  await audit(s.uid, "verify", "Upload", up.id, { familyId, mode: p.mode, members: p.members.length, matched: Object.values(p.matches).filter(Boolean).length });
  revalidatePath("/upload");
  flashOk("saved");
  return { familyId };
}

export async function rejectUpload(fd: FormData) {
  const s = await requireSession("upload");
  const id = String(fd.get("id"));
  await prisma.formUpload.update({ where: { id }, data: { status: "REJECTED" } });
  await audit(s.uid, "reject", "Upload", id);
  flashOk("rejected");
  redirect("/upload");
}

export async function retryUpload(fd: FormData) {
  await requireSession("upload");
  const id = String(fd.get("id"));
  await runExtraction(id);
  revalidatePath(`/upload/${id}`);
  const up = await prisma.formUpload.findUnique({ where: { id }, select: { status: true } });
  if (up?.status === "FAILED") flashErr("error");
  else flashOk("done");
}
