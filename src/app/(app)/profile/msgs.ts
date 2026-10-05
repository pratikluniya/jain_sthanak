import type { Dict } from "@/lib/i18n";

export const profileMsgs = (t: Dict) => ({
  save: t.save, saved: t.saved, name: t.name, nameRequired: t.nameRequired, wrongPassword: t.wrongPassword,
  passwordTooShort: t.passwordTooShort, passwordMismatch: t.passwordMismatch, passwordChanged: t.passwordChanged,
  currentPassword: t.currentPassword, newPassword: t.newPassword, confirmPassword: t.confirmPassword, changePassword: t.changePassword,
});
