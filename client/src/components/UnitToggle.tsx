import React from "react";
import { Button } from "@/components/ui/button";
import { useUnits } from "@/contexts/UnitContext";
import { Gauge } from "lucide-react";

export function UnitToggle() {
  const { unitSystem, toggleUnitSystem } = useUnits();

  return (
    <Button
      onClick={toggleUnitSystem}
      variant="outline"
      className="gap-2 border-accent text-accent hover:bg-accent/10"
    >
      <Gauge className="w-4 h-4" />
      {unitSystem === "SI" ? "SI (Metric)" : "Imperial"}
    </Button>
  );
}
