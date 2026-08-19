/**
 * MarketNow — Language Context
 * =============================
 *
 * Provides current language + t() translation function to all components.
 * Persists preference in localStorage. Defaults to browser language or 'en'.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TRANSLATIONS, DEFAULT_LANG, LANGUAGES } from '../utils/translations.js';

const LanguageContext = createContext(null);

const STORAGE_KEY = 'mn_lang';

function detectInitialLang() {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && TRANSLATIONS[stored]) return stored;
  const browser = navigator.language?.slice(0, 2).toLowerCase();
  if (browser && TRANSLATIONS[browser]) return browser;
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(detectInitialLang);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (key, vars) => {
      const dict = TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LANG];
      let str = dict[key] ?? TRANSLATIONS[DEFAULT_LANG][key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return str;
    },
    [lang]
  );

  const changeLang = useCallback((newLang) => {
    if (TRANSLATIONS[newLang]) {
      setLang(newLang);
    }
  }, []);

  const value = { lang, setLang, changeLang, t, languages: LANGUAGES };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
