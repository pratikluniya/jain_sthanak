"use server";
// Self-service for every logged-in user: correct own name, change own password.
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createSession, requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { flashErr, flashOk } from "@/lib/flash";

export type FormResult = { error?: "nameRequired" | "wrongPassword" | "passwordTooShort" | "passwordMismatch"; ok?: boolean };

function fail(error: NonNullable<FormResult["error"]>): FormResult {
  flashErr("checkForm");
  return { error };
}

export async function updateOwnName(_: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireSession("view");
  const name = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) return fail("nameRequired");
  await prisma.user.update({ where: { id: s.uid }, data: { name } });
  await audit(s.uid, "update", "User", s.uid, { name, self: true });
  // the header shows the name from the login session, so refresh it
  await createSession({ ...s, name });
  revalidatePath("/", "layout");
  flashOk("saved");
  return { ok: true };
}

export async function changeOwnPassword(_: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireSession("view");
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const user = await prisma.user.findUnique({ where: { id: s.uid } });
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) return fail("wrongPassword");
  if (next.length < 8) return fail("passwordTooShort");
  if (next !== confirm) return fail("passwordMismatch");
  await prisma.user.update({ where: { id: s.uid }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  await audit(s.uid, "update", "User", s.uid, { passwordChanged: true, self: true });
  flashOk("saved");
  return { ok: true };
}
