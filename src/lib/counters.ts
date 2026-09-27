import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient | typeof prisma;

/** Atomically increments and returns the next value of a named counter. */
export async function nextValue(name: string, tx: Tx = prisma): Promise<number> {
  const c = await tx.counter.upsert({
    where: { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return c.value;
}

export async function nextFamilyCode(tx: Tx = prisma): Promise<string> {
  const n = await nextValue("family", tx);
  return `NR-${String(n).padStart(4, "0")}`;
}

/** Indian financial year for a date: Apr 2026 - Mar 2027 -> "2026-27". */
export function financialYear(d: Date): string {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

export async function nextReceiptNo(date: Date, tx: Tx = prisma): Promise<{ receiptNo: string; fy: string }> {
  const fy = financialYear(date);
  const n = await nextValue(`receipt:${fy}`, tx);
  return { receiptNo: `${fy}/${String(n).padStart(4, "0")}`, fy };
}
