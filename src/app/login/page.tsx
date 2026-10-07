import { getDict } from "@/lib/i18n";
import LoginForm from "./LoginForm";
import LangToggle from "@/components/LangToggle";

export default function LoginPage() {
  const t = getDict();
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-brand-50 via-stone-50 to-stone-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="mx-auto mb-3 h-28 w-auto" />
          <p className="text-xs text-brand-700">॥ श्री महावीराय नमः ॥</p>
          <h1 className="font-heading text-xl font-bold leading-snug text-brand-900">{t.sangh}</h1>
          <p className="text-stone-600">{t.appName}</p>
        </div>
        <div className="card overflow-hidden">
          <div className="jain-stripe" />
          <div className="p-6">
          <LoginForm t={{ mobile: t.mobile, password: t.password, login: t.login, loginFailed: t.loginFailed }} />
          </div>
        </div>
        <div className="mt-4 flex justify-center"><LangToggle /></div>
      </div>
    </main>
  );
}
