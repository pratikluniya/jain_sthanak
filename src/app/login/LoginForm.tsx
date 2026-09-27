"use client";
import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary w-full py-3" disabled={pending}>{pending ? "..." : label}</button>;
}

export default function LoginForm({ t }: { t: { mobile: string; password: string; login: string; loginFailed: string } }) {
  const [state, action] = useFormState(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="mobile">{t.mobile}</label>
        <input id="mobile" name="mobile" inputMode="numeric" autoComplete="username" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="password">{t.password}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="input" required />
      </div>
      {state?.error && <p className="text-sm text-red-600">{t.loginFailed}</p>}
      <Submit label={t.login} />
    </form>
  );
}
