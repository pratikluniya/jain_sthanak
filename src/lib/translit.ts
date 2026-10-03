// Devanagari (Marathi / Hindi) names -> English spelling.
//
// How it works:
//   1. Known words (common Jain surnames, titles) come from a fixed list, so they are always spelled
//      the way families usually write them (चोरडिया -> Chordiya).
//   2. Every other word is converted letter by letter, then the silent "a" is dropped the way
//      Marathi and Hindi speakers drop it (कांतिलाल -> Kantilal, not Kaantilaala).
// The result is a suggestion. A volunteer checks it on the check screen and can change it.

/** Common surnames and words with their usual English spelling. [Unverified]: spellings follow common usage; families may write them differently. */
const KNOWN: Record<string, string> = {
  जैन: "Jain",
  लुणिया: "Luniya",
  लुनिया: "Luniya",
  चोरडिया: "Chordiya",
  छाजेड: "Chhajed",
  बोथरा: "Bothra",
  कटारिया: "Katariya",
  बाफना: "Bafna",
  सुराणा: "Surana",
  ललवाणी: "Lalwani",
  कोठारी: "Kothari",
  ओस्तवाल: "Ostwal",
  ओसवाल: "Oswal",
  भंडारी: "Bhandari",
  मुणोत: "Munot",
  संचेती: "Sancheti",
  दुगड: "Dugad",
  गांधी: "Gandhi",
  शाह: "Shah",
  पारख: "Parakh",
  बरडिया: "Bardiya",
  कांकरिया: "Kankariya",
  नाहर: "Nahar",
  लोढा: "Lodha",
  बागमार: "Bagmar",
  पगारिया: "Pagariya",
  बोरा: "Bora",
  चोपडा: "Chopda",
  डागा: "Daga",
  गोलेछा: "Golechha",
  देसरडा: "Desarda",
  बेदमुथा: "Bedmutha",
  सांकला: "Sankla",
  समदडिया: "Samdadiya",
  भटेवरा: "Bhatewara",
  तातेड: "Tated",
  मेहता: "Mehta",
  सेठिया: "Sethiya",
  कोचर: "Kochar",
  धाडीवाल: "Dhadiwal",
  गुगळे: "Gugale",
  रुणवाल: "Runwal",
  दर्डा: "Darda",
  नवलखा: "Navlakha",
  मुथा: "Mutha",
  कर्नावट: "Karnavat",
  खिंवसरा: "Khinvsara",
  पटवा: "Patwa",
  ब्रह्मेचा: "Brahmecha",
};

/** Titles shown before a name. */
export const TITLE_EN: Record<string, string> = {
  "श्री": "Shri",
  "सौ.": "Sau.",
  "श्रीमती": "Smt.",
  "कु.": "Ku.",
  "चि.": "Chi.",
  "डॉ.": "Dr.",
  "कै.": "Late",
  "स्व.": "Late",
};

const VOWELS: Record<string, string> = {
  अ: "a", आ: "a", इ: "i", ई: "ee", उ: "u", ऊ: "oo", ऋ: "ru", ए: "e", ऐ: "ai", ओ: "o", औ: "au", ऍ: "e", ऑ: "o",
};
const MATRAS: Record<string, string> = {
  "ा": "a", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ru", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॅ": "e", "ॉ": "o",
};
const CONSONANTS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n",
  च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n",
  त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m",
  य: "y", र: "r", ल: "l", व: "v", श: "sh", ष: "sh", स: "s", ह: "h", ळ: "l",
};
const VIRAMA = "्";
const ANUSVARA = "ं";
const CHANDRABINDU = "ँ";
const VISARGA = "ः";
const NUKTA = "़";

interface Syllable {
  cons: string;   // consonant letters, e.g. "pr" for प्र ("" for a bare vowel)
  vowel: string;  // "a" when inherent, matra value, or "" after a virama at word end
  inherent: boolean;
  nasal: boolean; // anusvara / chandrabindu after the syllable
  nc: number;     // how many consonants (1 = single, 2+ = conjunct)
}

function syllables(word: string): Syllable[] | null {
  const out: Syllable[] = [];
  const chars = [...word.replace(new RegExp(NUKTA, "g"), "")];
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    if (VOWELS[c] !== undefined) {
      out.push({ cons: "", vowel: VOWELS[c], inherent: false, nasal: false, nc: 0 });
      i++;
    } else if (CONSONANTS[c] !== undefined) {
      let cons = CONSONANTS[c];
      let nc = 1;
      i++;
      // conjuncts: consonant + virama + consonant ...
      while (chars[i] === VIRAMA && CONSONANTS[chars[i + 1]] !== undefined) {
        cons += CONSONANTS[chars[i + 1]];
        nc++;
        i += 2;
      }
      if (chars[i] === VIRAMA) {
        out.push({ cons, vowel: "", inherent: false, nasal: false, nc });
        i++;
      } else if (MATRAS[chars[i]] !== undefined) {
        out.push({ cons, vowel: MATRAS[chars[i]], inherent: false, nasal: false, nc });
        i++;
      } else {
        out.push({ cons, vowel: "a", inherent: true, nasal: false, nc });
      }
    } else if (c === ANUSVARA || c === CHANDRABINDU) {
      if (out.length) out[out.length - 1].nasal = true;
      i++;
    } else if (c === VISARGA) {
      i++;
    } else {
      return null; // not a Devanagari name word
    }
    // ज्ञ is said "dny" in Marathi names (ज्ञानेश्वर -> Dnyaneshwar)
    const last = out[out.length - 1];
    if (last && last.cons.endsWith("jn")) last.cons = last.cons.slice(0, -2) + "dny";
    // क्ष stays "ksh"
  }
  return out;
}

function capital(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** One word, Devanagari -> English. Returns the input unchanged when it is not Devanagari. */
export function wordToEnglish(word: string): string {
  const w = word.normalize("NFC").trim();
  if (!w) return "";
  if (!/[ऀ-ॿ]/.test(w)) return capital(w); // already English
  if (KNOWN[w]) return KNOWN[w];

  // "जी" at the end is a respect word: कांतिलालजी -> Kantilalji
  if (w.length > 2 && w.endsWith("जी") && KNOWN[w.slice(0, -2)]) return KNOWN[w.slice(0, -2)] + "ji";

  const syl = syllables(w);
  if (!syl) return w;

  // Drop the silent "a": first at the end of the word, then in the middle when it sits between two sounded vowels.
  const n = syl.length;
  // ...but not after a conjunct: राजेंद्र -> Rajendra
  if (n > 1 && syl[n - 1].inherent && !syl[n - 1].nasal && syl[n - 1].nc < 2) syl[n - 1].vowel = "";
  for (let k = n - 2; k >= 1; k--) {
    const s = syl[k];
    if (!s.inherent || s.nasal || s.nc !== 1) continue; // only a single consonant loses its "a" (प्रविण, not प्र)
    const prev = syl[k - 1];
    const next = syl[k + 1];
    if (prev.vowel !== "" && next.vowel !== "" && next.nc === 1) s.vowel = "";
  }

  let out = "";
  syl.forEach((s, k) => {
    // व inside a conjunct sounds "w" (ज्ञानेश्वर -> Dnyaneshwar)
    const cons = s.nc >= 2 ? s.cons[0] + s.cons.slice(1).replace(/v/g, "w") : s.cons;
    // long ई / ऊ: "ee" / "oo" in the first syllable (Deepika, Pooja), "i" / "u" after it (Mahavir, Rashmi)
    const vowel = k > 0 && s.vowel === "ee" ? "i" : k > 0 && s.vowel === "oo" ? "u" : s.vowel;
    out += cons + vowel;
    if (s.nasal) {
      const next = syl[k + 1];
      out += next && /^[pbm]/.test(next.cons) ? "m" : "n";
    }
  });
  return capital(out);
}

/** A name part that may have several words, e.g. "सुगनचंदजी" or "निर्मला बाई". */
export function toEnglishName(text: string): string {
  return (text || "")
    .split(/\s+/)
    .filter(Boolean)
    .map(wordToEnglish)
    .join(" ");
}

export function titleToEnglish(title: string): string {
  return TITLE_EN[(title || "").trim()] ?? (title || "");
}
