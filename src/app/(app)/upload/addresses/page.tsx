import { requireSession } from "@/lib/session";
import { getDict } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { importEnglishAddresses } from "./actions";

// Admin only: English addresses for families saved before the English address field existed.
export default async function EnglishAddressesPage({ searchParams }: { searchParams: { done?: string; unknown?: string } }) {
  await requireSession("settings");
  const t = getDict();
  const [total, missing] = await Promise.all([
    prisma.family.count({ where: { deletedAt: null } }),
    prisma.family.count({ where: { deletedAt: null, addressEn: "" } }),
  ]);
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="page-title">{t.addrPageTitle}</h1>
      <p className="text-sm text-stone-600">{t.addrPageHelp}</p>
      <p className="text-sm">
        {t.addrMissingCount}: <b>{missing}</b> / {total}
      </p>
      <section className="card p-4 space-y-2">
        <h2 className="section-title">1. {t.addrStepDownload}</h2>
        <a href="/api/addresses" className="btn-secondary inline-block">⬇ family-addresses.csv</a>
      </section>
      <section className="card p-4 space-y-2">
        <h2 className="section-title">2. {t.addrStepUpload}</h2>
        <form action={importEnglishAddresses} className="space-y-2">
          <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm" />
          <button className="btn-primary">⬆ {t.addrUploadBtn}</button>
        </form>
      </section>
      {searchParams.done !== undefined && (
        <div className="card p-3 text-sm space-y-1">
          <p>✔ {t.addrUpdated}: {searchParams.done}</p>
          {searchParams.unknown && <p className="text-red-700">{t.addrUnknown}: {searchParams.unknown}</p>}
        </div>
      )}
    </div>
  );
}
