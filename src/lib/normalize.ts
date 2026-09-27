// Cleaning rules for handwritten form data (Marathi / Hindi, mixed digits).

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

/** "९४२३१९३०६९" -> "9423193069". Leaves other characters alone. */
export function toEnglishDigits(s: string): string {
  return (s || "").replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

export interface MobileResult {
  value: string; // cleaned, 10 digits when valid
  valid: boolean;
}

/** Keep digits only, drop +91 / leading 0, check it looks like an Indian mobile. */
export function normalizeMobile(raw: string): MobileResult {
  let d = toEnglishDigits(raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return { value: d, valid: /^[6-9]\d{9}$/.test(d) };
}

/** "B+ve", "b +", "O-VE", "ओ पॉझिटिव्ह" -> "B+", "B+", "O-", "O+" */
export function normalizeBloodGroup(raw: string): string {
  let s = (raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!s || s === "-" || s === "—") return "";
  s = s
    .replace(/पॉझिटिव्ह|पॉजिटिव|POSITIVE|POS|\+VE|VE\+/g, "+")
    .replace(/निगेटिव्ह|नेगेटिव|NEGATIVE|NEG|-VE|VE-/g, "-")
    .replace(/^एबी|^ए बी/, "AB")
    .replace(/^बी/, "B")
    .replace(/^ए/, "A")
    .replace(/^ओ/, "O")
    .replace(/^0/, "O"); // zero written instead of letter O
  const m = s.match(/^(AB|A|B|O)([+-])/);
  return m ? m[1] + m[2] : "";
}

/** "४५", "45 वर्षे", "2 वर्ष" -> 45 / 2. Returns null if not a sensible age. */
export function parseAge(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const s = toEnglishDigits(String(raw));
  // "2 महिने", "6 months", "८ मास": babies under one year -> 0
  if (/महि|मही|मास|month|mnth/i.test(s)) return 0;
  const m = s.match(/\d{1,3}/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return n >= 0 && n <= 120 ? n : null;
}

// ---- Names -----------------------------------------------------------------

const TITLES: { re: RegExp; title: string; deceased?: boolean }[] = [
  { re: /^श्रीमती\.?\s*/, title: "श्रीमती" },
  { re: /^सौ\.?\s*/, title: "सौ." },
  { re: /^कु\.?\s*/, title: "कु." },
  { re: /^कुमारी\s*/, title: "कु." },
  { re: /^चि\.?\s*/, title: "चि." },
  { re: /^श्री\.?\s*/, title: "श्री" },
  { re: /^कै\.?\s*/, title: "कै.", deceased: true }, // कै. = late (deceased)
  { re: /^स्व\.?\s*/, title: "स्व.", deceased: true },
  { re: /^डॉ\.?\s*/, title: "डॉ." },
];

export interface NameParts {
  title: string;
  firstName: string;
  middleName: string;
  surname: string;
  deceasedHint: boolean;
}

/**
 * Split "सौ. निर्मलाबाई कचरदासजी चोरडिया" into title / first / middle / surname.
 * Indian names on these forms follow: first, father's-or-husband's name, surname.
 */
export function splitName(raw: string): NameParts {
  let s = (raw || "").normalize("NFC").replace(/\s+/g, " ").trim();
  let title = "";
  let deceasedHint = false;
  for (const t of TITLES) {
    if (t.re.test(s)) {
      title = t.title;
      deceasedHint = !!t.deceased;
      s = s.replace(t.re, "").trim();
      break;
    }
  }
  const words = s.split(" ").filter(Boolean);
  if (words.length === 0) return { title, firstName: "", middleName: "", surname: "", deceasedHint };
  if (words.length === 1) return { title, firstName: words[0], middleName: "", surname: "", deceasedHint };
  if (words.length === 2) return { title, firstName: words[0], middleName: "", surname: words[1], deceasedHint };
  return {
    title,
    firstName: words[0],
    middleName: words.slice(1, -1).join(" "),
    surname: words[words.length - 1],
    deceasedHint,
  };
}

export function fullName(p: { title?: string; firstName: string; middleName?: string; surname?: string }, withTitle = true): string {
  return [withTitle ? p.title : "", p.firstName, p.middleName, p.surname].filter(Boolean).join(" ");
}

// ---- Phonetic search key ------------------------------------------------------

const TITLE_WORDS = new Set(["श्री", "श्रीमती", "सौ", "कु", "कुमारी", "चि", "कै", "स्व", "डॉ"]);

/**
 * Build a loose "sounds-like" key so that spelling variations match:
 *   लुणिया = लुनिया, कांतिलाल = कान्तिलाल, सुगनचंदजी = सुगनचंद,
 *   दीपिका = दिपिका, सूरज = सुरज, शाह = साह.
 */
export function searchKey(raw: string): string {
  let s = (raw || "").normalize("NFC").toLowerCase();
  s = toEnglishDigits(s);
  s = s.replace(/[.।॥,:;!'"()\-_/]/g, " ");
  s = s
    .replace(/़/g, "") // nukta
    .replace(/ँ/g, "ं") // chandrabindu -> anusvara
    .replace(/[ङञणनम]्(?=[क-ह])/g, "ं") // half nasal before consonant -> anusvara
    .replace(/ण/g, "न")
    .replace(/ळ/g, "ल")
    .replace(/[शष]/g, "स")
    .replace(/व़/g, "व")
    .replace(/ी/g, "ि") // ी -> ि
    .replace(/ू/g, "ु") // ू -> ु
    .replace(/ई/g, "इ")
    .replace(/ऊ/g, "उ")
    .replace(/[ॅॉ]/g, "ा") // ॅ ॉ -> ा
    .replace(/ः/g, ""); // visarga
  const words = s
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !TITLE_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith("जि") ? w.slice(0, -2) : w)) // सुगनचंदजी -> सुगनचंद (after ी->ि)
    .map((w) => w.replace(/बाइ$/, "")); // निर्मलाबाई -> निर्मला
  return words.join(" ");
}

/** True when every word of the query appears somewhere in the target key. */
export function matchesSearch(targetKey: string, query: string): boolean {
  const q = searchKey(query).split(" ").filter(Boolean);
  if (q.length === 0) return true;
  return q.every((w) => targetKey.includes(w));
}
