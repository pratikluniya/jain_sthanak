// Footer on every screen (app, login, public search; not on print pages):
// Sangh copyright + "Developed & Managed by TechShree Solutions" with logo, contact and call / WhatsApp links.
import type { Dict } from "@/lib/i18n";

const SITE = "https://techshree.com";
const PHONE = "7755998862";

export default function TechShreeFooter({ t, className = "" }: { t: Pick<Dict, "sangh" | "devBy" | "allRights" | "call" | "whatsapp">; className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className={`no-print ${className}`}>
      <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_3px_rgba(41,37,36,0.06)]">
        <div className="h-[3px] bg-gradient-to-r from-brand-700 to-[#ff8b09]" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
          <a href={SITE} target="_blank" rel="noopener" className="shrink-0" aria-label="TechShree Solutions">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/techshree-logo.png" alt="TechShree" className="h-7 w-auto" />
          </a>
          <div className="min-w-[10rem] flex-1 text-[13px] leading-snug text-stone-600">
            {t.devBy}{" "}
            <a href={SITE} target="_blank" rel="noopener" className="font-semibold text-stone-900 hover:text-brand-700 hover:underline">
              TechShree Solutions
            </a>
            <span className="block">Pratik Luniya</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`tel:+91${PHONE}`}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[13px] font-semibold text-orange-700 hover:bg-orange-100"
              aria-label={`${t.call} 77559 98862`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>
              77559 98862
            </a>
            <a
              href={`https://wa.me/91${PHONE}`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              aria-label={t.whatsapp}
              title={t.whatsapp}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-1 1.2-.4.2-.7.1a8.2 8.2 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.5-.5.3-.5a.6.6 0 0 0 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.5 13.5 0 0 0 5.2 4.6c.7.3 1.3.5 1.7.6a4.2 4.2 0 0 0 1.9.1 3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3M12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8m8.4-18.2A11.8 11.8 0 0 0 1.8 17.9L.1 24l6.3-1.6A11.8 11.8 0 0 0 24 12.1a11.7 11.7 0 0 0-3.6-8.5" /></svg>
            </a>
          </div>
        </div>
        <p className="border-t border-stone-100 px-4 py-2 text-center text-[11.5px] text-stone-400">
          © {year} {t.sangh}. {t.allRights}
        </p>
      </div>
    </footer>
  );
}
