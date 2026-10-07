import type { Dict } from "@/lib/i18n";
import { ROLES } from "@/lib/rbac";

export const userFormLabels = (t: Dict) => ({
  name: t.name, mobile: t.mobile, role: t.role, password: t.password, passwordOptional: t.passwordOptional, save: t.save, cancel: t.cancel,
  canLogin: t.canLogin, userActiveHelp: t.userActiveHelp, nameRequired: t.nameRequired, mobileInvalid: t.mobileInvalid, mobileExists: t.mobileExists,
  mobileOfDeletedUser: t.mobileOfDeletedUser, passwordTooShort: t.passwordTooShort, cannotChangeSelf: t.cannotChangeSelf,
});

export const roleOptions = (t: Dict) => ROLES.map((r) => ({ value: r, label: t[r] }));
