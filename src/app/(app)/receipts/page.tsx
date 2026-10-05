import { RECEIPTS_ENABLED } from "@/lib/features";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { financialYear } from "@/lib/counters";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage({ searchParams }: { searchParams: { fy?: string } }) {
  if (!RECEIPTS_ENABLED) notFound(); // receipts are hidden until phase 2 (src/lib/features.ts)
  await requireSession("receipts");
  const t = getDict();
  const fy = searchParams.fy ?? financialYear(new Date());
  const list = await prisma.payment.findMany({ where: { financialYear: fy }, include: { family: true }, orderBy: { receiptNo: "desc" } });
  const total = list.filter((p) => !p.cancelled).reduce((a, p) => a + p.total, 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{t.receipts} <span className="text-base text-stone-500">{fy}</span></h1>
        <Link href="/receipts/new" className="btn-primary btn-sm">+ {t.newReceipt}</Link>
      </div>
      <p className="text-sm">{t.total}: <b>₹{total.toLocaleString("en-IN")}</b> · {list.length}</p>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>{t.receiptNo}</th><th>{t.date}</th><th>{t.family}</th><th>{t.amount}</th><th>{t.paymentMode}</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className={p.cancelled ? "text-stone-400 line-through" : ""}>
                <td><Link className="text-brand-700" href={`/receipt/${p.id}`}>{p.receiptNo}</Link></td>
                <td>{p.date.toLocaleDateString("en-IN")}</td>
                <td>{p.family.code} {p.paidBy || p.family.headName}</td>
                <td>₹{p.total.toLocaleString("en-IN")}</td>
                <td>{t[p.mode]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
