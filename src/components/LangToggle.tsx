import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { asLang, getLang, LANGS, LANG_NAMES } from "@/lib/i18n";

async function setLang(fd: FormData) {
  "use server";
  cookies().set("lang", asLang(String(fd.get("lang"))), { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export default function LangToggle() {
  const lang = getLang();
  return (
    <form action={setLang} className="inline-flex rounded-lg border border-stone-300 overflow-hidden text-sm">
      {LANGS.map((l) => (
        <button key={l} name="lang" value={l} className={`px-2.5 py-1 ${lang === l ? "bg-brand-600 text-white" : "bg-white text-stone-800"}`}>
          {LANG_NAMES[l]}
        </button>
      ))}
    </form>
  );
}
