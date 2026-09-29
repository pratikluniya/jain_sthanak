// Bulk import of forms read outside the app (e.g. by Claude in a Cowork session).
// Each form becomes a pending upload ("EXTRACTED") that a volunteer must check and save,
// exactly like a form read inside the app. Nothing goes into families without a human check.
//
// Usage:  npx tsx scripts/import-forms.ts <folder>
// <folder> contains forms.json and the photos it names:
//   [{
//     "images": ["F1.jpg"],
//     "kyc": [{ "image": "F1_1.jpg", "docType": "AADHAAR", "holderName": "...", "memberSerial": 1,
//               "number": "123412341234", "dob": "1975-06-17", "notes": "" }],
//     "form": { ...ExtractedForm without kyc }
//   }, ...]
// KYC numbers are encrypted before they reach the database; the scan goes to the private "kyc" bucket.
// Only Aadhaar numbers are stored (encrypted). For PAN or other IDs only the scan is kept.
import { readFileSync, existsSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { ExtractedForm, type ImportedKyc } from "../src/lib/extract";
import { putFile } from "../src/lib/storage";
import { cleanAadhaar, encrypt } from "../src/lib/crypto";

const prisma = new PrismaClient();

interface RawKyc {
  image: string;
  docType: ImportedKyc["docType"];
  holderName: string;
  memberSerial: number | null;
  number?: string;
  dob?: string | null;
  notes?: string;
}

async function main() {
  const dir = process.argv[2];
  if (!dir || !existsSync(path.join(dir, "forms.json"))) throw new Error("usage: import-forms.ts <folder with forms.json>");
  const items = JSON.parse(readFileSync(path.join(dir, "forms.json"), "utf8")) as { images: string[]; kyc?: RawKyc[]; form: unknown }[];
  const batch = path.basename(path.resolve(dir));
  let done = 0;
  let skipped = 0;
  for (const it of items) {
    const tag = `${batch}/${it.images.join("+")}`;
    if (await prisma.formUpload.findFirst({ where: { uploadedBy: `import:${tag}` } })) {
      skipped++;
      continue;
    }
    const keys: string[] = [];
    for (const img of it.images) {
      const key = `import/${batch}/${img}`;
      await putFile("forms", key, readFileSync(path.join(dir, img)), "image/jpeg");
      keys.push(key);
    }
    const kyc: ImportedKyc[] = [];
    for (const k of it.kyc ?? []) {
      const fileKey = `import/${batch}/${k.image}`;
      await putFile("kyc", fileKey, readFileSync(path.join(dir, k.image)), "image/jpeg");
      const aadhaar = k.docType === "AADHAAR" && k.number ? cleanAadhaar(k.number) : null;
      if (k.docType === "AADHAAR" && k.number && !aadhaar) console.warn(`  ! ${k.image}: Aadhaar number not valid, skipped`);
      kyc.push({
        fileKey,
        docType: k.docType,
        holderName: k.holderName,
        memberSerial: k.memberSerial,
        enc: aadhaar ? encrypt(aadhaar) : null,
        last4: aadhaar ? aadhaar.slice(-4) : null,
        dob: k.dob ?? null,
        notes: k.notes ?? "",
      });
    }
    const form = ExtractedForm.parse({ ...(it.form as object), kyc });
    await prisma.formUpload.create({ data: { imageKeys: keys, status: "EXTRACTED", extracted: form as object, uploadedBy: `import:${tag}` } });
    done++;
    console.log(`${tag}: ${form.headName} (${form.members.length} members, ${kyc.length} KYC)`);
  }
  console.log(`imported ${done}, already there ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
