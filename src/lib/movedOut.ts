// Moved out of the Sangh's area (decided 7 Oct 2026): a single member, or a whole family with all its members.
// The date is compulsory; new place and remark are optional. Moved-out people are never voters and are hidden
// from lists and exports; Admin and Operator find them under the "Moved out" filter and can undo.
import { prisma } from "./db";
import { changeHead, headCandidates, todayIST } from "./deceased";

export type MoveResult = { ok: true } | { ok: false; error: "notFound" | "mustChooseHead" | "dateInFuture" | "dateRequired" };

interface MoveInput {
  date: string;
  city?: string;
  remark?: string;
  by: string;
}

function checkDate(date: string): MoveResult | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "dateRequired" };
  if (date > todayIST()) return { ok: false, error: "dateInFuture" };
  return null;
}

const clean = (s?: string) => (s ?? "").trim().replace(/\s+/g, " ").slice(0, 200);

/** One member moved out. If the member is the head and others stay, a new head must be chosen. */
export async function markMemberMovedOut(input: MoveInput & { memberId: string; newHeadId?: string }): Promise<MoveResult> {
  const m = await prisma.member.findUnique({ where: { id: input.memberId }, include: { family: { include: { members: { where: { deletedAt: null } } } } } });
  if (!m || m.deletedAt || m.family.deletedAt || m.status === "DECEASED" || m.status === "MOVED_OUT") return { ok: false, error: "notFound" };
  const date = (input.date ?? "").trim();
  const bad = checkDate(date);
  if (bad) return bad;

  const others = headCandidates(m.family.members, m.id);
  const newHead = m.isHead && others.length ? others.find((x) => x.id === input.newHeadId) : undefined;
  if (m.isHead && others.length && !newHead) return { ok: false, error: "mustChooseHead" };

  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: m.id },
      data: { status: "MOVED_OUT", movedOutOn: new Date(date), movedOutCity: clean(input.city), movedOutRemark: clean(input.remark), movedOutMarkedById: input.by, movedWithFamily: false },
    });
    if (newHead) await changeHead(tx, m, newHead, m.family, `स्थलांतर ${date.split("-").reverse().join("/")}`);
  });
  return { ok: true };
}

/** The whole family moved out: the family and every member still living in it (same date, place and remark). */
export async function markFamilyMovedOut(input: MoveInput & { familyId: string }): Promise<MoveResult> {
  const f = await prisma.family.findUnique({ where: { id: input.familyId } });
  if (!f || f.deletedAt || f.status === "MOVED_OUT") return { ok: false, error: "notFound" };
  const date = (input.date ?? "").trim();
  const bad = checkDate(date);
  if (bad) return bad;
  const fields = { movedOutOn: new Date(date), movedOutCity: clean(input.city), movedOutRemark: clean(input.remark), movedOutMarkedById: input.by };
  await prisma.$transaction([
    prisma.member.updateMany({
      where: { familyId: f.id, deletedAt: null, status: { notIn: ["DECEASED", "MOVED_OUT"] } },
      data: { status: "MOVED_OUT", ...fields, movedWithFamily: true },
    }),
    prisma.family.update({ where: { id: f.id }, data: { status: "MOVED_OUT", ...fields } }),
  ]);
  return { ok: true };
}

const CLEAR = { movedOutOn: null, movedOutCity: "", movedOutRemark: "", movedOutMarkedById: null };

/** Undo for one member (only when the family itself is not moved out). The head is not changed back automatically. */
export async function undoMemberMovedOut(memberId: string): Promise<"ok" | "familyMovedOut"> {
  const m = await prisma.member.findUniqueOrThrow({ where: { id: memberId }, include: { family: { select: { status: true } } } });
  if (m.family.status === "MOVED_OUT") return "familyMovedOut";
  await prisma.member.update({ where: { id: memberId }, data: { status: "ACTIVE", ...CLEAR, movedWithFamily: false } });
  return "ok";
}

/** Undo for a family: the family and the members who moved with it come back; members who moved on their own stay moved. */
export async function undoFamilyMovedOut(familyId: string) {
  await prisma.$transaction([
    prisma.member.updateMany({ where: { familyId, status: "MOVED_OUT", movedWithFamily: true }, data: { status: "ACTIVE", ...CLEAR, movedWithFamily: false } }),
    prisma.family.update({ where: { id: familyId }, data: { status: "ACTIVE", ...CLEAR } }),
  ]);
}

/** Filters for "still here": not deleted and not moved out (member and family). */
export const HERE_FAMILY = { deletedAt: null, status: { not: "MOVED_OUT" as const } };
export const HERE_MEMBER = { deletedAt: null, status: { not: "MOVED_OUT" as const }, family: HERE_FAMILY };
