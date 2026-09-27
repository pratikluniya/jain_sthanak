import { prisma } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { collator } from "@/lib/members";
import { createReceipt } from "../actions";

export default async function NewReceipt({ searchParams }: { searchParams: { family?: string } }) {
  await requireSession("receipts");
  const t = getDict();
  const settings = await getSettings();
  const families = (await prisma.family.findMany({ select: { id: true, code: true, headName: true } })).sort((a, b) => collator.compare(a.code, b.code));
  const pre = families.find((f) => f.id === searchParams.family);
  const rows = settings.receiptPurposes.length ? settings.receiptPurposes : [""];

  return (
    <div className="space-y-3 max-w-xl">
      <h1 className="text-xl font-bold">{t.newReceipt}</h1>
      <form action={createReceipt} className="card p-4 space-y-3">
        <div>
          <label className="label">{t.family}</label>
          <select name="familyId" className="input" defaultValue={pre?.id ?? ""} required>
            <option value="">-</option>
            {families.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.headName}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t.paidBy}</label>
            <input name="paidBy" className="input" defaultValue={pre?.headName ?? ""} />
          </div>
          <div>
            <label className="label">{t.date}</label>
            <input name="date" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-sm font-medium text-stone-600"><span className="col-span-2">{t.purpose}</span><span>{t.amount} ₹</span></div>
          {[...rows, ""].map((p, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <input name="purpose" className="input col-span-2" defaultValue={p} />
              <input name="amount" className="input" inputMode="numeric" placeholder="0" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t.paymentMode}</label>
            <select name="mode" className="input">
              {(["CASH", "UPI", "CHEQUE", "BANK_TRANSFER"] as const).map((m) => <option key={m} value={m}>{t[m]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t.reference}</label>
            <input name="reference" className="input" />
          </div>
        </div>
        <button className="btn-primary w-full sm:w-auto">{t.save}</button>
      </form>
    </div>
  );
}
