// Hidden text behind the page pictures of a downloaded PDF, so search and copy work (decided 22 Nov 2026).
// The picture shows the letters; this text is invisible and only there to be found.
// Devanagari uses a small cut of Noto Sans Devanagari (SIL Open Font License, public/fonts/pdf-text-devanagari.ttf,
// letters only, no joining rules: invisible text needs no shaping). Everything else uses the PDF's built-in Helvetica.

export const DEV_FONT_URL = "/fonts/pdf-text-devanagari.ttf";
export const DEV_FONT = "DevSearch";

const DEV = /[ऀ-ॿ‌‍꣠-ꣿ]/;

/** Split text into runs: Devanagari (with the spaces between its words) and the rest. */
export function scriptRuns(text: string): { dev: boolean; text: string }[] {
  const runs: { dev: boolean; text: string }[] = [];
  for (const ch of text) {
    const dev = DEV.test(ch) || (ch === " " && runs.length > 0 && runs[runs.length - 1].dev);
    const last = runs[runs.length - 1];
    if (last && last.dev === dev) last.text += ch;
    else runs.push({ dev, text: ch });
  }
  // Helvetica only has Latin-1 letters: drop anything else so the PDF stays valid
  return runs.map((r) => (r.dev ? r : { dev: false, text: r.text.replace(/[^ -ÿ]/g, "") })).filter((r) => r.text.length > 0);
}

/** One line of cell text: spaces and line breaks folded. */
export const cellText = (s: string) => s.replace(/\s+/g, " ").trim();
