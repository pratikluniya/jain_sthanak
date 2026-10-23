// Yearly family donations: Mahavir Jayanti and Yearly Bhojan (decided 23 Oct 2026).
// - Calendar year, tracking starts in 2026. A year counts only after an Admin sets its amount.
// - The amount is the same for every family in a year. No part payments: Paid, Exempt or Unpaid.
// - Every active family owes an open year: not deleted, not moved out, not inactive, and at least one
//   living member (all members deceased = nobody to pay). New families also owe; an Admin marks Exempt.
// - "Unpaid for N years" counts unpaid years IN A ROW back from the latest open year.
import type { DonationKind, DonationStatus, PaymentMode, Prisma } from "@prisma/client";
import { prisma } from "./db";

export const DONATION_KINDS: DonationKind[] = ["MAHAVIR_JAYANTI", "BHOJAN"];
export const FIRST_DONATION_YEAR = 2026;
export const DONATION_MODES: PaymentMode[] = ["CASH", "UPI", "CHEQUE"];

export function asKind(v: string | null | undefined): DonationKind {
  return v === "BHOJAN" ? "BHOJAN" : "MAHAVIR_JAYANTI";
}

export function asKindOrAll(v: string | null | undefined): DonationKind | "ALL" {
  return v === "BHOJAN" || v === "MAHAVIR_JAYANTI" ? v : "ALL";
}

export function currentYear(): number {
  // India time, so a payment on 31 Dec late evening is not counted in the next year
  return Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 4));
}

/** Families that owe donations. */
export const DUE_FAMILY: Prisma.FamilyWhereInput = {
  deletedAt: null,
  status: "ACTIVE",
  members: { some: { deletedAt: null, status: "ACTIVE" } },
};

export interface OpenYear {
  kind: DonationKind;
  year: number;
  amount: number;
}

/** Years with an amount set, up to this year, newest first. */
export async function openYears(kind?: DonationKind): Promise<OpenYear[]> {
  return prisma.donationYear.findMany({
    where: { ...(kind ? { kind } : {}), year: { gte: FIRST_DONATION_YEAR, lte: currentYear() } },
    orderBy: { year: "desc" },
    select: { kind: true, year: true, amount: true },
  });
}

export type CellStatus = DonationStatus | "UNPAID";

/**
 * Unpaid years in a row, counting back from the newest open year. Exempt breaks nothing and adds
 * nothing (it is skipped); a payment ends the run. `years` must be newest first.
 */
export function unpaidStreak(years: number[], statusOf: (year: number) => CellStatus): number {
  let n = 0;
  for (const y of years) {
    const st = statusOf(y);
    if (st === "PAID") break;
    if (st === "UNPAID") n++;
  }
  return n;
}

export interface ArrearsRow {
  family: { id: string; code: string; headName: string; headNameEn: string; mobile: string };
  streak: Record<DonationKind, number>;
  unpaidYears: Record<DonationKind, number[]>;
  pendingAmount: number; // all unpaid open years, both donations
}

/** Every due family with its unpaid run per donation and the total amount pending. */
export async function arrears(): Promise<ArrearsRow[]> {
  const [years, families] = await Promise.all([
    openYears(),
    prisma.family.findMany({
      where: DUE_FAMILY,
      select: {
        id: true, code: true, headName: true, headNameEn: true,
        members: { where: { deletedAt: null, status: "ACTIVE" }, select: { mobile: true, isHead: true }, orderBy: [{ isHead: "desc" }, { serial: "asc" }] },
        donations: { select: { kind: true, year: true, status: true } },
      },
    }),
  ]);
  return families.map((f) => {
    const st = new Map(f.donations.map((d) => [`${d.kind}:${d.year}`, d.status as CellStatus]));
    const streak = {} as Record<DonationKind, number>;
    const unpaidYears = {} as Record<DonationKind, number[]>;
    let pendingAmount = 0;
    for (const kind of DONATION_KINDS) {
      const ky = years.filter((y) => y.kind === kind);
      const of = (y: number) => st.get(`${kind}:${y}`) ?? "UNPAID";
      streak[kind] = unpaidStreak(ky.map((y) => y.year), of);
      unpaidYears[kind] = ky.filter((y) => of(y.year) === "UNPAID").map((y) => y.year);
      pendingAmount += ky.filter((y) => of(y.year) === "UNPAID").reduce((a, y) => a + y.amount, 0);
    }
    const mobile = f.members.find((m) => m.mobile)?.mobile ?? "";
    return { family: { id: f.id, code: f.code, headName: f.headName, headNameEn: f.headNameEn, mobile }, streak, unpaidYears, pendingAmount };
  });
}

export interface YearSummary {
  amount: number | null; // null = amount not set yet (year not open)
  due: number; // families that owe
  paid: number;
  exempt: number;
  unpaid: number;
  collected: number; // rupees
  expected: number; // (due - exempt) x amount
}

export async function yearSummary(kind: DonationKind, year: number): Promise<YearSummary> {
  const [dy, due, rows] = await Promise.all([
    prisma.donationYear.findUnique({ where: { kind_year: { kind, year } } }),
    prisma.family.count({ where: DUE_FAMILY }),
    prisma.donation.findMany({ where: { kind, year, family: DUE_FAMILY }, select: { status: true, amount: true } }),
  ]);
  const paid = rows.filter((r) => r.status === "PAID");
  const exempt = rows.filter((r) => r.status === "EXEMPT").length;
  const amount = dy?.amount ?? null;
  return {
    amount,
    due,
    paid: paid.length,
    exempt,
    unpaid: Math.max(0, due - paid.length - exempt),
    collected: paid.reduce((a, r) => a + (r.amount ?? 0), 0),
    expected: amount === null ? 0 : (due - exempt) * amount,
  };
}

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function asMinYears(v: string | null | undefined): number {
  const n = parseInt(v ?? "", 10);
  return n >= 1 && n <= 4 ? n : 2;
}

/** Families unpaid at least `min` years in a row: for one donation, or for either one ("ALL"). */
export async function arrearsFor(min: number, kind: DonationKind | "ALL"): Promise<ArrearsRow[]> {
  const rows = await arrears();
  return rows.filter((r) => (kind === "ALL" ? DONATION_KINDS.some((k) => r.streak[k] >= min) : r.streak[kind] >= min));
}
