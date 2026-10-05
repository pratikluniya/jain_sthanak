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
import { toEnglishName } from "@/lib/translit";
import { todayIST } from "@/lib/deceased";
import type { Panth, PanthStatus, FamilyStatus } from "@prisma/client";
import { restoreFamily as restoreFamilyRecord, restoreMember as restoreMemberRecord, softDeleteFamily, softDeleteMember } from "@/lib/softDelete";

const PANTHS: Panth[] = ["STHANAKVASI", "MANDIRMARGI", "TERAPANTH", "DIGAMBAR", "UNKNOWN"];

function str(fd: FormData, k: string) {
  return String(fd.get(k) ?? "").trim();
}

/**
 * English spelling the volunteer left unchanged while changing the Devanagari name is out of date,
 * so it is dropped and filled again automatically.
 */
function freshEnglish(postedEn: string, postedDev: string, old?: { en: string; dev: string } | null) {
  if (old && postedEn === old.en && postedDev !== old.dev) return "";
  return postedEn;
}

export async function saveFamily(fd: FormData) {
  const s = await requireSession("edit");
  const id = str(fd, "id");
  const old = id ? await prisma.family.findUnique({ where: { id }, select: { headName: true, headNameEn: true, deletedAt: true } }) : null;
  if (old?.deletedAt) throw new Error("Family is deleted");
  const panth = (PANTHS.includes(str(fd, "panth") as Panth) ? str(fd, "panth") : "UNKNOWN") as Panth;
  const data = {
    headName: str(fd, "headName"),
    headNameEn:
      freshEnglish(str(fd, "headNameEn"), str(fd, "headName"), old && { en: old.headNameEn, dev: old.headName }) ||
      toEnglishName(str(fd, "headName")),
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
  const fam = await prisma.family.findUnique({ where: { id }, include: { members: { where: { deletedAt: null } } } });
  if (!fam || fam.deletedAt) redirect("/families");
  await softDeleteFamily(id, s.uid);
  await audit(s.uid, "delete", "Family", id, { code: fam.code, headName: fam.headName, members: fam.members.length, soft: true });
  revalidatePath("/", "layout");
  redirect("/families");
}

export async function restoreFamily(fd: FormData) {
  const s = await requireSession("restore");
  const id = str(fd, "id");
  await restoreFamilyRecord(id);
  await audit(s.uid, "restore", "Family", id, {});
  revalidatePath("/", "layout");
  redirect(`/families/${id}`);
}

export async function saveMember(fd: FormData) {
  const s = await requireSession("edit");
  const familyId = str(fd, "familyId");
  const memberId = str(fd, "memberId");
  const fam = await prisma.family.findUniqueOrThrow({ where: { id: familyId } });
  if (fam.deletedAt) throw new Error("Family is deleted");
  const existing = memberId ? await prisma.member.findUnique({ where: { id: memberId } }) : null;
  if (existing?.deletedAt) throw new Error("Member is deleted");

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
      firstNameEn: freshEnglish(str(fd, "firstNameEn"), str(fd, "firstName"), existing && { en: existing.firstNameEn, dev: existing.firstName }),
      middleNameEn: freshEnglish(str(fd, "middleNameEn"), str(fd, "middleName"), existing && { en: existing.middleNameEn, dev: existing.middleName }),
      surnameEn: freshEnglish(str(fd, "surnameEn"), str(fd, "surname"), existing && { en: existing.surnameEn, dev: existing.surname }),
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
      // keep the current head (after a head change the new head may not have relation "self" yet)
      isHead: existing?.isHead,
    },
    fam.code,
    recordedOn,
  );
  if (existing) prepared.nameRaw = existing.nameRaw || prepared.nameRaw;

  const data: Record<string, unknown> = { ...prepared };

  // Deceased via the edit form: record who marked it and when (for the 15-day reminder); clear it when changed back
  if (prepared.status === "DECEASED") {
    const dod = str(fd, "dateOfDeath");
    data.dateOfDeath = /^\d{4}-\d{2}-\d{2}$/.test(dod) && dod <= todayIST() ? new Date(dod) : null;
    if (existing?.status !== "DECEASED") {
      data.deceasedMarkedAt = new Date();
      data.deceasedMarkedById = s.uid;
    }
  } else {
    data.dateOfDeath = null;
    data.deceasedMarkedAt = null;
    data.deceasedMarkedById = null;
  }

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
  // Aadhaar front + back (bucket "kyc", Aadhaar-permission only) and passport photo (bucket "photos")
  const upload = async (field: string, bucket: "kyc" | "photos", suffix: string) => {
    const v = fd.get(field);
    if (!v || typeof v !== "object" || !("size" in v) || v.size === 0) return null;
    const f = v as File;
    const ext = f.type === "application/pdf" ? "pdf" : (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    if (!["jpg", "png", "webp", "pdf"].includes(ext)) return null;
    const key = `${familyId}/${memberId || "new"}-${suffix}-${Date.now()}.${ext}`;
    await putFile(bucket, key, Buffer.from(await f.arrayBuffer()), f.type || "image/jpeg");
    return key;
  };
  const front = await upload("kycFile", "kyc", "front");
  if (front) {
    data.kycFileKey = front;
    data.kycDocType = "AADHAAR";
    data.kycVerified = false;
  }
  const back = await upload("aadhaarBackFile", "kyc", "back");
  if (back) {
    data.aadhaarBackKey = back;
    data.kycVerified = false;
  }
  const photo = await upload("photoFile", "photos", "photo");
  if (photo) data.photoKey = photo;

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
    await prisma.member.updateMany({ where: { familyId, id: { not: id }, deletedAt: null }, data: { isHead: false } });
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
  const m = await softDeleteMember(id, s.uid);
  await audit(s.uid, "delete", "Member", id, { name: m.nameRaw, familyId: m.familyId, soft: true });
  revalidatePath("/", "layout");
}

export async function restoreMember(fd: FormData) {
  const s = await requireSession("restore");
  const id = str(fd, "memberId");
  const r = await restoreMemberRecord(id);
  if (r === "ok") await audit(s.uid, "restore", "Member", id, {});
  revalidatePath("/", "layout");
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
