"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { evaluateAll, sortBySurname } from "@/lib/members";
import { audit } from "@/lib/audit";

/** Give a permanent voter number to every eligible member who does not have one yet (surname order). */
export async function assignVoterNumbers() {
  const s = await requireSession("approve");
  const { rows } = await evaluateAll();
  const todo = sortBySurname(rows.filter((r) => r.result.eligible && r.member.voterNo === null));
  const max = await prisma.member.aggregate({ _max: { voterNo: true } });
  let n = max._max.voterNo ?? 0;
  for (const r of todo) {
    n++;
    await prisma.member.update({ where: { id: r.member.id }, data: { voterNo: n } });
  }
  await audit(s.uid, "assignVoterNos", "Member", null, { count: todo.length, last: n });
  revalidatePath("/voters");
}
