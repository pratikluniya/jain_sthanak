"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { normalizeMobile } from "@/lib/normalize";
import { ROLES, type Role } from "@/lib/rbac";
import { audit } from "@/lib/audit";

export async function createUser(_: unknown, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const s = await requireSession("users");
  const mobile = normalizeMobile(String(fd.get("mobile") ?? ""));
  const name = String(fd.get("name") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const role = String(fd.get("role")) as Role;
  if (!mobile.valid) return { error: "mobile" };
  if (!name) return { error: "name" };
  if (password.length < 8) return { error: "password (min 8)" };
  if (!ROLES.includes(role)) return { error: "role" };
  if (await prisma.user.findUnique({ where: { mobile: mobile.value } })) return { error: "mobile exists" };
  const u = await prisma.user.create({ data: { name, mobile: mobile.value, role, passwordHash: await bcrypt.hash(password, 10) } });
  await audit(s.uid, "create", "User", u.id, { name, role });
  revalidatePath("/users");
  return { ok: true };
}

export async function updateUser(fd: FormData) {
  const s = await requireSession("users");
  const id = String(fd.get("id"));
  const role = String(fd.get("role")) as Role;
  const active = fd.get("active") === "on";
  const password = String(fd.get("password") ?? "");
  if (id === s.uid && (!active || role !== "ADMIN")) throw new Error("You cannot remove your own admin access");
  const data: { role?: Role; active: boolean; passwordHash?: string } = { active };
  if (ROLES.includes(role)) data.role = role;
  if (password.length >= 8) data.passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id }, data });
  await audit(s.uid, "update", "User", id, { role, active, passwordChanged: !!data.passwordHash });
  revalidatePath("/users");
}
