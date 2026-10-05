"use client";
import { useFormState, useFormStatus } from "react-dom";
import { changeOwnPassword, updateOwnName, type FormResult } from "./actions";

type Msgs = Record<"save" | "saved" | "name" | "nameRequired" | "wrongPassword" | "passwordTooShort" | "passwordMismatch" | "passwordChanged" | "currentPassword" | "newPassword" | "confirmPassword" | "changePassword", string>;

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "..." : label}</button>;
}

function Message({ state, t, okText }: { state: FormResult; t: Msgs; okText: string }) {
  if (state.error) return <p className="text-sm text-red-600" role="alert">{t[state.error]}</p>;
  if (state.ok) return <p className="text-sm text-green-700" role="status">✔ {okText}</p>;
  return null;
}

export function NameForm({ name, t }: { name: string; t: Msgs }) {
  const [state, action] = useFormState(updateOwnName, {});
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="name" className="label">{t.name}</label>
        <input id="name" name="name" className="input" defaultValue={name} required maxLength={80} />
      </div>
      <div className="flex items-center gap-3">
        <Submit label={t.save} />
        <Message state={state} t={t} okText={t.saved} />
      </div>
    </form>
  );
}

export function PasswordForm({ t }: { t: Msgs }) {
  const [state, action] = useFormState(changeOwnPassword, {});
  return (
    <form action={action} className="space-y-3" key={state.ok ? "done" : "form"}>
      <div>
        <label htmlFor="current" className="label">{t.currentPassword}</label>
        <input id="current" name="current" type="password" className="input" autoComplete="current-password" required />
      </div>
      <div>
        <label htmlFor="next" className="label">{t.newPassword}</label>
        <input id="next" name="next" type="password" className="input" autoComplete="new-password" required minLength={8} />
      </div>
      <div>
        <label htmlFor="confirm" className="label">{t.confirmPassword}</label>
        <input id="confirm" name="confirm" type="password" className="input" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="flex items-center gap-3">
        <Submit label={t.changePassword} />
        <Message state={state} t={t} okText={t.passwordChanged} />
      </div>
    </form>
  );
}
