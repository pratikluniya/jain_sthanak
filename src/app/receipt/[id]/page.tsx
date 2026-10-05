import { RECEIPTS_ENABLED } from "@/lib/features";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { exportDict as t } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { rupeesInEnglish, rupeesInMarathi } from "@/lib/words";
import PrintButton from "@/components/PrintButton";
import { cancelReceipt } from "@/app/(app)/receipts/actions";

export const dynamic = "force-dynamic";

// Printable receipt (Marathi, English digits). Half A4 so two fit on one sheet.
export default async function ReceiptPrint({ params }: { params: { id: string } }) {
  if (!RECEIPTS_ENABLED) notFound(); // receipts are hidden until phase 2 (src/lib/features.ts)
  await requireSession("receipts");
  const p = await prisma.payment.findUnique({ where: { id: params.id }, include: { family: true } });
  if (!p) notFound();
  const s = await getSettings();
  const items = p.items as { purpose: string; amount: number }[];

  return (
    <div className="bg-white min-h-screen p-4">
      <style>{`@page { size: A4 portrait; margin: 10mm; }`}</style>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <PrintButton />
        {!p.cancelled && (
          <form action={cancelReceipt}>
            <input type="hidden" name="id" value={p.id} />
            <button className="btn-danger">{t.cancelled}</button>
          </form>
        )}
      </div>
      <div className="relative max-w-[190mm] mx-auto border-2 border-stone-800 p-5 text-[13px]" style={{ minHeight: "130mm" }}>
        {p.cancelled && (
          <div className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-red-500/40 rotate-[-20deg] pointer-events-none">{t.cancelled}</div>
        )}
        <div style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
          <div className="text-center text-[11px] text-jain-red">॥ श्री महावीराय नमः ॥</div>
          <div className="flex items-center gap-3 pb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-20 w-auto object-contain" />
            <div className="flex-1 text-center">
              <div className="text-xl font-bold text-jain-red">{s.sanghName}</div>
              {s.sanghAddress && <div className="text-xs text-jain-blue">{s.sanghAddress}</div>}
              {s.sanghRegNo && <div className="text-[10px] text-stone-600">{s.sanghRegNo}</div>}
            </div>
            <div className="w-16" />
          </div>
          <div className="jain-stripe" />
          <div className="text-center font-semibold mt-2">पावती</div>
        </div>
        <div className="flex justify-between mt-3">
          <span>{t.receiptNo}: <b>{p.receiptNo}</b></span>
          <span>{t.date}: <b>{p.date.toLocaleDateString("en-IN")}</b></span>
        </div>
        <p className="mt-2">
          श्री / श्रीमती <b>{p.paidBy || p.family.headName}</b> ({t.familyCode}: {p.family.code}) यांच्याकडून खालील तपशीलाप्रमाणे रक्कम {t.received}:
        </p>
        <table className="w-full mt-2 border-collapse">
          <thead>
            <tr>
              <th className="border border-stone-700 px-2 py-1 w-10">{t.serialNo}</th>
              <th className="border border-stone-700 px-2 py-1 text-left">{t.purpose}</th>
              <th className="border border-stone-700 px-2 py-1 w-28 text-right">{t.amount} ₹</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="border border-stone-700 px-2 py-1 text-center">{i + 1}</td>
                <td className="border border-stone-700 px-2 py-1">{it.purpose}</td>
                <td className="border border-stone-700 px-2 py-1 text-right">{it.amount.toLocaleString("en-IN")}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="border border-stone-700 px-2 py-1" colSpan={2}>{t.total}</td>
              <td className="border border-stone-700 px-2 py-1 text-right">{p.total.toLocaleString("en-IN")}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2">{t.amountInWords}: <b>{rupeesInMarathi(p.total)}</b></p>
        <p className="text-xs text-stone-600">({rupeesInEnglish(p.total)})</p>
        <p className="mt-2">{t.paymentMode}: <b>{t[p.mode]}</b>{p.reference && ` · ${t.reference}: ${p.reference}`}</p>
        <div className="flex justify-between mt-10">
          <span className="text-xs text-stone-500">{p.createdBy}</span>
          <span className="border-t border-stone-700 pt-1 px-6">{t.signature}</span>
        </div>
      </div>
    </div>
  );
}
