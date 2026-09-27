import { getDict } from "@/lib/i18n";
import LoginForm from "./LoginForm";
import LangToggle from "@/components/LangToggle";

export default function LoginPage() {
  const t = getDict();
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-brand-50 to-stone-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-brand-600 text-white flex items-center justify-center text-2xl font-bold">जै</div>
          <h1 className="text-lg font-bold text-brand-900">{t.sangh}</h1>
          <p className="text-stone-600">{t.appName}</p>
        </div>
        <div className="card p-6">
          <LoginForm t={{ mobile: t.mobile, password: t.password, login: t.login, loginFailed: t.loginFailed }} />
        </div>
        <div className="mt-4 flex justify-center"><LangToggle /></div>
      </div>
    </main>
  );
}
