// Import of forms read outside the app (e.g. by Claude in a Cowork session), one form at a time.
// Each form becomes a pending upload ("EXTRACTED") that a volunteer must check and save,
// exactly like a form read inside the app. Nothing goes into families without a human check.
// Used by the Admin "Import batch" page (/upload/import) and by scripts/import-forms.ts.
import type { PrismaClient } from "@prisma/client";
import { ExtractedForm, type ImportedKyc } from "./extract";
import { ExtractedApplication } from "./applicationForm";
import { putFile } from "./storage";
import { cleanAadhaar, encrypt } from "./crypto";

export interface RawKyc {
  image: string;
  docType: ImportedKyc["docType"];
  holderName: string;
  memberSerial: number | null;
  number?: string; // plain Aadhaar number: encrypted here, never stored as typed
  dob?: string | null;
  notes?: string;
}

export interface BatchItem {
  /** "family" (census form, default) or "individual" (सभासद अर्ज: A1.jpg + A1_2.jpg, photo A1_photo.jpg) */
  kind?: "family" | "individual";
  images: string[];
  /** individual only: applicant photo cropped from the form */
  photo?: string;
  kyc?: RawKyc[];
  form: unknown;
}

export type ImportResult = { status: "imported"; headName: string; members: number; kyc: number; warnings: string[] } | { status: "skipped" };

const SAFE = /^[A-Za-z0-9._-]+$/;

export async function importItem(
  prisma: PrismaClient,
  batch: string,
  item: BatchItem,
  readFile: (name: string) => Promise<Buffer>,
): Promise<ImportResult> {
  if (!SAFE.test(batch)) throw new Error("batch name: use letters, digits, - and _ only");
  for (const n of [...item.images, ...(item.kyc ?? []).map((k) => k.image), ...(item.photo ? [item.photo] : [])]) if (!SAFE.test(n)) throw new Error(`bad file name: ${n}`);

  const tag = `${batch}/${item.images.join("+")}`;
  if (await prisma.formUpload.findFirst({ where: { uploadedBy: `import:${tag}` } })) return { status: "skipped" };

  const keys: string[] = [];
  for (const img of item.images) {
    const key = `import/${batch}/${img}`;
    await putFile("forms", key, await readFile(img), "image/jpeg");
    keys.push(key);
  }
  if (item.kind === "individual") {
    let photoKey: string | undefined;
    if (item.photo) {
      photoKey = `import/${batch}/${item.photo}`;
      await putFile("forms", photoKey, await readFile(item.photo), "image/jpeg");
    }
    const app = ExtractedApplication.parse({ ...(item.form as object), photoKey });
    await prisma.formUpload.create({ data: { kind: "INDIVIDUAL", imageKeys: keys, status: "EXTRACTED", extracted: app as object, uploadedBy: `import:${tag}` } });
    const name = [app.title, app.firstName, app.middleName, app.surname].filter(Boolean).join(" ") || app.nameRaw;
    return { status: "imported", headName: name, members: 1, kyc: 0, warnings: [] };
  }
  const warnings: string[] = [];
  const kyc: ImportedKyc[] = [];
  for (const k of item.kyc ?? []) {
    const fileKey = `import/${batch}/${k.image}`;
    await putFile("kyc", fileKey, await readFile(k.image), "image/jpeg");
    const aadhaar = k.docType === "AADHAAR" && k.number ? cleanAadhaar(k.number) : null;
    if (k.docType === "AADHAAR" && k.number && !aadhaar) warnings.push(`${k.image}: Aadhaar number not valid, skipped`);
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
  const form = ExtractedForm.parse({ ...(item.form as object), kyc });
  await prisma.formUpload.create({ data: { imageKeys: keys, status: "EXTRACTED", extracted: form as object, uploadedBy: `import:${tag}` } });
  return { status: "imported", headName: form.headName, members: form.members.length, kyc: kyc.length, warnings };
}
