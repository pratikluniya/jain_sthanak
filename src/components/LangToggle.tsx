import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getLang } from "@/lib/i18n";

async function setLang(fd: FormData) {
  "use server";
  const v = fd.get("lang") === "hi" ? "hi" : "mr";
  cookies().set("lang", v, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export default function LangToggle() {
  const lang = getLang();
  return (
    <form action={setLang} className="inline-flex rounded-lg border border-stone-300 overflow-hidden text-sm">
      <button name="lang" value="mr" className={`px-3 py-1 ${lang === "mr" ? "bg-brand-600 text-white" : "bg-white text-stone-800"}`}>मराठी</button>
      <button name="lang" value="hi" className={`px-3 py-1 ${lang === "hi" ? "bg-brand-600 text-white" : "bg-white text-stone-800"}`}>हिंदी</button>
    </form>
  );
}
