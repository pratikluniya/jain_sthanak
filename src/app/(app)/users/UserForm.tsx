"use client";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { createUser, updateUser, type UserFormResult } from "./actions";

type Labels = Record<
  "name" | "mobile" | "role" | "password" | "passwordOptional" | "save" | "cancel" | "canLogin" | "userActiveHelp" | NonNullable<UserFormResult["error"]>,
  string
>;

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button className="btn-primary" disabled={pending}>{pending ? "..." : label}</button>;
}

export default function UserForm(props: {
  user?: { id: string; name: string; mobile: string; role: string; active: boolean };
  roles: { value: string; label: string }[];
  t: Labels;
}) {
  const [state, action] = useFormState(props.user ? updateUser : createUser, {});
  const u = props.user;
  return (
    <form action={action} className="card space-y-4 p-4">
      {u && <input type="hidden" name="id" value={u.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">{props.t.name}</label>
          <input id="name" name="name" className="input" defaultValue={u?.name} required maxLength={80} />
        </div>
        <div>
          <label htmlFor="mobile" className="label">{props.t.mobile}</label>
          <input id="mobile" name="mobile" className="input" inputMode="numeric" defaultValue={u?.mobile} required />
        </div>
        <div>
          <label htmlFor="role" className="label">{props.t.role}</label>
          <select id="role" name="role" className="input" defaultValue={u?.role ?? "DATA_ENTRY"}>
            {props.roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="password" className="label">{u ? props.t.passwordOptional : props.t.password}</label>
          <input id="password" name="password" type="password" className="input" autoComplete="new-password" minLength={8} required={!u} />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={u ? u.active : true} className="mt-1" />
        <span>
          <span className="font-medium">{props.t.canLogin}</span>
          <span className="block text-xs text-stone-500">{props.t.userActiveHelp}</span>
        </span>
      </label>
      {state.error && <p className="text-sm text-red-600" role="alert">{props.t[state.error]}</p>}
      <div className="flex gap-2">
        <Submit label={props.t.save} />
        <Link href="/users" className="btn-secondary">{props.t.cancel}</Link>
      </div>
    </form>
  );
}
