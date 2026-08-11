import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  CLIENT_LANGS, CLIENT_LANG_LABELS, getClientTranslation, fmtClientDate, weightDeltaHint,
} from "../lib/clientI18n";

const STORAGE_KEY = "client-lang";

function readLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (CLIENT_LANGS.includes(saved)) return saved;
  } catch { /* noop */ }
  return "ru";
}

const ClientLanguageContext = createContext(null);

export function ClientLanguageProvider({ children }) {
  const [lang, setLangState] = useState(readLang);

  const setLang = useCallback((next) => {
    if (!CLIENT_LANGS.includes(next)) return;
    setLangState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
  }, []);

  const t = useCallback((key) => getClientTranslation(lang, key), [lang]);
  const fmtDate = useCallback((iso) => fmtClientDate(iso, lang), [lang]);
  const deltaHint = useCallback((delta) => weightDeltaHint(delta, lang), [lang]);

  const value = useMemo(() => ({ lang, setLang, t, fmtDate, deltaHint }), [lang, setLang, t, fmtDate, deltaHint]);

  return (
    <ClientLanguageContext.Provider value={value}>{children}</ClientLanguageContext.Provider>
  );
}

export function useClientLanguage() {
  const ctx = useContext(ClientLanguageContext);
  if (!ctx) throw new Error("useClientLanguage must be used within ClientLanguageProvider");
  return ctx;
}

export function LanguageSwitcher() {
  const { lang, setLang } = useClientLanguage();

  return (
    <div style={{ display: "flex", gap: 3, background: "#1b212f", border: "1px solid #303a50", borderRadius: 8, padding: 3 }}>
      {CLIENT_LANGS.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-label={code}
          style={{
            minWidth: 34, padding: "5px 8px", borderRadius: 6, border: "none",
            fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em",
            background: lang === code ? "#e0a940" : "transparent",
            color: lang === code ? "#120f08" : "#808a9e",
          }}
        >
          {CLIENT_LANG_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
