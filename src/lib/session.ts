import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { can, type Permission, type Role } from "./rbac";
import { prisma } from "./db";

const COOKIE = "js_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

export interface Session {
  uid: string;
  name: string;
  role: Role;
}

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  return new TextEncoder().encode(s);
}

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function destroySession() {
  cookies().delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { uid: String(payload.uid), name: String(payload.name), role: payload.role as Role };
  } catch {
    return null;
  }
}

/**
 * The login cookie checked against the database: null when the user was disabled or deleted after logging in.
 * Name and role come from the database, so changes apply at once instead of after the 12-hour login ends.
 * Use this (not getSession) wherever access is decided.
 */
export async function getLiveSession(): Promise<Session | null> {
  const s = await getSession();
  if (!s) return null;
  const u = await prisma.user.findUnique({ where: { id: s.uid }, select: { name: true, role: true, active: true, deletedAt: true } });
  if (!u || !u.active || u.deletedAt) return null;
  return { uid: s.uid, name: u.name, role: u.role };
}

/** Use in pages / actions: redirects to login if not signed in (or disabled / deleted), 403 page if not allowed. */
export async function requireSession(p: Permission = "view"): Promise<Session> {
  const s = await getLiveSession();
  if (!s) redirect("/login");
  if (!can(s.role, p)) redirect("/forbidden");
  return s;
}
