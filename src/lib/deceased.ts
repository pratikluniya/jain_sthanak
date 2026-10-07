// Marking a member as deceased (and undoing it). Used by the family page and by the 15-day reminder popup.
import { prisma } from "./db";
import { memberFullName } from "./members";

export type MarkResult = { ok: true } | { ok: false; error: "notFound" | "mustChooseHead" | "dateInFuture" | "dateRequired" };

/** Today's date in India as YYYY-MM-DD (the server runs in UTC). */
export function todayIST(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/**
 * Marks a member deceased. The date of death is required (YYYY-MM-DD, not in the future; decided 6 Oct 2026).
 * If the member is the head of the family and other living members exist, a new head must be chosen:
 * the new head gets isHead, and the family's head name becomes the new head's name
 * (the old head is noted in the family notes).
 */
export async function markDeceased(input: { memberId: string; dateOfDeath: string; newHeadId?: string; by: string }): Promise<MarkResult> {
  const m = await prisma.member.findUnique({ where: { id: input.memberId }, include: { family: { include: { members: { where: { deletedAt: null } } } } } });
  if (!m || m.deletedAt || m.family.deletedAt || m.status === "DECEASED") return { ok: false, error: "notFound" };
  const date = input.dateOfDeath?.trim() || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "dateRequired" };
  if (date > todayIST()) return { ok: false, error: "dateInFuture" };

  const others = m.family.members.filter((x) => x.id !== m.id && x.status !== "DECEASED");
  const newHead = m.isHead && others.length ? others.find((x) => x.id === input.newHeadId) : undefined;
  if (m.isHead && others.length && !newHead) return { ok: false, error: "mustChooseHead" };

  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: m.id },
      data: {
        status: "DECEASED",
        dateOfDeath: new Date(date),
        deceasedMarkedAt: new Date(),
        deceasedMarkedById: input.by,
        ...(newHead ? { isHead: false } : {}),
      },
    });
    if (newHead) {
      // the head is the member with relation "self"; the old head's relation is rewritten as seen from the new head
      await tx.member.update({ where: { id: m.id }, data: { relation: oldHeadRelation(newHead.relation, m.gender) } });
      await tx.member.update({ where: { id: newHead.id }, data: { isHead: true, relation: "SELF" } });
      const note = `पूर्वीचे कुटुंब प्रमुख: ${m.family.headName} (निधन ${date.split("-").reverse().join("/")})`;
      await tx.family.update({
        where: { id: m.familyId },
        data: {
          headName: memberFullName(newHead, false, false),
          headNameEn: memberFullName(newHead, false, true),
          notes: m.family.notes ? `${m.family.notes}\n${note}` : note,
        },
      });
    }
  });
  return { ok: true };
}

/**
 * The old head's relation to the new head. Only the clear cases are mapped; everything else becomes "other".
 * Other members keep their relation to the old head: a volunteer should correct them on the edit page.
 */
export function oldHeadRelation(newHeadWas: string, oldHeadGender: string): string {
  if (newHeadWas === "WIFE") return "HUSBAND";
  if (newHeadWas === "HUSBAND") return "WIFE";
  if (newHeadWas === "SON" || newHeadWas === "DAUGHTER") return oldHeadGender === "FEMALE" ? "MOTHER" : oldHeadGender === "MALE" ? "FATHER" : "OTHER";
  return "OTHER";
}

/** Undo a deceased mark made by mistake. The head of the family is not changed back automatically. */
export async function undoDeceased(memberId: string) {
  return prisma.member.update({
    where: { id: memberId },
    data: { status: "ACTIVE", dateOfDeath: null, deceasedMarkedAt: null, deceasedMarkedById: null },
  });
}

export const DEMISE_EVERY_DAYS = 15;

/** Deceased members with no date of death (e.g. from old forms): flagged on the dashboard, members list and family page. */
export const MISSING_DOD_WHERE = { deletedAt: null, status: "DECEASED" as const, dateOfDeath: null, family: { deletedAt: null } };

/** Is the 15-day reminder due for this user? Never answered = due now. "Later" hides it until the next day. */
export function demiseReminderDue(u: { demiseCheckDoneAt: Date | null; demiseSnoozeUntil: Date | null }, now = new Date()): boolean {
  if (u.demiseSnoozeUntil && now < u.demiseSnoozeUntil) return false;
  if (!u.demiseCheckDoneAt) return true;
  return now.getTime() - u.demiseCheckDoneAt.getTime() >= DEMISE_EVERY_DAYS * 86_400_000;
}

/** Start of the next day in India (for "Remind me later"). */
export function nextDayIST(now = new Date()): Date {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const nextMidnightIstAsUtc = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1);
  return new Date(nextMidnightIstAsUtc - 330 * 60_000);
}
