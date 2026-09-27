import Link from "next/link";
import { getDict } from "@/lib/i18n";

export default function Forbidden() {
  const t = getDict();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
      <p className="text-lg">{t.forbidden}</p>
      <Link href="/" className="btn-secondary">{t.back}</Link>
    </main>
  );
}
