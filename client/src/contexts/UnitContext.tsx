import React, { createContext, useContext, useState, useEffect } from "react";
import { UnitSystem } from "@shared/unitConversion";

interface UnitContextType {
  unitSystem: UnitSystem;
  setUnitSystem: (system: UnitSystem) => void;
  toggleUnitSystem: () => void;
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("SI");

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("unitSystem");
    if (saved === "SI" || saved === "Imperial") {
      setUnitSystem(saved);
    }
  }, []);

  // Save to localStorage when changed
  const handleSetUnitSystem = (system: UnitSystem) => {
    setUnitSystem(system);
    localStorage.setItem("unitSystem", system);
  };

  const toggleUnitSystem = () => {
    const newSystem: UnitSystem = unitSystem === "SI" ? "Imperial" : "SI";
    handleSetUnitSystem(newSystem);
  };

  return (
    <UnitContext.Provider
      value={{
        unitSystem,
        setUnitSystem: handleSetUnitSystem,
        toggleUnitSystem,
      }}
    >
      {children}
    </UnitContext.Provider>
  );
}

export function useUnits() {
  const context = useContext(UnitContext);
  if (!context) {
    throw new Error("useUnits must be used within UnitProvider");
  }
  return context;
}
