"use client";
import { useFormState } from "react-dom";
import { createUser } from "./actions";

export default function NewUserForm({ roles, roleLabels, t }: { roles: string[]; roleLabels: Record<string, string>; t: Record<"name" | "mobile" | "password" | "role" | "add" | "save", string> }) {
  const [state, action] = useFormState(createUser, {});
  return (
    <form action={action} className="card p-3 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
      <input name="name" placeholder={t.name} className="input" required />
      <input name="mobile" placeholder={t.mobile} className="input" inputMode="numeric" required />
      <input name="password" type="password" placeholder={t.password} className="input" autoComplete="new-password" required minLength={8} />
      <select name="role" className="input" defaultValue="DATA_ENTRY">
        {roles.map((r) => <option key={r} value={r}>{roleLabels[r]}</option>)}
      </select>
      <button className="btn-primary">+ {t.add}</button>
      {state?.error && <p className="col-span-full text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="col-span-full text-sm text-green-700">✔</p>}
    </form>
  );
}
