"use server";
// Yearly donations (decided 23 Oct 2026). Recording a payment: anyone who can edit families.
// Year amounts, Exempt marks and removing an entry: Admin only ("donationAdmin"). Every change is audited.
import { revalidatePath } from "next/cache";
import type { DonationKind, PaymentMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { audit } from "@/lib/audit";
import { flashErr, flashOk } from "@/lib/flash";
import { DONATION_MODES, FIRST_DONATION_YEAR, asKind, currentYear } from "@/lib/donations";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function yearOf(fd: FormData, maxAhead = 0): number | null {
  const y = parseInt(str(fd, "year"), 10);
  return y >= FIRST_DONATION_YEAR && y <= currentYear() + maxAhead ? y : null;
}

function rupeesOf(v: string): number | null {
  const n = Number(v.replace(/[,₹\s]/g, ""));
  return Number.isInteger(n) && n > 0 && n <= 10_000_000 ? n : null;
}

function done() {
  revalidatePath("/", "layout");
  flashOk("saved");
}

/** Admin: the amount every family gives for this donation and year. Setting it opens the year. */
export async function setYearAmountAction(fd: FormData) {
  const s = await requireSession("donationAdmin");
  const kind = asKind(str(fd, "kind"));
  const year = yearOf(fd, 1);
  const amount = rupeesOf(str(fd, "amount"));
  if (!year || !amount) return flashErr("amountInvalid");
  const before = await prisma.donationYear.findUnique({ where: { kind_year: { kind, year } } });
  await prisma.donationYear.upsert({
    where: { kind_year: { kind, year } },
    create: { kind, year, amount, updatedById: s.uid },
    update: { amount, updatedById: s.uid },
  });
  await audit(s.uid, before ? "update" : "create", "DonationYear", `${kind}:${year}`, { amount, before: before?.amount ?? null });
  done();
}

/** Record (or correct) a family's payment for an open year. */
export async function recordPaymentAction(fd: FormData) {
  const s = await requireSession("edit");
  const kind: DonationKind = asKind(str(fd, "kind"));
  const year = yearOf(fd);
  const familyId = str(fd, "familyId");
  const dy = year ? await prisma.donationYear.findUnique({ where: { kind_year: { kind, year } } }) : null;
  const fam = familyId ? await prisma.family.findFirst({ where: { id: familyId, deletedAt: null }, select: { id: true } }) : null;
  if (!year || !dy || !fam) return flashErr("checkForm");
  const amount = rupeesOf(str(fd, "amount") || String(dy.amount));
  const paidOn = /^\d{4}-\d{2}-\d{2}$/.test(str(fd, "paidOn")) ? new Date(`${str(fd, "paidOn")}T00:00:00Z`) : null;
  const modeRaw = str(fd, "mode") as PaymentMode;
  const mode = DONATION_MODES.includes(modeRaw) ? modeRaw : "CASH";
  if (!amount) return flashErr("amountInvalid");
  if (!paidOn || paidOn.getTime() > Date.now() + 86_400_000) return flashErr("checkForm");
  const data = { status: "PAID" as const, amount, paidOn, mode, receiptNo: str(fd, "receiptNo").slice(0, 40), note: str(fd, "note").slice(0, 300) };
  const before = await prisma.donation.findUnique({ where: { familyId_kind_year: { familyId, kind, year } } });
  const row = await prisma.donation.upsert({
    where: { familyId_kind_year: { familyId, kind, year } },
    create: { familyId, kind, year, ...data, createdById: s.uid },
    update: { ...data, updatedById: s.uid },
  });
  await audit(s.uid, before ? "update" : "create", "Donation", row.id, { familyId, kind, year, ...data, paidOn: str(fd, "paidOn"), before: before ? { status: before.status, amount: before.amount, receiptNo: before.receiptNo } : null });
  done();
}

/** Admin: this family does not have to give for this year (hardship, joined late, ...). */
export async function markExemptAction(fd: FormData) {
  const s = await requireSession("donationAdmin");
  const kind = asKind(str(fd, "kind"));
  const year = yearOf(fd);
  const familyId = str(fd, "familyId");
  const dy = year ? await prisma.donationYear.findUnique({ where: { kind_year: { kind, year } } }) : null;
  if (!year || !dy || !familyId) return flashErr("checkForm");
  const data = { status: "EXEMPT" as const, amount: null, paidOn: null, mode: null, receiptNo: "", note: str(fd, "note").slice(0, 300) };
  const before = await prisma.donation.findUnique({ where: { familyId_kind_year: { familyId, kind, year } } });
  const row = await prisma.donation.upsert({
    where: { familyId_kind_year: { familyId, kind, year } },
    create: { familyId, kind, year, ...data, createdById: s.uid },
    update: { ...data, updatedById: s.uid },
  });
  await audit(s.uid, before ? "update" : "create", "Donation", row.id, { familyId, kind, year, status: "EXEMPT", note: data.note, before: before ? { status: before.status, amount: before.amount, receiptNo: before.receiptNo } : null });
  done();
}

/** Admin: remove a Paid or Exempt entry (the family shows as Unpaid again). The removed entry is kept in the audit log. */
export async function removeDonationAction(fd: FormData) {
  const s = await requireSession("donationAdmin");
  const id = str(fd, "id");
  const row = await prisma.donation.findUnique({ where: { id } });
  if (!row) return flashErr("error");
  await prisma.donation.delete({ where: { id } });
  await audit(s.uid, "delete", "Donation", id, {
    familyId: row.familyId, kind: row.kind, year: row.year, status: row.status, amount: row.amount,
    paidOn: row.paidOn?.toISOString().slice(0, 10) ?? null, mode: row.mode, receiptNo: row.receiptNo, note: row.note, createdById: row.createdById,
  });
  revalidatePath("/", "layout");
  flashOk("deleted");
}
