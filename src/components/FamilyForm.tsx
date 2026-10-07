import type { Family } from "@prisma/client";
import type { Dict } from "@/lib/i18n";
import { saveFamily } from "@/app/(app)/families/actions";

export default function FamilyForm({ t, fam }: { t: Dict; fam?: Family | null }) {
  return (
    <form action={saveFamily} className="card p-4 space-y-3">
      {fam && <input type="hidden" name="id" value={fam.id} />}
      <div>
        <label className="label">{t.headName}</label>
        <input name="headName" className="input" defaultValue={fam?.headName ?? ""} required />
      </div>
      <div>
        <label className="label">{t.headNameEn}</label>
        <input name="headNameEn" className="input" defaultValue={fam?.headNameEn ?? ""} />
        <p className="text-xs text-stone-500 mt-1">{t.englishAutoHelp}</p>
      </div>
      <div>
        <label className="label">{t.address}</label>
        <textarea name="address" className="input" rows={2} defaultValue={fam?.address ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{t.area}</label>
          <input name="area" className="input" defaultValue={fam?.area ?? ""} />
        </div>
        <div>
          <label className="label">{t.status}</label>
          <select name="status" className="input" defaultValue={fam?.status ?? "ACTIVE"}>
            {(fam?.status === "MOVED_OUT" ? (["MOVED_OUT"] as const) : (["ACTIVE", "INACTIVE"] as const)).map((x) => <option key={x} value={x}>{t[x]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t.panth}</label>
          <select name="panth" className="input" defaultValue={fam?.panth ?? "UNKNOWN"}>
            {(["STHANAKVASI", "MANDIRMARGI", "TERAPANTH", "DIGAMBAR", "UNKNOWN"] as const).map((x) => <option key={x} value={x}>{t[x]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t.panthStatus}</label>
          <select name="panthStatus" className="input" defaultValue={fam?.panthStatus ?? "TO_VERIFY"}>
            <option value="TO_VERIFY">{t.toVerify}</option>
            <option value="CONFIRMED">{t.confirmed}</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">{t.notes}</label>
        <textarea name="notes" className="input" rows={2} defaultValue={fam?.notes ?? ""} />
      </div>
      <button className="btn-primary w-full sm:w-auto">{t.save}</button>
    </form>
  );
}
