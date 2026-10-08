"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { applicationFromForm, saveApplication, updateApplication } from "@/lib/applications";
import { prisma } from "@/lib/db";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");

async function photoFrom(fd: FormData) {
  const v = fd.get("photoFile");
  if (!v || typeof v !== "object" || !("size" in v) || v.size === 0) return null;
  const f = v as File;
  if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) return null;
  return { data: Buffer.from(await f.arrayBuffer()), type: f.type };
}

/** Check screen of an individual application: save the applicant into a family. */
export async function saveApplicationAction(fd: FormData) {
  const session = await requireSession("upload");
  const uploadId = s(fd, "uploadId");
  const r = await saveApplication({
    uploadId,
    mode: s(fd, "mode") === "new" ? "new" : "existing",
    familyCode: s(fd, "familyCode"),
    relation: s(fd, "relation") || "OTHER",
    applicant: {
      title: s(fd, "title"),
      firstName: s(fd, "firstName").trim(),
      middleName: s(fd, "middleName").trim(),
      surname: s(fd, "surname").trim(),
      firstNameEn: s(fd, "firstNameEn").trim(),
      middleNameEn: s(fd, "middleNameEn").trim(),
      surnameEn: s(fd, "surnameEn").trim(),
      nameRaw: s(fd, "nameRaw"),
      gender: s(fd, "gender"),
      dob: s(fd, "dob"),
      age: s(fd, "age"),
      mobile: s(fd, "mobile"),
      occupation: s(fd, "occupation"),
      education: s(fd, "education"),
      bloodGroup: s(fd, "bloodGroup"),
    },
    application: applicationFromForm(fd),
    photo: await photoFrom(fd),
    by: { uid: session.uid, name: session.name },
  });
  if (!r.ok) {
    if (r.error === "alreadySaved") redirect("/upload");
    redirect(`/upload/${uploadId}?e=${r.error}`);
  }
  await audit(session.uid, "verify", "Upload", uploadId, { kind: "INDIVIDUAL", familyId: r.familyId, memberId: r.memberId, mode: s(fd, "mode") });
  revalidatePath("/upload");
  redirect(`/families/${r.familyId}`);
}

/** Edit page: correct the application details later. */
export async function updateApplicationAction(fd: FormData) {
  const session = await requireSession("edit");
  const memberId = s(fd, "memberId");
  const m = await prisma.member.findUniqueOrThrow({ where: { id: memberId }, select: { familyId: true } });
  await updateApplication(memberId, applicationFromForm(fd));
  await audit(session.uid, "update", "Application", memberId, {});
  revalidatePath(`/families/${m.familyId}`);
  redirect(`/families/${m.familyId}`);
}
