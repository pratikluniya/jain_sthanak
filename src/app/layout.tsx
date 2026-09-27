import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getLang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "जैन संघ नाशिकरोड | सदस्य व मतदार यादी",
  description: "श्री जैन स्थानकवासी श्रावक संघ, नाशिकरोड",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#c4650a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLang()}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
