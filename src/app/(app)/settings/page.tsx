import { revalidatePath } from "next/cache";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { getSettings, setSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";

async function save(fd: FormData) {
  "use server";
  const s = await requireSession("settings");
  const electionDate = String(fd.get("electionDate") ?? "");
  const purposes = String(fd.get("receiptPurposes") ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
  await setSetting("electionDate", electionDate);
  const ageCutoffDate = String(fd.get("ageCutoffDate") ?? "");
  await setSetting("ageCutoffDate", ageCutoffDate);
  await setSetting("applyStatusRules", fd.get("applyStatusRules") === "on" ? "true" : "false");
  await setSetting("sanghName", String(fd.get("sanghName") ?? "").trim());
  await setSetting("sanghAddress", String(fd.get("sanghAddress") ?? "").trim());
  await setSetting("sanghRegNo", String(fd.get("sanghRegNo") ?? "").trim());
  await setSetting("receiptPurposes", JSON.stringify(purposes));
  await audit(s.uid, "update", "Settings", null, { electionDate, ageCutoffDate, purposes });
  revalidatePath("/", "layout");
}

export default async function SettingsPage() {
  await requireSession("settings");
  const t = getDict();
  const s = await getSettings();
  return (
    <div className="space-y-3 max-w-xl">
      <h1 className="text-xl font-bold">{t.settings}</h1>
      <form action={save} className="card p-4 space-y-3">
        <div>
          <label className="label">{t.ageCutoffDate}</label>
          <input type="date" name="ageCutoffDate" className="input" required defaultValue={s.ageCutoffDate ? s.ageCutoffDate.toISOString().slice(0, 10) : ""} />
          <p className="text-xs text-stone-500 mt-1">{t.ageCutoffHelp}</p>
        </div>
        <div>
          <label className="label">{t.electionDate}</label>
          <input type="date" name="electionDate" className="input" defaultValue={s.electionDate ? s.electionDate.toISOString().slice(0, 10) : ""} />
          
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="applyStatusRules" defaultChecked={s.applyStatusRules} className="mt-1" />
          <span>सदस्यत्व रद्द नियम लागू करा (निधन, विवाहानंतर बाहेर, कार्यक्षेत्राबाहेर सदस्य मतदार यादीतून वगळा). सध्या बंद.</span>
        </label>
        <div>
          <label className="label">संघाचे नाव (पावतीवर)</label>
          <input name="sanghName" className="input" defaultValue={s.sanghName} />
        </div>
        <div>
          <label className="label">संघाचा पत्ता (पावतीवर)</label>
          <textarea name="sanghAddress" className="input" rows={2} defaultValue={s.sanghAddress} />
        </div>
        <div>
          <label className="label">नोंदणी क्रमांक (पावतीवर)</label>
          <input name="sanghRegNo" className="input" defaultValue={s.sanghRegNo} />
        </div>
        <div>
          <label className="label">पावती तपशील (एका ओळीत एक)</label>
          <textarea name="receiptPurposes" className="input" rows={4} defaultValue={s.receiptPurposes.join("\n")} />
        </div>
        <button className="btn-primary">{t.save}</button>
      </form>
    </div>
  );
}
