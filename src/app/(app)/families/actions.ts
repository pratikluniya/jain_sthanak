"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { nextFamilyCode } from "@/lib/counters";
import { computeSearchKey, inferHeadGender, prepareMember } from "@/lib/members";
import { cleanAadhaar, encrypt } from "@/lib/crypto";
import { putFile } from "@/lib/storage";
import type { Panth, PanthStatus, FamilyStatus } from "@prisma/client";

const PANTHS: Panth[] = ["STHANAKVASI", "MANDIRMARGI", "TERAPANTH", "DIGAMBAR", "UNKNOWN"];

function str(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

export async function saveFamily(fd: FormData) {
  const s = await requireSession("edit");
  const id = str(fd, "id");
  const panth = (PANTHS.includes(str(fd, "panth") as Panth) ? str(fd, "panth") : "UNKNOWN") as Panth;
  const data = {
    headName: str(fd, "headName"),
    address: str(fd, "address"),
    area: str(fd, "area"),
    panth,
    // choosing a real panth while editing counts as confirming it (edit is done by trusted roles)
    panthStatus: (panth === "UNKNOWN" ? "TO_VERIFY" : (str(fd, "panthStatus") as PanthStatus) || "TO_VERIFY") as PanthStatus,
    status: ((str(fd, "status") || "ACTIVE") as FamilyStatus),
    notes: str(fd, "notes"),
  };
  if (id) {
    await prisma.family.update({ where: { id }, data });
    await audit(s.uid, "update", "Family", id, data);
    revalidatePath(`/families/${id}`);
    redirect(`/families/${id}`);
  }
  const fam = await prisma.$transaction(async (tx) => {
    const code = await nextFamilyCode(tx);
    return tx.family.create({ data: { ...data, code, formDate: new Date() } });
  });
  await audit(s.uid, "create", "Family", fam.id, data);
  redirect(`/families/${fam.id}`);
}

export async function confirmPanth(fd: FormData) {
  const s = await requireSession("approve");
  const id = str(fd, "id");
  const panth = str(fd, "panth") as Panth;
  if (!PANTHS.includes(panth) || panth === "UNKNOWN") return;
  await prisma.family.update({ where: { id }, data: { panth, panthStatus: "CONFIRMED" } });
  await audit(s.uid, "approve", "Family", id, { panth });
  revalidatePath(`/families/${id}`);
  revalidatePath("/families");
}

export async function deleteFamily(fd: FormData) {
  const s = await requireSession("delete");
  const id = str(fd, "id");
  const fam = await prisma.family.findUnique({ where: { id }, include: { members: true, payments: true } });
  if (!fam) redirect("/families");
  if (fam.payments.length > 0) throw new Error("Family has receipts; cannot delete");
  await prisma.family.delete({ where: { id } });
  await audit(s.uid, "delete", "Family", id, { code: fam.code, headName: fam.headName, members: fam.members.length });
  redirect("/families");
}

export async function saveMember(fd: FormData) {
  const s = await requireSession("edit");
  const familyId = str(fd, "familyId");
  const memberId = str(fd, "memberId");
  const fam = await prisma.family.findUniqueOrThrow({ where: { id: familyId } });
  const existing = memberId ? await prisma.member.findUnique({ where: { id: memberId } }) : null;

  const ageStr = str(fd, "age");
  // keep the original "age recorded on" date if the age was not changed
  const ageChanged = !existing || String(existing.age ?? "") !== ageStr;
  const recordedOn = ageChanged ? new Date() : existing!.ageRecordedOn ?? new Date();

  const prepared = prepareMember(
    {
      title: str(fd, "title"),
      firstName: str(fd, "firstName"),
      middleName: str(fd, "middleName"),
      surname: str(fd, "surname"),
      age: ageStr,
      dob: str(fd, "dob") || null,
      relation: str(fd, "relation"),
      relationRaw: existing?.relationRaw ?? "",
      gender: str(fd, "gender"),
      education: str(fd, "education"),
      occupation: str(fd, "occupation"),
      mobile: str(fd, "mobile"),
      bloodGroup: str(fd, "bloodGroup"),
      status: str(fd, "status"),
      serial: existing?.serial,
    },
    fam.code,
    recordedOn,
  );
  if (existing) prepared.nameRaw = existing.nameRaw || prepared.nameRaw;

  const data: Record<string, unknown> = { ...prepared };

  // Aadhaar (optional)
  const aadhaarRaw = str(fd, "aadhaar");
  if (aadhaarRaw) {
    const a = cleanAadhaar(aadhaarRaw);
    if (a) {
      data.aadhaarEnc = encrypt(a);
      data.aadhaarLast4 = a.slice(-4);
      data.kycVerified = false;
    }
  }
  const kycFile = fd.get("kycFile");
  if (kycFile && typeof kycFile === "object" && "size" in kycFile && kycFile.size > 0) {
    const f = kycFile as File;
    const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const key = `${familyId}/${memberId || "new"}-${Date.now()}.${ext}`;
    await putFile("kyc", key, Buffer.from(await f.arrayBuffer()), f.type || "image/jpeg");
    data.kycFileKey = key;
    data.kycVerified = false;
  }

  let id = memberId;
  if (existing) {
    await prisma.member.update({ where: { id: memberId }, data });
  } else {
    const count = await prisma.member.count({ where: { familyId } });
    const m = await prisma.member.create({ data: { ...(data as typeof prepared), familyId, serial: count + 1 } });
    id = m.id;
  }
  // one head per family
  if (prepared.isHead) {
    await prisma.member.updateMany({ where: { familyId, id: { not: id } }, data: { isHead: false } });
  }
  await inferHeadGender(familyId);
  const { aadhaarEnc: _omit, ...logged } = data;
  await audit(s.uid, existing ? "update" : "create", "Member", id, logged as object);
  revalidatePath(`/families/${familyId}`);
  redirect(`/families/${familyId}`);
}

export async function deleteMember(fd: FormData) {
  const s = await requireSession("delete");
  const id = str(fd, "memberId");
  const m = await prisma.member.delete({ where: { id } });
  await audit(s.uid, "delete", "Member", id, { name: m.nameRaw, familyId: m.familyId });
  revalidatePath(`/families/${m.familyId}`);
}

export async function approveKyc(fd: FormData) {
  const s = await requireSession("approve");
  const id = str(fd, "memberId");
  const m = await prisma.member.update({ where: { id }, data: { kycVerified: true, kycVerifiedBy: s.name, kycVerifiedAt: new Date() } });
  await audit(s.uid, "approve", "Member", id, { kyc: true });
  revalidatePath(`/families/${m.familyId}`);
}

/** Recompute search keys (e.g. after rule changes). */
export async function reindexFamily(familyId: string) {
  const fam = await prisma.family.findUniqueOrThrow({ where: { id: familyId }, include: { members: true } });
  for (const m of fam.members) {
    await prisma.member.update({ where: { id: m.id }, data: { searchKey: computeSearchKey(m, fam.code) } });
  }
}
