"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";
import { normalizeMobile } from "@/lib/normalize";
import { audit } from "@/lib/audit";

export async function loginAction(_: unknown, fd: FormData): Promise<{ error?: boolean }> {
  const mobile = normalizeMobile(String(fd.get("mobile") ?? "")).value;
  const password = String(fd.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { mobile } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: true };
  }
  await createSession({ uid: user.id, name: user.name, role: user.role });
  await audit(user.id, "login", "User", user.id);
  redirect("/");
}

export async function logoutAction() {
  destroySession();
  redirect("/login");
}
