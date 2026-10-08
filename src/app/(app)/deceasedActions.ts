"use server";
// Deceased marking and the 15-day reminder: Admin and Operator ("approve" permission).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { markDeceased, nextDayIST, undoDeceased } from "@/lib/deceased";
import { matchesSearch } from "@/lib/normalize";
import { memberFullName } from "@/lib/members";

export type MarkState = { ok?: boolean; error?: "notFound" | "mustChooseHead" | "dateInFuture" | "dateRequired" };

export async function markDeceasedAction(_: MarkState, fd: FormData): Promise<MarkState> {
  const s = await requireSession("approve");
  const memberId = String(fd.get("memberId") ?? "");
  const dateOfDeath = String(fd.get("dateOfDeath") ?? "");
  const newHeadId = String(fd.get("newHeadId") ?? "") || undefined;
  const r = await markDeceased({ memberId, dateOfDeath, newHeadId, by: s.uid });
  if (!r.ok) return { error: r.error };
  await audit(s.uid, "deceased", "Member", memberId, { dateOfDeath, newHeadId: newHeadId ?? null });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function undoDeceasedAction(fd: FormData) {
  const s = await requireSession("approve");
  const id = String(fd.get("memberId") ?? "");
  await undoDeceased(id);
  await audit(s.uid, "undoDeceased", "Member", id, {});
  revalidatePath("/", "layout");
}

export interface DemiseCandidate {
  id: string;
  name: string;
  familyCode: string;
  familyHead: string;
  isHead: boolean;
  /** other living members who could become head (only when this member is the head) */
  others: { id: string; name: string }[];
}

/** Live, not-yet-deceased members matching the search (Marathi or English), at most 8. */
export async function searchForDemise(q: string, english: boolean): Promise<DemiseCandidate[]> {
  await requireSession("approve");
  const query = q.trim();
  if (query.length < 2) return [];
  const members = await prisma.member.findMany({
    where: { deletedAt: null, status: { notIn: ["DECEASED", "MOVED_OUT"] }, family: { deletedAt: null, status: { not: "MOVED_OUT" } } },
    include: { family: { include: { members: { where: { deletedAt: null, status: { notIn: ["DECEASED", "MOVED_OUT"] } } } } } },
  });
  return members
    .filter((m) => matchesSearch(m.searchKey, query))
    .slice(0, 8)
    .map((m) => ({
      id: m.id,
      name: memberFullName(m, true, english),
      familyCode: m.family.code,
      familyHead: english ? m.family.headNameEn || m.family.headName : m.family.headName,
      isHead: m.isHead,
      others: m.isHead ? m.family.members.filter((x) => x.id !== m.id).map((x) => ({ id: x.id, name: memberFullName(x, true, english) })) : [],
    }));
}

export async function demiseDoneAction() {
  const s = await requireSession("approve");
  await prisma.user.update({ where: { id: s.uid }, data: { demiseCheckDoneAt: new Date(), demiseSnoozeUntil: null } });
  await audit(s.uid, "demiseCheckDone", "User", s.uid, {});
  revalidatePath("/");
}

export async function demiseLaterAction() {
  const s = await requireSession("approve");
  await prisma.user.update({ where: { id: s.uid }, data: { demiseSnoozeUntil: nextDayIST() } });
  revalidatePath("/");
}
