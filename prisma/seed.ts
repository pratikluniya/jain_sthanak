// Usage:
//   SEED_ADMIN_MOBILE=98xxxxxxxx SEED_ADMIN_PASSWORD='...' npm run db:seed            -> creates the admin user
//   ... npm run db:seed -- --demo   -> also loads the sample forms from ./demo (not in Git)
import { toEnglishName } from "../src/lib/translit";
import { readFileSync, existsSync } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { inferHeadGender, prepareMember } from "../src/lib/members";
import { nextFamilyCode } from "../src/lib/counters";
import { putFile } from "../src/lib/storage";
import { normalizeMobile, splitName } from "../src/lib/normalize";
import type { ExtractedForm } from "../src/lib/extract";

const prisma = new PrismaClient();

async function upsertUser(name: string, mobile: string, password: string, role: "ADMIN" | "OPERATOR" | "DATA_ENTRY" | "VIEWER") {
  const m = normalizeMobile(mobile);
  if (!m.valid) throw new Error(`invalid mobile for ${name}`);
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({ where: { mobile: m.value }, create: { name, mobile: m.value, role, passwordHash }, update: { role, passwordHash, active: true } });
  console.log(`user ${role}: ${m.value}`);
}

async function main() {
  const adminMobile = process.env.SEED_ADMIN_MOBILE;
  const adminPass = process.env.SEED_ADMIN_PASSWORD;
  if (!adminMobile || !adminPass || adminPass.length < 8) throw new Error("Set SEED_ADMIN_MOBILE and SEED_ADMIN_PASSWORD (min 8 chars)");
  await upsertUser(process.env.SEED_ADMIN_NAME || "Admin", adminMobile, adminPass, "ADMIN");

  if (!process.argv.includes("--demo")) return;

  const demoPass = process.env.DEMO_PASSWORD || adminPass;
  await upsertUser("Demo Operator", "9000000001", demoPass, "OPERATOR");
  await upsertUser("Demo Volunteer", "9000000002", demoPass, "DATA_ENTRY");
  await upsertUser("Demo Viewer", "9000000003", demoPass, "VIEWER");

  const file = path.join(process.cwd(), "demo", "forms.json");
  if (!existsSync(file)) {
    console.log("no demo/forms.json, skipping demo families");
    return;
  }
  if ((await prisma.formUpload.count()) > 0) {
    console.log("uploads already exist, skipping demo families");
    return;
  }
  const items = JSON.parse(readFileSync(file, "utf8")) as { image: string; verify: boolean; form: ExtractedForm }[];
  const formDate = new Date("2026-09-15");
  for (const it of items) {
    const key = `demo/${it.image}`;
    await putFile("forms", key, readFileSync(path.join(process.cwd(), "demo", "images", it.image)), "image/jpeg");
    const up = await prisma.formUpload.create({
      data: { imageKeys: [key], status: "EXTRACTED", extracted: it.form as object, uploadedBy: "Demo", createdAt: formDate },
    });
    if (!it.verify) continue;
    const f = it.form;
    const panth = f.panth === "BLANK" ? "UNKNOWN" : f.panth;
    const fam = await prisma.$transaction(async (tx) => {
      const code = await nextFamilyCode(tx);
      return tx.family.create({
        data: { code, headName: f.headName, headNameEn: toEnglishName(f.headName), address: f.address, panth, panthStatus: panth === "UNKNOWN" ? "TO_VERIFY" : "CONFIRMED", notes: f.notes, formDate },
      });
    });
    for (const m of f.members) {
      const n = splitName(m.nameRaw);
      const data = prepareMember({ ...m, ...n, serial: m.serial }, fam.code, formDate);
      data.nameRaw = m.nameRaw;
      await prisma.member.create({ data: { ...data, familyId: fam.id } });
    }
    await inferHeadGender(fam.id, prisma);
    await prisma.formUpload.update({ where: { id: up.id }, data: { status: "VERIFIED", familyId: fam.id, verifiedBy: "Demo" } });
    console.log(`family ${fam.code} ${fam.headName}: ${f.members.length} members`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
