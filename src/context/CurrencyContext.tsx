import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

export type Currency = "USD" | "LBP";

interface CurrencyCtx {
  baseCurrency:  Currency;
  exchangeRate:  number;      // LBP per 1 USD (e.g. 89500)
  showAlt:       boolean;     // show secondary currency alongside primary
  scale:         number;      // 100 for USD (cents), 1 for LBP (no sub-unit)
  symbol:        string;      // "$" or "ل.ل"
  altSymbol:     string;
  inputStep:     string;      // "0.01" or "1" — for <input step>
  inputDecimals: number;      // 2 or 0
  /** DB integer → formatted display string with symbol */
  fmt:    (n: number) => string;
  /** DB integer → other-currency display string */
  fmtAlt: (n: number) => string;
  /** Floating-point display value → formatted string (for computed values like margin strip) */
  fmtNum: (n: number) => string;
  /** DB integer → input field string */
  fromDb: (n: number) => string;
  /** Input field string → DB integer */
  toDb:   (s: string) => number;
  /** Persist a setting and update context */
  setSetting: (key: string, value: string) => Promise<void>;
}

const CurrencyContext = createContext<CurrencyCtx>(undefined!);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [baseCurrency, setBaseCurrency] = useState<Currency>("USD");
  const [exchangeRate, setExchangeRate] = useState<number>(89500);
  const [showAlt,      setShowAlt]      = useState(false);

  useEffect(() => {
    api.getSettings().then(settings => {
      for (const s of settings) {
        if (s.key === "base_currency")     setBaseCurrency(s.value as Currency);
        if (s.key === "exchange_rate")     setExchangeRate(Number(s.value));
        if (s.key === "show_alt_currency") setShowAlt(s.value === "true");
      }
    }).catch(console.error);
  }, []);

  const isUSD = baseCurrency === "USD";
  const scale         = isUSD ? 100 : 1;
  const symbol        = isUSD ? "$"   : "ل.ل";
  const altSymbol     = isUSD ? "ل.ل" : "$";
  const inputStep     = isUSD ? "0.01" : "1";
  const inputDecimals = isUSD ? 2 : 0;

  const fmt = (n: number): string => {
    if (isUSD) return `$${(n / 100).toFixed(2)}`;
    return `ل.ل ${Math.round(n).toLocaleString("en-US")}`;
  };

  const fmtAlt = (n: number): string => {
    if (isUSD) {
      // cents → LBP
      const lbp = Math.round((n / 100) * exchangeRate);
      return `ل.ل ${lbp.toLocaleString("en-US")}`;
    } else {
      // LBP → USD
      const usd = n / exchangeRate;
      return `$${usd.toFixed(2)}`;
    }
  };

  // Formats a floating-point display-unit value (e.g. from user input or computed prices)
  const fmtNum = (n: number): string => {
    if (isUSD) return `$${n.toFixed(2)}`;
    return `ل.ل ${Math.round(n).toLocaleString("en-US")}`;
  };

  const fromDb = (n: number): string => {
    if (isUSD) return (n / 100).toFixed(2);
    return String(Math.round(n));
  };

  const toDb = (s: string): number => {
    const n = parseFloat(s || "0");
    if (isNaN(n)) return 0;
    return isUSD ? Math.round(n * 100) : Math.round(n);
  };

  const setSetting = async (key: string, value: string) => {
    await api.updateSetting(key, value);
    if (key === "base_currency")     setBaseCurrency(value as Currency);
    if (key === "exchange_rate")     setExchangeRate(Number(value));
    if (key === "show_alt_currency") setShowAlt(value === "true");
  };

  return (
    <CurrencyContext.Provider value={{
      baseCurrency, exchangeRate, showAlt,
      scale, symbol, altSymbol,
      inputStep, inputDecimals,
      fmt, fmtAlt, fmtNum, fromDb, toDb,
      setSetting,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyCtx {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
