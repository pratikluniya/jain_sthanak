"use client";
// Put inside any <form>: keeps Marathi and English boxes in step while typing (decided 22 Oct 2026).
//  - Typing English fills the Marathi box when that box is empty, holds English letters, or was filled this way.
//  - Typing Marathi fills the English box when that box is empty or was filled this way.
// A box the volunteer typed in by hand is never overwritten. The server does the same again on save.
import { useEffect, useRef } from "react";
import { toEnglishName } from "@/lib/translit";
import { addressToEnglish } from "@/lib/addressEn";
import { addressToMarathi, isLatinOnly, toMarathiName } from "@/lib/toMarathi";

type Field = HTMLInputElement | HTMLTextAreaElement;
const PAIRS: { dev: string; en: string; address?: boolean }[] = [
  { dev: "headName", en: "headNameEn" },
  { dev: "firstName", en: "firstNameEn" },
  { dev: "middleName", en: "middleNameEn" },
  { dev: "surname", en: "surnameEn" },
  { dev: "address", en: "addressEn", address: true },
];

export default function LiveBilingual() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const cleanups: (() => void)[] = [];
    for (const p of PAIRS) {
      const dev = form.querySelector<Field>(`[name="${p.dev}"]`);
      const en = form.querySelector<Field>(`[name="${p.en}"]`);
      if (!dev || !en) continue;
      let devAuto = !dev.value.trim() || isLatinOnly(dev.value);
      let enAuto = !en.value.trim();
      const onEn = () => {
        enAuto = false;
        if (devAuto) dev.value = p.address ? addressToMarathi(en.value) : toMarathiName(en.value);
      };
      const onDev = () => {
        devAuto = false;
        if (enAuto) en.value = p.address ? addressToEnglish(dev.value) : toEnglishName(dev.value);
      };
      en.addEventListener("input", onEn);
      dev.addEventListener("input", onDev);
      cleanups.push(() => {
        en.removeEventListener("input", onEn);
        dev.removeEventListener("input", onDev);
      });
    }
    return () => cleanups.forEach((c) => c());
  }, []);
  return <span ref={ref} hidden />;
}
