// English spelling of a family address (decided 11 Oct 2026): common words are translated
// (सोसायटी -> Society, रोड -> Road, जवळ -> Near, ना. रोड -> Nashik Road), names are spelled
// out with the name transliterator, Devanagari digits become 0-9. A volunteer can correct it.
import { toEnglishName } from "./translit";

const DEV_DIGITS = "०१२३४५६७८९";

// whole phrases first (longest first), then single words; keys without the trailing dot
const PHRASES: [RegExp, string][] = [
  [/ना\.?\s*रोड|नासिक\s*रोड|नाशिक\s*रोड|नाशिकरोड|नासिकरोड|नारोड/g, "Nashik Road"],
  [/आर्टि?लरी\s*से(?:ंटर|न्टर)?\.?\s*रोड|आ\.\s*सेंटर\s*रोड/g, "Artillery Centre Road"],
  [/दे\.?\s*गा(?:व|ंव)|देवळाली\s*गा(?:व|ंव)/g, "Deolali Gaon"],
  [/जेल\s*रोड/g, "Jail Road"],
  [/दत्त\s*मं?दि?ी?र\s*रोड/g, "Datta Mandir Road"],
  [/को\.?\s*ऑ?प?\.?\s*हौ\.?\s*सो(?:सायटी|सा)?\.?/g, "Co-op Housing Society"],
  [/हौ\.?\s*सो(?:सायटी|सा)?\.?/g, "Housing Society"],
  [/प्लॉट\s*न(?:ं|ंबर)\.?/g, "Plot No."],
  [/फ्लॅ?ट\s*न(?:ं|ंबर)\.?|फ्लॅ\.\s*नं\.?/g, "Flat No."],
  [/रो\.?\s*हा\.?\s*न(?:ं|ंबर)\.?/g, "Row House No."],
  [/सर्वे\s*न(?:ं|ंबर)\.?/g, "Survey No."],
  [/रूम\s*न(?:ं|ंबर)\.?/g, "Room No."],
  [/जैन\s*भवन/g, "Jain Bhavan"],
  [/जैन\s*स्थानक/g, "Jain Sthanak"],
  [/जैन\s*कॉलनी/g, "Jain Colony"],
];

const WORDS: Record<string, string> = {
  "सोसायटी": "Society", "सोसाईटी": "Society", "सो": "Society", "सोसा": "Society",
  "अपार्टमेंट": "Apartment", "अपार्टमेन्ट": "Apartment", "अपार्ट": "Apartment",
  "बंगला": "Bungalow", "बंगलो": "Bungalow", "रोड": "Road", "मार्ग": "Marg", "चौक": "Chowk",
  "कॉलनी": "Colony", "नगर": "Nagar", "मळा": "Mala", "गल्ली": "Galli", "पेठ": "Peth",
  "जवळ": "Near", "के पास": "Near", "समोर": "Opposite", "के सामने": "Opposite", "सामने": "Opposite",
  "मागे": "Behind", "मागील": "Behind", "पाठीमागे": "Behind", "के पिछे": "Behind", "पिछे": "Behind", "पीछे": "Behind", "शेजारी": "Next to",
  "नाशिक": "Nashik", "नासिक": "Nashik", "फ्लॅट": "Flat", "नं": "No.", "नंबर": "No.", "प्लॉट": "Plot",
  "रेसिडेन्सी": "Residency", "रेसिडेंसी": "Residency", "रेसीडेंसी": "Residency", "संकुल": "Sankul",
  "हाऊस": "House", "हाउस": "House", "भवन": "Bhavan", "मंदिर": "Mandir", "मंदीर": "Mandir",
  "टॉकीज": "Talkies", "हॉस्पिटल": "Hospital", "शाळा": "School", "विंग": "Wing", "मजला": "Floor",
};

const toAsciiDigits = (s: string) => s.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)));

/** Address in English letters. Text already written in English is only cleaned of Devanagari digits. */
export function addressToEnglish(text: string): string {
  let s = toAsciiDigits((text ?? "").normalize("NFC")).replace(/\s+/g, " ").trim();
  if (!/[ऀ-ॿ]/.test(s)) return s;
  for (const [re, en] of PHRASES) s = s.replace(re, ` ${en} `);
  for (const k of Object.keys(WORDS).filter((w) => w.includes(" "))) s = s.split(k).join(` ${WORDS[k]} `);
  // word by word: keep punctuation, translate known words, transliterate the rest
  const out = s.split(/(\s+|[,;()/-])/).map((tok) => {
    if (!/[ऀ-ॿ]/.test(tok)) return tok;
    const bare = tok.replace(/[.।]+$/, "");
    const dot = tok.length > bare.length ? "." : "";
    if (WORDS[bare]) return WORDS[bare] + (WORDS[bare].endsWith(".") ? "" : dot ? "" : "");
    return toEnglishName(bare) + dot;
  });
  const joined = out.join("").replace(/\s+([,.;)])/g, "$1").replace(/\(\s+/g, "(").replace(/\s{2,}/g, " ").trim();
  return movePostpositions(joined);
}

// Marathi/Hindi put "near / behind / opposite" after the landmark ("जैन भवन समोर"). In English it
// goes before it: "Opposite Jain Bhavan". The landmark is the words since the last comma or the last
// place word (Society, Road, Nagar ...).
const POST = ["Next to", "Near", "Behind", "Opposite"];
const BOUNDARY = new Set(["Society", "Apartment", "Nagar", "Colony", "Road", "Bungalow", "Residency", "Sankul", "Chowk", "Marg", "Peth", "Galli", "Mala", "House"]);
function movePostpositions(s: string): string {
  return s.split(",").map((seg) => {
    const words = seg.trim().split(" ").filter(Boolean);
    let done: string[] = []; // already placed text pieces
    let cur: string[] = []; // words since the last place word
    for (let i = 0; i < words.length; i++) {
      const w = words[i].replace(/\.$/, "");
      const post = w === "Next" && words[i + 1] === "to" ? "Next to" : POST.includes(w) ? w : "";
      if (post && cur.length) {
        if (post === "Next to") i++;
        done.push(`${post} ${cur.join(" ")}`);
        cur = [];
        continue;
      }
      cur.push(words[i]);
      if (BOUNDARY.has(w)) { done.push(cur.join(" ")); cur = []; }
    }
    if (cur.length) done.push(cur.join(" "));
    // join place words back with spaces, but put a comma before and after a "Near X" piece
    let out = "";
    done.forEach((d, k) => {
      const isPost = POST.some((p) => d.startsWith(p + " "));
      const prevPost = k > 0 && POST.some((p) => done[k - 1].startsWith(p + " "));
      out += k === 0 ? d : (isPost || prevPost ? ", " : " ") + d;
    });
    return out;
  }).join(", ").trim();
}


/** The address to show: English on English screens and downloads (falls back to the original). */
export function familyAddress(f: { address: string; addressEn?: string | null }, english: boolean): string {
  return english ? f.addressEn || f.address : f.address;
}
