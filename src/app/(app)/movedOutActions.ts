"use server";
// Moved out of the area: Admin and Operator ("approve" permission).
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { markFamilyMovedOut, markMemberMovedOut, undoFamilyMovedOut, undoMemberMovedOut } from "@/lib/movedOut";

export type MoveState = { ok?: boolean; error?: "notFound" | "mustChooseHead" | "dateInFuture" | "dateRequired" };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "");

export async function moveOutAction(_: MoveState, fd: FormData): Promise<MoveState> {
  const s = await requireSession("approve");
  const input = { date: str(fd, "date"), city: str(fd, "city"), remark: str(fd, "remark"), by: s.uid };
  const familyId = str(fd, "familyId");
  const memberId = str(fd, "memberId");
  const r = familyId
    ? await markFamilyMovedOut({ ...input, familyId })
    : await markMemberMovedOut({ ...input, memberId, newHeadId: str(fd, "newHeadId") || undefined });
  if (!r.ok) return { error: r.error };
  await audit(s.uid, "movedOut", familyId ? "Family" : "Member", familyId || memberId, { date: input.date, city: input.city, remark: input.remark });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function undoMemberMovedOutAction(fd: FormData) {
  const s = await requireSession("approve");
  const id = str(fd, "memberId");
  if ((await undoMemberMovedOut(id)) === "ok") await audit(s.uid, "undoMovedOut", "Member", id, {});
  revalidatePath("/", "layout");
}

export async function undoFamilyMovedOutAction(fd: FormData) {
  const s = await requireSession("approve");
  const id = str(fd, "familyId");
  await undoFamilyMovedOut(id);
  await audit(s.uid, "undoMovedOut", "Family", id, {});
  revalidatePath("/", "layout");
}
