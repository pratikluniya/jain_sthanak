import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Mukta, Noto_Sans_Devanagari } from "next/font/google";
import { getDict, getLang } from "@/lib/i18n";
import Feedback from "@/components/Feedback";

// Downloaded at build time and served from our own domain: no request to Google on page load.
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-devanagari",
});

// Headings, the Sangh name and the logo text: Mukta (clear, modern Devanagari + English).
const heading = Mukta({
  subsets: ["devanagari", "latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "जैन संघ नाशिकरोड | सदस्य व मतदार यादी",
  description: "श्री जैन स्थानकवासी श्रावक संघ, नाशिकरोड",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#a51b23" };

function feedbackLabels() {
  const t = getDict();
  const keys = ["saved", "created", "deleted", "restored", "approved", "rejected", "done", "error", "notAllowed", "checkForm", "imported"] as const;
  return {
    toasts: Object.fromEntries(keys.map((k) => [k, t[`toast_${k}`]])),
    confirmTitle: t.fb_confirmTitle,
    confirmSave: t.fb_confirmSave,
    confirmDanger: t.fb_confirmDanger,
    yes: t.fb_yes,
    cancel: t.fb_cancel,
    close: t.close,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLang()} className={`${devanagari.variable} ${heading.variable}`}>
      <body className="min-h-screen">
        {children}
        <Feedback t={feedbackLabels()} />
      </body>
    </html>
  );
}
