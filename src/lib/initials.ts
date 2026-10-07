/** "Pratik Luniya" -> "PL", "रमेश बोथरा" -> "रब". Titles like श्री / सौ. are skipped. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w && !/^(श्री|सौ\.?|श्रीमती|कु\.?|चि\.?|डॉ\.?|Shri|Smt\.?|Dr\.?)$/i.test(w));
  const first = (w: string | undefined) => (w ? Array.from(w)[0] : "");
  const out = first(words[0]) + (words.length > 1 ? first(words[words.length - 1]) : "");
  return out.toUpperCase() || "?";
}
