// Public voter search: open to everyone (no login) when Admin turns it on in Settings.
import type { Metadata } from "next";
import Link from "next/link";
import { getDict, getLang } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { publicVoterSearch, validQuery } from "@/lib/publicSearch";
import { audit } from "@/lib/audit";
import LangToggle from "@/components/LangToggle";

export const dynamic = "force-dynamic";

const site = process.env.APP_DOMAIN ? `https://${process.env.APP_DOMAIN}` : "http://localhost:3000";

// WhatsApp / social preview: logo + title (always Marathi, the Sangh's main language)
export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "मतदार यादीत आपले नाव शोधा | श्री जैन स्थानकवासी श्रावक संघ, नाशिकरोड",
  description: "श्री जैन स्थानकवासी श्रावक संघ, नाशिकरोड · मतदार यादी शोध",
  openGraph: {
    title: "मतदार यादीत आपले नाव शोधा",
    description: "श्री जैन स्थानकवासी श्रावक संघ, नाशिकरोड",
    url: "/search",
    images: [{ url: "/logo.png", width: 768, height: 1101 }],
    type: "website",
  },
  // keep the page (and the names it shows) out of Google
  robots: { index: false, follow: false },
};

export default async function PublicSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const t = getDict();
  const en = getLang() === "en";
  const settings = await getSettings();
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const open = settings.publicSearchEnabled;
  const tried = open && q.length > 0;
  const ok = tried && validQuery(q);
  const hits = ok ? await publicVoterSearch(q, en) : [];
  // record that a search happened and whether it found someone; the typed name itself is not stored
  if (ok) await audit(null, "publicSearch", "Voter", null, { found: hits.length });

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 via-[#f6f4f1] to-[#f6f4f1]">
      <header className="bg-brand-700 text-white">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-14 w-auto shrink-0 rounded-md bg-white object-contain p-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-heading text-lg font-bold leading-snug">{t.sangh}</p>
          </div>
        </div>
        <div className="jain-stripe" />
      </header>

      <div className="mx-auto max-w-xl space-y-4 px-4 py-5">
        <div className="flex justify-end"><LangToggle /></div>
        <h1 className="page-title">{t.ps_title}</h1>

        {!open ? (
          <div className="card p-5 text-center text-stone-700">{t.ps_closed}</div>
        ) : (
          <>
            <form method="get" className="card space-y-3 p-4">
              <label htmlFor="q" className="label">{t.ps_intro}</label>
              <input id="q" name="q" defaultValue={q} placeholder={t.ps_placeholder} className="input text-lg" autoComplete="off" enterKeyHint="search" required />
              <button className="btn-primary w-full py-3 text-base">{t.search}</button>
            </form>

            {tried && !ok && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">{t.ps_twoWords}</p>}

            {ok && hits.length === 0 && (
              <div className="card space-y-1 border-red-200 p-4" role="status">
                <p className="font-semibold text-red-700">{t.ps_notFound}</p>
                <p className="whitespace-pre-wrap text-sm text-stone-700">{settings.helpDeskMessage || t.ps_defaultHelp}</p>
              </div>
            )}

            {hits.length > 0 && (
              <section className="space-y-3" role="status">
                <p className="text-sm font-semibold text-green-700">✔ {t.ps_found}{hits.length > 1 ? ` · ${t.ps_matches}: ${hits.length}` : ""}</p>
                {hits.map((h, i) => (
                  <div key={i} className="card overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-green-50 px-4 py-3">
                      <span className="text-sm text-stone-600">{t.ps_voterNo}</span>
                      {h.voterNo !== null ? (
                        <span className="font-heading text-4xl font-bold leading-none text-brand-700">{h.voterNo}</span>
                      ) : (
                        <span className="text-right text-sm font-semibold text-amber-700">{t.ps_noNumber}</span>
                      )}
                    </div>
                    <div className="space-y-1 px-4 py-3">
                      <p className="font-heading text-xl font-bold">{h.name}</p>
                      {h.address && <p className="text-sm text-stone-600">{h.address}</p>}
                      {h.voterNo !== null && <p className="pt-1 text-xs text-stone-500">{t.ps_showAtBooth}</p>}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        <p className="pt-4 text-center text-xs text-stone-500">
          <Link href="/login" className="underline">{t.staffLogin}</Link>
        </p>
      </div>
    </main>
  );
}
