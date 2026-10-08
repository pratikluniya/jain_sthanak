// Individual membership application (सभासद अर्ज): what is read from the 2-page form.
// Read by Claude in the app (if an AI key is set) or in a Cowork batch; ALWAYS checked by a volunteer before saving.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-5";

const Person = z.object({
  name: z.string().default(""),
  address: z.string().default(""),
  mobile: z.string().default(""),
  landline: z.string().default(""),
});

export const DOC_CODES = ["AADHAAR", "RATION_CARD", "OTHER_CARD", "PASSPORT", "ELECTRICITY_BILL", "PHONE_BILL", "PAN", "DRIVING_LICENCE"] as const;

export const ExtractedApplication = z.object({
  appNo: z.string().default(""),
  appDate: z.string().default(""), // as written, e.g. 12/05/2019
  nameRaw: z.string().default(""), // exactly as written (often surname first)
  title: z.string().default(""),
  firstName: z.string().default(""),
  middleName: z.string().default(""), // husband's or father's name
  surname: z.string().default(""),
  firstNameEn: z.string().default(""),
  middleNameEn: z.string().default(""),
  surnameEn: z.string().default(""),
  gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]).default("UNKNOWN"),
  homeAddress: z.string().default(""),
  businessAddress: z.string().default(""),
  mobile: z.string().default(""),
  landline: z.string().default(""),
  email: z.string().default(""),
  dob: z.string().default(""), // as written
  age: z.string().default(""),
  occupation: z.string().default(""),
  feeEntry: z.string().default(""),
  feeAnnual: z.string().default(""),
  feeLifetime: z.string().default(""),
  feeTotal: z.string().default(""),
  receiptNo: z.string().default(""),
  receiptDate: z.string().default(""),
  proposer: Person.default({}),
  seconder: Person.default({}),
  decision: z.enum(["APPROVED", "REJECTED", "BLANK"]).default("BLANK"),
  meetingDate: z.string().default(""),
  rejectReasons: z.string().default(""),
  docs: z.array(z.enum(DOC_CODES)).default([]),
  notes: z.string().default(""),
  uncertainFields: z.array(z.string()).default([]),
  // set by the batch import: the applicant's photo cropped from the form (bucket "forms")
  photoKey: z.string().optional(),
});
export type ExtractedApplication = z.infer<typeof ExtractedApplication>;

export const EMPTY_APPLICATION: ExtractedApplication = ExtractedApplication.parse({});

const SYSTEM = `You read handwritten individual membership application forms (सभासद अर्ज) of "श्री जैन स्थानकवासी श्रावक संघ, नाशिकरोड".
The form has 2 pages (front and back). Handwriting is Marathi or Hindi in Devanagari, sometimes English. Photos may be rotated.

Front: नंबर (application no.), दिनांक (date), applicant photo, नांव (name, usually SURNAME FIRST, e.g. "चोरडिया प्रिया अमित"),
home address, business address, mobile, landline (फोन), date of birth, age, email,
fees: प्रवेश फी, वार्षिक सभासद फी, अजीवन सभासद फी, एकूण, पावती क्र. and its date.
Back: सूचक सभासद (proposer) and अनुमोदक सभासद (seconder): name, address, mobile, landline;
office section: application date, approved (मंजूर) or rejected (नामंजूर) at the कार्यकारणी meeting held on a date, reasons 1-3, signatures (ignore);
documents ticked: residence proof (आधार कार्ड, रेशन कार्ड, other card, पासपोर्ट, वीज बिल, फोन बिल) and ID (पॅन कार्ड, ड्रायव्हिंग लायसन्स).

Rules:
- Copy text EXACTLY as written in Devanagari; do not translate or correct spellings. Copy digits as written.
- Names written in ENGLISH letters: give nameRaw and the name parts in Devanagari (as the family would spell it in Marathi), and the English as written in the *En fields.
- Split the name: title (सौ., श्री, कु., श्रीमती...), firstName, middleName (husband's or father's name), surname. Remember the surname is usually written first.
- Also give the English spelling of each name part (firstNameEn, middleNameEn, surnameEn) as Marathi Jain families usually spell them.
- gender from the title or name if clear, else UNKNOWN.
- decision: APPROVED only if the office section clearly says approved (मंजूर); REJECTED if rejected; otherwise BLANK. Never guess.
- docs: only documents that are ticked or marked. Codes: AADHAAR, RATION_CARD, OTHER_CARD, PASSPORT, ELECTRICITY_BILL, PHONE_BILL, PAN, DRIVING_LICENCE.
- Empty fields or a dash: "".
- uncertainFields: names of fields that are hard to read. notes: anything a volunteer should check.`;

const str = { type: "string" } as const;
const person = { type: "object", properties: { name: str, address: str, mobile: str, landline: str }, required: ["name", "address", "mobile", "landline"] } as const;
const FIELDS = [
  "appNo", "appDate", "nameRaw", "title", "firstName", "middleName", "surname", "firstNameEn", "middleNameEn", "surnameEn",
  "homeAddress", "businessAddress", "mobile", "landline", "email", "dob", "age", "occupation",
  "feeEntry", "feeAnnual", "feeLifetime", "feeTotal", "receiptNo", "receiptDate", "meetingDate", "rejectReasons", "notes",
] as const;

const TOOL: Anthropic.Tool = {
  name: "save_application",
  description: "Save the data read from one membership application (both pages).",
  input_schema: {
    type: "object",
    properties: {
      ...Object.fromEntries(FIELDS.map((f) => [f, str])),
      gender: { type: "string", enum: ["MALE", "FEMALE", "UNKNOWN"] },
      decision: { type: "string", enum: ["APPROVED", "REJECTED", "BLANK"] },
      proposer: person,
      seconder: person,
      docs: { type: "array", items: { type: "string", enum: [...DOC_CODES] } },
      uncertainFields: { type: "array", items: str },
    },
    required: [...FIELDS, "gender", "decision", "proposer", "seconder", "docs", "uncertainFields"],
  },
};

export async function extractApplication(images: { base64: string; mediaType: "image/jpeg" }[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "save_application" },
    messages: [
      {
        role: "user",
        content: [
          ...images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 } })),
          { type: "text" as const, text: images.length > 1 ? `These ${images.length} images are the pages of ONE application, in order.` : "Read this application." },
        ],
      },
    ],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("AI did not return application data");
  return { data: ExtractedApplication.parse(block.input), inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
}

/** "12/05/2019", "१२-५-२०१९", "2019-05-12" -> "2019-05-12" (or "" if not a full valid date). */
export function parseFormDate(raw: string): string {
  const s = (raw ?? "").replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d))).trim();
  let y: number, m: number, d: number;
  let r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (r) [y, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = s.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{2,4})$/))) {
    [d, m, y] = [+r[1], +r[2], +r[3]];
    if (y < 100) y += y > 50 ? 1900 : 2000;
  } else return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return "";
  return dt.toISOString().slice(0, 10);
}

/** "₹ ५०१/-" -> 501; empty or unreadable -> null */
export function parseRupees(raw: string): number | null {
  const s = (raw ?? "").replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d))).replace(/[,\s]/g, "");
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : null;
}
