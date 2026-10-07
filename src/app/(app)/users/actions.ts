"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { normalizeMobile } from "@/lib/normalize";
import { ROLES, type Role } from "@/lib/rbac";
import { audit } from "@/lib/audit";

export type UserFormResult = { error?: "nameRequired" | "mobileInvalid" | "mobileExists" | "mobileOfDeletedUser" | "passwordTooShort" | "cannotChangeSelf" };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Checks shared by add and edit. Returns the cleaned values or an error code. */
async function readForm(fd: FormData, id: string | null) {
  const name = str(fd, "name").replace(/\s+/g, " ");
  const mobile = normalizeMobile(str(fd, "mobile"));
  const role = (ROLES.includes(str(fd, "role") as Role) ? str(fd, "role") : "VIEWER") as Role;
  const password = String(fd.get("password") ?? "");
  if (!name || name.length > 80) return { error: "nameRequired" as const };
  if (!mobile.valid) return { error: "mobileInvalid" as const };
  const other = await prisma.user.findUnique({ where: { mobile: mobile.value } });
  if (other && other.id !== id) return { error: other.deletedAt ? ("mobileOfDeletedUser" as const) : ("mobileExists" as const) };
  // new user: password required; edit: only when filled in
  if ((!id || password) && password.length < 8) return { error: "passwordTooShort" as const };
  return { name, mobile: mobile.value, role, password };
}

export async function createUser(_: UserFormResult, fd: FormData): Promise<UserFormResult> {
  const s = await requireSession("users");
  const f = await readForm(fd, null);
  if ("error" in f) return { error: f.error };
  const u = await prisma.user.create({
    data: { name: f.name, mobile: f.mobile, role: f.role, active: fd.get("active") === "on", passwordHash: await bcrypt.hash(f.password, 10), createdById: s.uid },
  });
  await audit(s.uid, "create", "User", u.id, { name: f.name, mobile: f.mobile, role: f.role });
  revalidatePath("/users");
  redirect("/users");
}

export async function updateUser(_: UserFormResult, fd: FormData): Promise<UserFormResult> {
  const s = await requireSession("users");
  const id = str(fd, "id");
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) redirect("/users");
  const f = await readForm(fd, id);
  if ("error" in f) return { error: f.error };
  const active = fd.get("active") === "on";
  if (id === s.uid && (!active || f.role !== "ADMIN")) return { error: "cannotChangeSelf" };
  const data: { name: string; mobile: string; role: Role; active: boolean; passwordHash?: string } = { name: f.name, mobile: f.mobile, role: f.role, active };
  if (f.password) data.passwordHash = await bcrypt.hash(f.password, 10);
  await prisma.user.update({ where: { id }, data });
  await audit(s.uid, "update", "User", id, { name: f.name, mobile: f.mobile, role: f.role, active, passwordChanged: !!data.passwordHash });
  revalidatePath("/users");
  redirect("/users");
}

/** Soft delete: the user can no longer log in and is hidden; Admin can restore. */
export async function deleteUser(fd: FormData) {
  const s = await requireSession("users");
  const id = str(fd, "id");
  if (id === s.uid) redirect(`/users/${id}/edit?e=cannotChangeSelf`);
  await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), deletedById: s.uid } });
  await audit(s.uid, "delete", "User", id, { soft: true });
  revalidatePath("/users");
  redirect("/users");
}

export async function restoreUser(fd: FormData) {
  const s = await requireSession("restore");
  const id = str(fd, "id");
  await prisma.user.update({ where: { id }, data: { deletedAt: null, deletedById: null } });
  await audit(s.uid, "restore", "User", id, {});
  revalidatePath("/users");
  redirect("/users?deleted=1");
}
