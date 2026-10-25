"use client";

import { useCallback, useEffect, useState } from "react";

export type Lang = "en" | "am";

const LANG_KEY = "nalik:lang";
const LANG_EVENT = "nalik:lang";

/**
 * Shared English/Amharic setting. Persists to localStorage and stays in sync
 * across every component on the page (and across tabs).
 */
export function useLang() {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const sync = () => {
      try {
        const saved = localStorage.getItem(LANG_KEY);
        if (saved === "am" || saved === "en") setLangState(saved);
      } catch {
        // Storage unavailable: keep the default language.
      }
    };

    sync();
    window.addEventListener(LANG_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LANG_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // Storage unavailable: keep the in-memory preference.
    }
    window.dispatchEvent(new Event(LANG_EVENT));
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "en" ? "am" : "en");
  }, [lang, setLang]);

  return { lang, setLang, toggleLang };
}
