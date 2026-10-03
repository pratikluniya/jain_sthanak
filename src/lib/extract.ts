// Reads a photographed census form with Claude (vision) and returns structured
// data. The result is ALWAYS shown to a volunteer for checking before it is saved.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// [Unverified] model id: confirm the current Sonnet model id in the Anthropic console.
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-5";

export const ExtractedMember = z.object({
  serial: z.number().int(),
  nameRaw: z.string(),
  nameEn: z.string().optional(), // English spelling, e.g. "Sau. Nirmalabai Kachardasji Chordiya"
  age: z.string(),
  relationRaw: z.string(),
  education: z.string(),
  occupation: z.string(),
  mobile: z.string(),
  bloodGroup: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  uncertainFields: z.array(z.string()),
});

// KYC document attached to a form at bulk import. The ID number is NEVER stored in
// plain text here: import encrypts it (enc) and keeps only the last 4 digits.
export const ImportedKyc = z.object({
  fileKey: z.string(),
  docType: z.enum(["AADHAAR", "PAN", "VOTER_ID", "OTHER"]),
  holderName: z.string(),
  memberSerial: z.number().int().nullable(),
  enc: z.string().nullable(),
  last4: z.string().nullable(),
  dob: z.string().nullable(), // YYYY-MM-DD when the document shows a full date of birth
  notes: z.string(),
});
export type ImportedKyc = z.infer<typeof ImportedKyc>;

export const ExtractedForm = z.object({
  headName: z.string(),
  headNameEn: z.string().optional(),
  address: z.string(),
  panth: z.enum(["STHANAKVASI", "MANDIRMARGI", "TERAPANTH", "DIGAMBAR", "BLANK"]),
  panthEvidence: z.string(),
  continuesOnNextPage: z.boolean(),
  isContinuationPage: z.boolean(),
  members: z.array(ExtractedMember),
  notes: z.string(),
  kyc: z.array(ImportedKyc).optional(),
});
export type ExtractedForm = z.infer<typeof ExtractedForm>;

const SYSTEM = `You read handwritten census forms of "श्री जैन स्थानकवासी श्रावक संघ, नाशिकरोड" (जनगणना 2026).
The printed form is in Hindi. Handwriting is Marathi or Hindi in Devanagari, sometimes English.
Photos are taken on a phone: often rotated 90 degrees, at an angle, with other pages or cloth in the background. Read only the main form.

Form layout:
- कुटुंब प्रमुख का नाम (head of family name) on a dotted line at the top
- रहिवास का संपूर्ण पता (full address) on the next dotted line
- पंथ: स्थानकवासी / मंदिरमार्गी / तेरापंथ / दिगंबर. The family marks one by tick, circle or underline. Very often nothing is marked.
- A table with 6 rows. Columns: अनु क्र. | सदस्य का पूरा नाम | उम्र | कुटुंब प्रमुख से नाता | शिक्षण | व्यवसाय/नोकरी कहा पर | मोबाईल नंबर | ब्लड ग्रुप
- Printed rules and a signature at the bottom: ignore them.
- A note like "continue on 2nd page" means the family continues on another sheet.

Rules:
- Copy names EXACTLY as written, in Devanagari, including titles like सौ., कु., श्रीमती and the suffix जी. Do not translate or "correct" spellings.
- ALSO give each name in English letters (nameEn, headNameEn), the way Marathi Jain families usually spell it:
  title + first + middle + surname in the same order and word count as the Devanagari, e.g. "सौ. निर्मलाबाई कचरदासजी चोरडिया" -> "Sau. Nirmalabai Kachardasji Chordiya", "प्रविणकुमार लुणिया" -> "Pravinkumar Luniya". Do not add or drop words.
- Digits may be Devanagari (०-९) or English. Copy them as written; do not convert.
- Keep relation words as written (बायको, सून, नातू, पोती, मम्मी, भाई, भाभी, स्वतः, स्वयं...).
- Education and occupation: copy as written (may be English like "B.Com", "Kirana").
- Empty cells or a dash: use "".
- Skip empty table rows.
- panth: if the mark is unclear or absent, use "BLANK" and explain in panthEvidence. Never guess a panth.
- confidence per member: "low" if any part of the name or mobile number is hard to read. List the unclear field names in uncertainFields (use: name, age, relation, education, occupation, mobile, bloodGroup).
- Mobile numbers: if a digit is unclear, write your best reading and add "mobile" to uncertainFields.
- notes: anything a volunteer should check (crossed-out text, extra writing, marks like "2" or tick marks).`;

const TOOL: Anthropic.Tool = {
  name: "save_form",
  description: "Save the data read from one census form image.",
  input_schema: {
    type: "object",
    properties: {
      headName: { type: "string" },
      headNameEn: { type: "string", description: "headName in English letters" },
      address: { type: "string" },
      panth: { type: "string", enum: ["STHANAKVASI", "MANDIRMARGI", "TERAPANTH", "DIGAMBAR", "BLANK"] },
      panthEvidence: { type: "string" },
      continuesOnNextPage: { type: "boolean" },
      isContinuationPage: { type: "boolean", description: "True if this sheet is a 2nd page of a family without its own header" },
      members: {
        type: "array",
        items: {
          type: "object",
          properties: {
            serial: { type: "integer" },
            nameRaw: { type: "string" },
            nameEn: { type: "string", description: "nameRaw in English letters, same words" },
            age: { type: "string" },
            relationRaw: { type: "string" },
            education: { type: "string" },
            occupation: { type: "string" },
            mobile: { type: "string" },
            bloodGroup: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            uncertainFields: { type: "array", items: { type: "string" } },
          },
          required: ["serial", "nameRaw", "nameEn", "age", "relationRaw", "education", "occupation", "mobile", "bloodGroup", "confidence", "uncertainFields"],
        },
      },
      notes: { type: "string" },
    },
    required: ["headName", "headNameEn", "address", "panth", "panthEvidence", "continuesOnNextPage", "isContinuationPage", "members", "notes"],
  },
};

export interface ExtractResult {
  data: ExtractedForm;
  inputTokens: number;
  outputTokens: number;
}

export async function extractForm(images: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }[]): Promise<ExtractResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic({ apiKey });

  const content: Anthropic.MessageParam["content"] = [
    ...images.map((img) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
    })),
    {
      type: "text" as const,
      text:
        images.length > 1
          ? `These ${images.length} images are pages of ONE family's form, in order. Combine all members into one list, numbering serial continuously.`
          : "Read this form.",
    },
  ];

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "save_form" },
    messages: [{ role: "user", content }],
  });

  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("AI did not return form data");
  const data = ExtractedForm.parse(block.input);
  return { data, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
}
