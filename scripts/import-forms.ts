// Bulk import of forms read outside the app (e.g. by Claude in a Cowork session).
// Each form becomes a pending upload ("EXTRACTED") that a volunteer must check and save,
// exactly like a form read inside the app. Nothing goes into families without a human check.
//
// Usage:  npx tsx scripts/import-forms.ts <folder>
// <folder> contains forms.json and the photos it names:
//   [{ "images": ["012_a.jpg", "012_b.jpg"], "form": { ...ExtractedForm } }, ...]
import { readFileSync, existsSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { ExtractedForm } from "../src/lib/extract";
import { putFile } from "../src/lib/storage";

const prisma = new PrismaClient();

async function main() {
  const dir = process.argv[2];
  if (!dir || !existsSync(path.join(dir, "forms.json"))) throw new Error("usage: import-forms.ts <folder with forms.json>");
  const items = JSON.parse(readFileSync(path.join(dir, "forms.json"), "utf8")) as { images: string[]; form: unknown; source?: string }[];
  let done = 0;
  let skipped = 0;
  for (const it of items) {
    const form = ExtractedForm.parse(it.form);
    const tag = it.images.join("+");
    // skip if this photo was already imported
    const exists = await prisma.formUpload.findFirst({ where: { uploadedBy: `import:${tag}` } });
    if (exists) {
      skipped++;
      continue;
    }
    const keys: string[] = [];
    for (const img of it.images) {
      const key = `import/${img}`;
      await putFile("forms", key, readFileSync(path.join(dir, img)), "image/jpeg");
      keys.push(key);
    }
    await prisma.formUpload.create({ data: { imageKeys: keys, status: "EXTRACTED", extracted: form as object, uploadedBy: `import:${tag}` } });
    done++;
    console.log(`${tag}: ${form.headName} (${form.members.length})`);
  }
  console.log(`imported ${done}, already there ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
