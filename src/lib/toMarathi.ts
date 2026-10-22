// English spelling -> Marathi (Devanagari), the reverse of translit.ts (decided 22 Oct 2026).
// Used when only the English name or address was filled in, or when English letters were typed in a Marathi box.
//   1. Words the Sangh already has: names saved earlier in both scripts (learned from the database,
//      most common spelling wins), common surnames and titles.
//   2. Any other word letter by letter (Pratik -> प्रतिक). Rule-based, so long vowels and ण / न can be
//      wrong (Kantilal -> कंतिलाल); a volunteer corrects it on the form.
import { KNOWN, TITLE_EN } from "./translit";

const LATIN = /[A-Za-z]/;
const DEV = /[ऀ-ॿ]/;
export const hasLatin = (s: string) => LATIN.test(s ?? "");
export const isLatinOnly = (s: string) => hasLatin(s) && !DEV.test(s ?? "");

// ---------- known words ----------
const FIXED = new Map<string, string>();
for (const [dev, en] of Object.entries(KNOWN)) if (!FIXED.has(en.toLowerCase())) FIXED.set(en.toLowerCase(), dev);
for (const [dev, en] of Object.entries(TITLE_EN)) FIXED.set(en.toLowerCase().replace(/\.$/, ""), dev);
for (const [en, dev] of Object.entries({ shrimati: "श्रीमती", smt: "श्रीमती", mrs: "सौ.", mr: "श्री", kumari: "कु.", kumar: "कुमार", dr: "डॉ.", late: "कै.", jain: "जैन", bai: "बाई" }))
  FIXED.set(en, dev);

let learned = new Map<string, string>();
/** Learned English -> Marathi spellings (filled from the database by loadLearnedNames). */
export function setLearnedNames(m: Map<string, string>) {
  learned = m;
}

/** Builds the learned list from pairs of (Marathi, English) names already saved, most common spelling first. */
export function learnFromPairs(pairs: [string, string][]): Map<string, string> {
  const count = new Map<string, Map<string, number>>();
  for (const [dev, en] of pairs) {
    const d = (dev ?? "").trim().split(/\s+/).filter(Boolean);
    const e = (en ?? "").trim().split(/\s+/).filter(Boolean);
    if (!d.length || d.length !== e.length) continue;
    d.forEach((dw, i) => {
      const ew = e[i].toLowerCase().replace(/[.,]/g, "");
      if (!ew || !DEV.test(dw) || hasLatin(dw)) return;
      const c = count.get(ew) ?? new Map<string, number>();
      c.set(dw, (c.get(dw) ?? 0) + 1);
      count.set(ew, c);
    });
  }
  const out = new Map<string, string>();
  for (const [ew, c] of count) out.set(ew, [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  return out;
}

// ---------- letter by letter ----------
const CONS: [string, string][] = [
  ["ksh", "क्ष"], ["chh", "छ"], ["shh", "ष"], ["dny", "ज्ञ"], ["gy", "ज्ञ"],
  ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"], ["th", "थ"], ["dh", "ध"], ["ph", "फ"], ["bh", "भ"], ["sh", "श"],
  ["k", "क"], ["g", "ग"], ["c", "क"], ["j", "ज"], ["t", "त"], ["d", "द"], ["n", "न"], ["p", "प"], ["b", "ब"], ["m", "म"],
  ["y", "य"], ["r", "र"], ["l", "ल"], ["v", "व"], ["w", "व"], ["s", "स"], ["h", "ह"], ["f", "फ"], ["z", "झ"], ["q", "क"], ["x", "क्स"],
];
const VOW: [string, string, string][] = [
  // english, independent letter, matra
  ["aa", "आ", "ा"], ["ee", "ई", "ी"], ["ii", "ई", "ी"], ["oo", "ऊ", "ू"], ["uu", "ऊ", "ू"], ["ai", "ऐ", "ै"], ["au", "औ", "ौ"], ["ou", "औ", "ौ"],
  ["a", "अ", ""], ["i", "इ", "ि"], ["u", "उ", "ु"], ["e", "ए", "े"], ["o", "ओ", "ो"],
];
const VIRAMA = "्";

function match<T extends [string, ...string[]]>(list: T[], w: string, i: number): T | null {
  for (const x of list) if (w.startsWith(x[0], i)) return x;
  return null;
}

/** One English word to Devanagari, letter by letter. */
export function wordToMarathiRules(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return word;
  let out = "";
  let i = 0;
  let afterCons = false; // the last thing written was a consonant still waiting for its vowel
  while (i < w.length) {
    const v = match(VOW, w, i);
    if (v) {
      const end = i + v[0].length >= w.length;
      let matra = v[2];
      // word-final short vowels are usually long in Marathi names: Mutha -> मुथा, Shanti -> शांती, Raju -> राजू
      if (end && afterCons && v[0] === "a" && w.length > 3) matra = "ा";
      if (end && afterCons && v[0] === "i") matra = "ी";
      if (end && afterCons && v[0] === "u") matra = "ू";
      out += afterCons ? matra : v[1];
      afterCons = false;
      i += v[0].length;
      continue;
    }
    const c = match(CONS, w, i);
    if (!c) { i++; continue; }
    const next = i + c[0].length;
    const nextIsCons = next < w.length && !match(VOW, w, next);
    // n / m before another consonant is written as anusvara: Chand -> चंद, Sampat -> संपत
    if ((c[0] === "n" || c[0] === "m") && nextIsCons && out && !afterCons) {
      out += "ं";
      i = next;
      continue;
    }
    if (afterCons) out += VIRAMA; // consonant cluster
    out += c[1];
    afterCons = true;
    i = next;
  }
  return out;
}

/** One English word, using known and learned spellings first. "ji" at the end is kept: Kantilalji -> कांतिलालजी. */
export function wordToMarathi(word: string): string {
  const raw = word.trim();
  if (!raw || !hasLatin(raw)) return raw;
  const key = raw.toLowerCase().replace(/[.,]/g, "");
  const known = learned.get(key) ?? FIXED.get(key);
  if (known) return known;
  if (key.length > 4 && key.endsWith("ji")) {
    const base = learned.get(key.slice(0, -2)) ?? FIXED.get(key.slice(0, -2));
    if (base) return base + "जी";
  }
  // common name endings: Kantilal -> ...लाल, Kamalabai -> ...बाई, Pravinkumar -> ...कुमार
  for (const [suf, mr] of SUFFIXES) {
    if (key.length > suf.length + 2 && key.endsWith(suf)) {
      const stem = key.slice(0, -suf.length);
      return wordToMarathi(stem) + mr;
    }
  }
  return wordToMarathiRules(raw);
}
const SUFFIXES: [string, string][] = [["kumar", "कुमार"], ["chand", "चंद"], ["lal", "लाल"], ["bai", "बाई"], ["raj", "राज"], ["nath", "नाथ"], ["ji", "जी"]];

/** A name (one or more words) in English letters to Marathi. */
export function toMarathiName(text: string): string {
  return (text ?? "").split(/\s+/).filter(Boolean).map(wordToMarathi).join(" ");
}

/**
 * Marathi + English pair of one name field, filled both ways:
 *  - English letters typed in the Marathi box: they are the English spelling, the Marathi is written from them;
 *  - Marathi empty, English given: the Marathi is written from the English.
 * The English side is not filled here (the existing Marathi -> English step does that).
 */
export function fillMarathi(dev: string, en: string): { dev: string; en: string } {
  const d = (dev ?? "").trim();
  const e = (en ?? "").trim();
  if (d && isLatinOnly(d)) return { dev: toMarathiName(d), en: e || d };
  if (!d && e) return { dev: toMarathiName(e), en: e };
  return { dev: d, en: e };
}

// ---------- addresses ----------
const ADDR_PHRASES: [RegExp, string][] = [
  [/\bnashik\s*road\b|\bnasik\s*road\b|\bnsk\s*rd\b/gi, "नाशिक रोड"],
  [/\bartillery\s+cent(?:re|er)\s+road\b/gi, "आर्टिलरी सेंटर रोड"],
  [/\bdeolali\s+gaon\b|\bdevlali\s+gaon\b/gi, "देवळाली गाव"],
  [/\bdatta\s+mandir\s+road\b/gi, "दत्त मंदिर रोड"],
  [/\bjail\s+road\b/gi, "जेल रोड"],
  [/\bjain\s+bhavan\b|\bjain\s+bhawan\b/gi, "जैन भवन"],
  [/\bjain\s+sthanak\b/gi, "जैन स्थानक"],
  [/\bco-?op(?:erative)?\.?\s+housing\s+society\b/gi, "को-ऑप हौसिंग सोसायटी"],
  [/\bhousing\s+society\b|\bhsg\.?\s+soc\.?/gi, "हौसिंग सोसायटी"],
  [/\bflat\s+no\.?/gi, "फ्लॅट नं."],
  [/\bplot\s+no\.?/gi, "प्लॉट नं."],
  [/\brow\s+house\b/gi, "रो हाऊस"],
];
const ADDR_WORDS: Record<string, string> = {
  road: "रोड", society: "सोसायटी", soc: "सोसायटी", nagar: "नगर", colony: "कॉलनी", apartment: "अपार्टमेंट", apt: "अपार्टमेंट",
  bungalow: "बंगला", mala: "मळा", chowk: "चौक", wing: "विंग", floor: "मजला", residency: "रेसिडेन्सी", heights: "हाइट्स",
  park: "पार्क", complex: "कॉम्प्लेक्स", house: "हाऊस", nashik: "नाशिक", nasik: "नाशिक", no: "नं.", mandir: "मंदिर", school: "स्कूल",
  hospital: "हॉस्पिटल", galli: "गल्ली", peth: "पेठ", villa: "व्हिला", tower: "टॉवर", building: "बिल्डिंग",
};
const POST: [RegExp, string][] = [[/^next\s+to\s+/i, "शेजारी"], [/^near\s+/i, "जवळ"], [/^behind\s+/i, "मागे"], [/^opp(?:osite|\.)?\s+/i, "समोर"]];

/** Address in English letters to Marathi. Text that is already Marathi is returned unchanged. */
export function addressToMarathi(text: string): string {
  const s = (text ?? "").replace(/\s+/g, " ").trim();
  if (!isLatinOnly(s)) return s;
  return s
    .split(",")
    .map((seg) => {
      let part = seg.trim();
      let post = "";
      for (const [re, mr] of POST) if (re.test(part)) { part = part.replace(re, ""); post = mr; break; }
      for (const [re, mr] of ADDR_PHRASES) part = part.replace(re, ` ${mr} `);
      part = part
        .split(/(\s+|[-/()])/)
        .map((tok) => {
          if (!hasLatin(tok)) return tok;
          const k = tok.toLowerCase().replace(/[.]/g, "");
          return ADDR_WORDS[k] ?? (/^[a-z]$/i.test(tok) ? tok.toUpperCase() : wordToMarathi(tok)); // wing letters stay A/B/C
        })
        .join("")
        .replace(/\s{2,}/g, " ")
        .trim();
      return post ? `${part} ${post}` : part;
    })
    .filter(Boolean)
    .join(", ");
}

/** Address pair filled both ways, like fillMarathi. */
export function fillMarathiAddress(dev: string, en: string): { dev: string; en: string } {
  const d = (dev ?? "").trim();
  const e = (en ?? "").trim();
  if (d && isLatinOnly(d)) return { dev: addressToMarathi(d), en: e || d };
  if (!d && e) return { dev: addressToMarathi(e), en: e };
  return { dev: d, en: e };
}
