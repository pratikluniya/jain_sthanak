"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { nextReceiptNo } from "@/lib/counters";
import { audit } from "@/lib/audit";
import type { PaymentMode } from "@prisma/client";

const MODES: PaymentMode[] = ["CASH", "UPI", "CHEQUE", "BANK_TRANSFER"];

export async function createReceipt(fd: FormData) {
  const s = await requireSession("receipts");
  const familyId = String(fd.get("familyId") ?? "");
  const date = new Date(String(fd.get("date") || new Date().toISOString().slice(0, 10)));
  const purposes = fd.getAll("purpose").map(String);
  const amounts = fd.getAll("amount").map((a) => Math.round(Number(a) || 0));
  const items = purposes.map((p, i) => ({ purpose: p.trim(), amount: amounts[i] ?? 0 })).filter((x) => x.purpose && x.amount > 0);
  if (!familyId || items.length === 0) throw new Error("family and at least one amount required");
  const mode = (MODES.includes(String(fd.get("mode")) as PaymentMode) ? String(fd.get("mode")) : "CASH") as PaymentMode;
  const total = items.reduce((a, b) => a + b.amount, 0);

  const p = await prisma.$transaction(async (tx) => {
    const { receiptNo, fy } = await nextReceiptNo(date, tx);
    return tx.payment.create({
      data: {
        receiptNo,
        financialYear: fy,
        familyId,
        paidBy: String(fd.get("paidBy") ?? "").trim(),
        date,
        items,
        total,
        mode,
        reference: String(fd.get("reference") ?? "").trim(),
        createdBy: s.name,
      },
    });
  });
  await audit(s.uid, "create", "Payment", p.id, { receiptNo: p.receiptNo, total });
  redirect(`/receipt/${p.id}`);
}

export async function cancelReceipt(fd: FormData) {
  const s = await requireSession("receipts");
  const id = String(fd.get("id"));
  await prisma.payment.update({ where: { id }, data: { cancelled: true } });
  await audit(s.uid, "cancel", "Payment", id);
  revalidatePath("/receipts");
  redirect(`/receipt/${id}`);
}
