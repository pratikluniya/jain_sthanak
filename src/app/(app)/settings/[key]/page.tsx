import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { findSetting, formValue } from "../meta";
import { saveSetting } from "../actions";

export const dynamic = "force-dynamic";

export default async function EditSettingPage({ params, searchParams }: { params: { key: string }; searchParams: { e?: string } }) {
  await requireSession("settings");
  const t = getDict();
  const def = findSetting(params.key);
  if (!def) notFound();
  const value = formValue(await getSettings(), def.key);
  const label = def.label(t);

  return (
    <div className="max-w-xl space-y-4">
      <Link href="/settings" className="text-sm text-brand-700">← {t.settings}</Link>
      <h1 className="page-title">{label}</h1>
      <form action={saveSetting} className="card space-y-4 p-4">
        <input type="hidden" name="key" value={def.key} />
        {def.kind === "onOff" ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="value" defaultChecked={value === "true"} className="mt-1" />
            <span className="font-medium">{def.checkboxLabel ? def.checkboxLabel(t) : label}</span>
          </label>
        ) : (
          <div>
            <label htmlFor="value" className="label">{label}</label>
            {def.kind === "date" || def.kind === "dateOptional" ? (
              <input id="value" name="value" type="date" className="input" defaultValue={value} required={def.kind === "date"} />
            ) : def.kind === "text" ? (
              <input id="value" name="value" className="input" defaultValue={value} />
            ) : (
              <textarea id="value" name="value" className="input" rows={def.kind === "lines" ? 5 : 3} defaultValue={value} />
            )}
          </div>
        )}
        <p className="text-sm text-stone-600">{def.usedFor(t)}</p>
        {def.key === "ageCutoffDate" && <p className="text-xs text-stone-500">{t.ageCutoffHelp}</p>}
        {searchParams.e && <p className="text-sm text-red-600">{t.notSet}</p>}
        <div className="flex gap-2">
          <button className="btn-primary">{t.save}</button>
          <Link href="/settings" className="btn-secondary">{t.cancel}</Link>
        </div>
      </form>
    </div>
  );
}
