// Relation to head of family. Forms use many Marathi / Hindi spellings for the
// same relation, so we map everything to a fixed code and show a label in the
// selected UI language.

export type Gender = "MALE" | "FEMALE" | "UNKNOWN";

export interface RelationDef {
  code: string;
  mr: string;
  hi: string;
  en: string;
  gender: Gender;
  aliases: string[]; // spellings seen on forms (normalised before matching)
}

export const RELATIONS: RelationDef[] = [
  { code: "SELF", mr: "स्वतः", hi: "स्वयं", en: "Self", gender: "UNKNOWN", aliases: ["स्वतः", "स्वत", "स्वयं", "स्वय", "खुद", "प्रमुख", "self"] },
  { code: "WIFE", mr: "पत्नी", hi: "पत्नी", en: "Wife", gender: "FEMALE", aliases: ["पत्नी", "बायको", "भार्या", "धर्मपत्नी", "wife"] },
  { code: "HUSBAND", mr: "पती", hi: "पति", en: "Husband", gender: "MALE", aliases: ["पती", "पति", "नवरा", "husband"] },
  { code: "SON", mr: "मुलगा", hi: "बेटा", en: "Son", gender: "MALE", aliases: ["मुलगा", "बेटा", "पुत्र", "मुलगे", "son"] },
  { code: "DAUGHTER", mr: "मुलगी", hi: "बेटी", en: "Daughter", gender: "FEMALE", aliases: ["मुलगी", "बेटी", "पुत्री", "कन्या", "daughter"] },
  { code: "DAUGHTER_IN_LAW", mr: "सून", hi: "बहू", en: "Daughter-in-law", gender: "FEMALE", aliases: ["सून", "सुन", "बहू", "बहु", "पुत्रवधू", "daughter in law"] },
  { code: "SON_IN_LAW", mr: "जावई", hi: "दामाद", en: "Son-in-law", gender: "MALE", aliases: ["जावई", "दामाद", "जमाई", "son in law"] },
  { code: "GRANDSON", mr: "नातू", hi: "पोता", en: "Grandson", gender: "MALE", aliases: ["नातू", "नातु", "पोता", "पौत्र", "grandson"] },
  { code: "GRANDDAUGHTER", mr: "नात", hi: "पोती", en: "Granddaughter", gender: "FEMALE", aliases: ["नात", "पोती", "पौत्री", "granddaughter"] },
  { code: "GRANDDAUGHTER_IN_LAW", mr: "नातसून", hi: "पोतबहू", en: "Granddaughter-in-law", gender: "FEMALE", aliases: ["नातसून", "नातसुन", "पोतबहू", "पोत बहू"] },
  { code: "FATHER", mr: "वडील", hi: "पिता", en: "Father", gender: "MALE", aliases: ["वडील", "वडिल", "पिता", "पापा", "बाबा", "पिताजी", "father"] },
  { code: "MOTHER", mr: "आई", hi: "माता", en: "Mother", gender: "FEMALE", aliases: ["आई", "माता", "मां", "माँ", "मम्मी", "मातोश्री", "mother"] },
  { code: "BROTHER", mr: "भाऊ", hi: "भाई", en: "Brother", gender: "MALE", aliases: ["भाऊ", "भाई", "बंधू", "बंधु", "brother"] },
  { code: "SISTER", mr: "बहीण", hi: "बहन", en: "Sister", gender: "FEMALE", aliases: ["बहीण", "बहिण", "बहन", "sister"] },
  { code: "SISTER_IN_LAW", mr: "वहिनी", hi: "भाभी", en: "Sister-in-law", gender: "FEMALE", aliases: ["वहिनी", "भाभी", "भावजय", "sister in law"] },
  { code: "NEPHEW", mr: "पुतण्या", hi: "भतीजा", en: "Nephew", gender: "MALE", aliases: ["पुतण्या", "भतीजा", "भाचा", "भांजा", "nephew"] },
  { code: "NIECE", mr: "पुतणी", hi: "भतीजी", en: "Niece", gender: "FEMALE", aliases: ["पुतणी", "भतीजी", "भाची", "भांजी", "niece"] },
  { code: "OTHER", mr: "इतर", hi: "अन्य", en: "Other", gender: "UNKNOWN", aliases: ["इतर", "अन्य", "other"] },
];

const BY_CODE = new Map(RELATIONS.map((r) => [r.code, r]));

function clean(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[.।॥,:;!'"()\-]/g, " ") // punctuation, danda
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const ALIAS_MAP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const r of RELATIONS) for (const a of r.aliases) m.set(clean(a), r.code);
  return m;
})();

/** Map a handwritten relation ("बायको", "सून", "नातू") to a relation code. */
export function relationFromRaw(raw: string): string {
  const c = clean(raw || "");
  if (!c) return "OTHER";
  if (ALIAS_MAP.has(c)) return ALIAS_MAP.get(c)!;
  // try each word, e.g. "मोठा मुलगा"
  for (const w of c.split(" ")) if (ALIAS_MAP.has(w)) return ALIAS_MAP.get(w)!;
  return "OTHER";
}

export function relationLabel(code: string, lang: "mr" | "hi" | "en"): string {
  const r = BY_CODE.get(code) ?? BY_CODE.get("OTHER")!;
  return r[lang];
}

export function genderFromRelation(code: string): Gender {
  return BY_CODE.get(code)?.gender ?? "UNKNOWN";
}

/** Guess gender from title when relation does not tell us (e.g. head of family). */
export function genderFromTitle(title: string): Gender {
  const t = clean(title);
  if (["सौ", "कु", "श्रीमती", "सौभाग्यवती", "कुमारी", "सुश्री"].includes(t)) return "FEMALE";
  if (["श्री", "चि", "चिरंजीव"].includes(t)) return "MALE";
  return "UNKNOWN";
}
