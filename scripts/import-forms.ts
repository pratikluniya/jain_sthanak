// Bulk import from a folder on this computer (development, or a machine that can reach the database).
// On the AWS server use the Admin page "Import batch" (/upload/import) instead.
//
// Usage:  npm run import:forms -- <folder>
// <folder> contains forms.json and the photos it names:
//   [{
//     "images": ["F1.jpg"],
//     "kyc": [{ "image": "F1_1.jpg", "docType": "AADHAAR", "holderName": "...", "memberSerial": 1,
//               "number": "123412341234", "dob": "1975-06-17", "notes": "" }],
//     "form": { ...ExtractedForm without kyc }
//   }, ...]
import { readFileSync, existsSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { importItem, type BatchItem } from "../src/lib/importBatch";

const prisma = new PrismaClient();

async function main() {
  const dir = process.argv[2];
  if (!dir || !existsSync(path.join(dir, "forms.json"))) throw new Error("usage: import-forms.ts <folder with forms.json>");
  const items = JSON.parse(readFileSync(path.join(dir, "forms.json"), "utf8")) as BatchItem[];
  const batch = path.basename(path.resolve(dir));
  let done = 0;
  let skipped = 0;
  for (const it of items) {
    const r = await importItem(prisma, batch, it, async (name) => readFileSync(path.join(dir, name)));
    if (r.status === "skipped") {
      skipped++;
      continue;
    }
    done++;
    console.log(`${batch}/${it.images.join("+")}: ${r.headName} (${r.members} members, ${r.kyc} KYC)`);
    r.warnings.forEach((w) => console.warn(`  ! ${w}`));
  }
  console.log(`imported ${done}, already there ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
