// Amount in words for receipts (Indian numbering: हजार, लाख, कोटी).
// [Unverified] Marathi spellings follow common usage; please have the committee check them once.

const MR = [
  "शून्य", "एक", "दोन", "तीन", "चार", "पाच", "सहा", "सात", "आठ", "नऊ",
  "दहा", "अकरा", "बारा", "तेरा", "चौदा", "पंधरा", "सोळा", "सतरा", "अठरा", "एकोणीस",
  "वीस", "एकवीस", "बावीस", "तेवीस", "चोवीस", "पंचवीस", "सव्वीस", "सत्तावीस", "अठ्ठावीस", "एकोणतीस",
  "तीस", "एकतीस", "बत्तीस", "तेहेतीस", "चौतीस", "पस्तीस", "छत्तीस", "सदतीस", "अडतीस", "एकोणचाळीस",
  "चाळीस", "एक्केचाळीस", "बेचाळीस", "त्रेचाळीस", "चव्वेचाळीस", "पंचेचाळीस", "सेहेचाळीस", "सत्तेचाळीस", "अठ्ठेचाळीस", "एकोणपन्नास",
  "पन्नास", "एक्कावन्न", "बावन्न", "त्रेपन्न", "चोपन्न", "पंचावन्न", "छप्पन्न", "सत्तावन्न", "अठ्ठावन्न", "एकोणसाठ",
  "साठ", "एकसष्ठ", "बासष्ठ", "त्रेसष्ठ", "चौसष्ठ", "पासष्ठ", "सहासष्ठ", "सदुसष्ठ", "अडुसष्ठ", "एकोणसत्तर",
  "सत्तर", "एक्काहत्तर", "बाहत्तर", "त्र्याहत्तर", "चौऱ्याहत्तर", "पंच्याहत्तर", "शहात्तर", "सत्याहत्तर", "अठ्ठ्याहत्तर", "एकोणऐंशी",
  "ऐंशी", "एक्क्याऐंशी", "ब्याऐंशी", "त्र्याऐंशी", "चौऱ्याऐंशी", "पंच्याऐंशी", "शहाऐंशी", "सत्त्याऐंशी", "अठ्ठ्याऐंशी", "एकोणनव्वद",
  "नव्वद", "एक्क्याण्णव", "ब्याण्णव", "त्र्याण्णव", "चौऱ्याण्णव", "पंच्याण्णव", "शहाण्णव", "सत्त्याण्णव", "अठ्ठ्याण्णव", "नव्व्याण्णव",
];

function mrBelowThousand(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h === 1 && r === 0) parts.push("शंभर");
  else if (h > 0) parts.push(`${MR[h]}शे`);
  if (r > 0) parts.push(MR[r]);
  return parts.join(" ");
}

export function rupeesInMarathi(amount: number): string {
  let n = Math.floor(Math.abs(amount));
  if (n === 0) return "शून्य रुपये फक्त";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${crore < 100 ? MR[crore] : rupeesInMarathi(crore).replace(" रुपये फक्त", "")} कोटी`);
  if (lakh) parts.push(`${MR[lakh]} लाख`);
  if (thousand) parts.push(`${MR[thousand]} हजार`);
  if (n) parts.push(mrBelowThousand(n));
  return `${parts.join(" ")} रुपये फक्त`;
}

const EN_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const EN_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function en99(n: number): string {
  if (n < 20) return EN_ONES[n];
  return [EN_TENS[Math.floor(n / 10)], EN_ONES[n % 10]].filter(Boolean).join(" ");
}
function en999(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${EN_ONES[h]} Hundred` : "", r ? en99(r) : ""].filter(Boolean).join(" ");
}

export function rupeesInEnglish(amount: number): string {
  let n = Math.floor(Math.abs(amount));
  if (n === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${en999(crore)} Crore`);
  if (lakh) parts.push(`${en99(lakh)} Lakh`);
  if (thousand) parts.push(`${en99(thousand)} Thousand`);
  if (n) parts.push(en999(n));
  return `Rupees ${parts.join(" ")} Only`;
}
