import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import i18n from "../i18n";

type Lang = "en" | "ar";

interface LangCtx {
  language: Lang;
  isRTL: boolean;
  toggleLanguage: () => void;
  setLanguage: (l: Lang) => void;
}

const LanguageContext = createContext<LangCtx>({
  language: "en",
  isRTL: false,
  toggleLanguage: () => {},
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Lang>(
    (localStorage.getItem("language") as Lang) || "en"
  );

  useEffect(() => {
    document.documentElement.dir  = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const applyLanguage = (lang: Lang) => {
    setLang(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        isRTL: language === "ar",
        toggleLanguage: () => applyLanguage(language === "en" ? "ar" : "en"),
        setLanguage: applyLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
