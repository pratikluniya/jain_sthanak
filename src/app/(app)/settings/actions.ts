"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { setSetting } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { findSetting } from "./meta";

export async function saveSetting(fd: FormData) {
  const s = await requireSession("settings");
  const def = findSetting(String(fd.get("key")));
  if (!def) redirect("/settings");
  const raw = String(fd.get("value") ?? "").trim();
  let value: string;
  switch (def.kind) {
    case "date":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) redirect(`/settings/${def.key}?e=1`);
      value = raw;
      break;
    case "dateOptional":
      if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) redirect(`/settings/${def.key}?e=1`);
      value = raw;
      break;
    case "onOff":
      value = fd.get("value") === "on" ? "true" : "false";
      break;
    case "lines":
      value = JSON.stringify(raw.split("\n").map((x) => x.trim()).filter(Boolean));
      break;
    default:
      value = raw;
  }
  await setSetting(def.key, value);
  await audit(s.uid, "update", "Settings", def.key, { [def.key]: value });
  revalidatePath("/", "layout");
  redirect("/settings");
}
