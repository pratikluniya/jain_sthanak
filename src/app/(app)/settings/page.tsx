import Link from "next/link";
import { getDict } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { SETTING_GROUPS, displayValue } from "./meta";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireSession("settings");
  const t = getDict();
  const s = await getSettings();
  return (
    <div className="space-y-5">
      <h1 className="page-title">{t.settings}</h1>
      {SETTING_GROUPS.map((g) => (
        <section key={g.title(t)} className="space-y-2">
          <h2 className="section-title">{g.title(t)}</h2>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-1/4">{t.settingCol}</th>
                  <th className="w-1/5">{t.valueCol}</th>
                  <th>{t.usedForCol}</th>
                  <th className="text-right">{t.actionsCol}</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((d) => (
                  <tr key={d.key}>
                    <td className="font-medium">{d.label(t)}</td>
                    <td className="font-semibold text-stone-900">{displayValue(s, d, t)}</td>
                    <td className="min-w-[16rem] text-stone-600">{d.usedFor(t)}</td>
                    <td className="text-right">
                      <Link href={`/settings/${d.key}`} className="btn-secondary btn-sm">{t.edit}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
