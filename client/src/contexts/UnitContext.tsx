import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { UnitSystem } from "@shared/unitConversion";

export type AppLocale = "en" | "fa" | "ar" | "es" | "de";
const RTL_LOCALES: AppLocale[] = ["fa", "ar"];

interface UnitContextType {
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => void;
  toggleUnitSystem: () => void;
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  isRtl: boolean;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string, options?: Intl.DateTimeFormatOptions) => string;
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("SI");
  const [locale, setLocaleState] = useState<AppLocale>("en");
  const isRtl = RTL_LOCALES.includes(locale);

  useEffect(() => {
    const savedUnitSystem = localStorage.getItem("unitSystem");
    if (savedUnitSystem === "SI" || savedUnitSystem === "Imperial") setUnitSystem(savedUnitSystem);
    const savedLocale = localStorage.getItem("pipeflowLocale");
    if (["en", "fa", "ar", "es", "de"].includes(savedLocale ?? "")) setLocaleState(savedLocale as AppLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
  }, [locale]);

  const handleSetUnitSystem = (system: UnitSystem) => {
    setUnitSystem(system);
    localStorage.setItem("unitSystem", system);
  };

  const handleSetLocale = (nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    localStorage.setItem("pipeflowLocale", nextLocale);
  };

  const value = useMemo<UnitContextType>(() => ({
    unitSystem,
    setUnitSystem: handleSetUnitSystem,
    toggleUnitSystem: () => handleSetUnitSystem(unitSystem === "SI" ? "Imperial" : "SI"),
    locale,
    setLocale: handleSetLocale,
    isRtl,
    formatNumber: (number, options) => new Intl.NumberFormat(locale, options).format(number),
    formatDate: (date, options) => new Intl.DateTimeFormat(locale, options).format(typeof date === "string" ? new Date(date) : date),
  }), [unitSystem, locale, isRtl]);

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

export function useUnits() {
  const context = useContext(UnitContext);
  if (!context) throw new Error("useUnits must be used within UnitProvider");
  return context;
}
