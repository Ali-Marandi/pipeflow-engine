import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UnitToggle } from "@/components/UnitToggle";
import { PressureDropChart } from "@/components/PressureDropChart";
import { useUnits } from "@/contexts/UnitContext";
import {
  velocity,
  reynolds,
  friction_factor,
  head_loss,
} from "../../../server/pipeflowCalculations";
import {
  convertDiameter,
  convertLength,
  convertFlowRate,
  convertRoughness,
  convertVelocity,
  convertHeadLoss,
  getUnitLabel,
} from "@shared/unitConversion";

const FLUIDS = {
  water: { name: "Water (20°C)", viscosity: 1e-6, density: 998 },
  oil: { name: "Oil (ISO VG 32)", viscosity: 32e-6, density: 860 },
  air: { name: "Air (20°C)", viscosity: 15.1e-6, density: 1.2 },
};

const PIPE_MATERIALS = {
  steel: { name: "Steel (Commercial)", roughness: 0.000045 },
  pvc: { name: "PVC", roughness: 0.0000015 },
  copper: { name: "Copper", roughness: 0.0000015 },
  concrete: { name: "Concrete", roughness: 0.0003 },
};

interface Results {
  velocity: number;
  reynolds: number;
  frictionFactor: number;
  headLoss: number;
}

export default function CalculatorV2() {
  const { unitSystem } = useUnits();
  const [diameter, setDiameter] = useState("0.1");
  const [length, setLength] = useState("100");
  const [flowRate, setFlowRate] = useState("0.01");
  const [selectedFluid, setSelectedFluid] = useState("water");
  const [selectedMaterial, setSelectedMaterial] = useState("steel");
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = () => {
    try {
      setError(null);

      // Convert inputs from display units to SI
      const diameterSI = convertDiameter(
        parseFloat(diameter),
        unitSystem,
        "SI"
      );
      const lengthSI = convertLength(parseFloat(length), unitSystem, "SI");
      const flowRateSI = convertFlowRate(parseFloat(flowRate), unitSystem, "SI");

      const fluid = FLUIDS[selectedFluid as keyof typeof FLUIDS];
      const material = PIPE_MATERIALS[selectedMaterial as keyof typeof PIPE_MATERIALS];

      // Calculate in SI units
      const vel = velocity(flowRateSI, diameterSI);
      const re = reynolds(vel, diameterSI, fluid.viscosity);
      const relRoughness = material.roughness / diameterSI;
      const f = friction_factor(re, relRoughness);
      const hLoss = head_loss(lengthSI, diameterSI, vel, f);

      // Convert results to display units
      setResults({
        velocity: convertVelocity(vel, "SI", unitSystem),
        reynolds: re,
        frictionFactor: f,
        headLoss: convertHeadLoss(hLoss, "SI", unitSystem),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation failed");
      setResults(null);
    }
  };

  const diameterUnit = getUnitLabel("diameter", unitSystem);
  const lengthUnit = getUnitLabel("length", unitSystem);
  const flowRateUnit = getUnitLabel("flowRate", unitSystem);
  const velocityUnit = getUnitLabel("velocity", unitSystem);
  const headLossUnit = getUnitLabel("headLoss", unitSystem);

  return (
    <div className="space-y-6">
      {/* Header with Unit Toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-accent">Calculator</h1>
        <UnitToggle />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Pipe Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="diameter">
                Pipe Diameter ({diameterUnit})
              </Label>
              <Input
                id="diameter"
                type="number"
                step="0.01"
                value={diameter}
                onChange={(e) => setDiameter(e.target.value)}
                className="bg-background border-border text-foreground"
              />
            </div>

            <div>
              <Label htmlFor="length">
                Pipe Length ({lengthUnit})
              </Label>
              <Input
                id="length"
                type="number"
                step="1"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="bg-background border-border text-foreground"
              />
            </div>

            <div>
              <Label htmlFor="flowRate">
                Flow Rate ({flowRateUnit})
              </Label>
              <Input
                id="flowRate"
                type="number"
                step="0.001"
                value={flowRate}
                onChange={(e) => setFlowRate(e.target.value)}
                className="bg-background border-border text-foreground"
              />
            </div>

            <div>
              <Label htmlFor="fluid">Fluid Type</Label>
              <Select value={selectedFluid} onValueChange={setSelectedFluid}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {Object.entries(FLUIDS).map(([key, fluid]) => (
                    <SelectItem key={key} value={key}>
                      {fluid.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="material">Pipe Material</Label>
              <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border-border">
                  {Object.entries(PIPE_MATERIALS).map(([key, material]) => (
                    <SelectItem key={key} value={key}>
                      {material.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleCalculate}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              Calculate
            </Button>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            {results ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-background rounded border border-border">
                    <p className="text-xs text-muted-foreground">Velocity</p>
                    <p className="text-lg font-bold text-accent">
                      {results.velocity.toFixed(3)} {velocityUnit}
                    </p>
                  </div>

                  <div className="p-3 bg-background rounded border border-border">
                    <p className="text-xs text-muted-foreground">Reynolds Number</p>
                    <p className="text-lg font-bold text-accent">
                      {results.reynolds.toFixed(0)}
                    </p>
                  </div>

                  <div className="p-3 bg-background rounded border border-border">
                    <p className="text-xs text-muted-foreground">Friction Factor</p>
                    <p className="text-lg font-bold text-accent">
                      {results.frictionFactor.toFixed(4)}
                    </p>
                  </div>

                  <div className="p-3 bg-background rounded border border-border">
                    <p className="text-xs text-muted-foreground">Head Loss</p>
                    <p className="text-lg font-bold text-accent">
                      {results.headLoss.toFixed(4)} {headLossUnit}
                    </p>
                  </div>
                </div>

                {/* Flow Regime Indicator */}
                <div className="p-3 bg-background rounded border border-border">
                  <p className="text-xs text-muted-foreground">Flow Regime</p>
                  <p className="text-sm font-semibold">
                    {results.reynolds < 2300
                      ? "Laminar"
                      : results.reynolds < 4000
                        ? "Transitional"
                        : "Turbulent"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                Enter parameters and click Calculate to see results
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pressure Drop Chart */}
      {results && (
        <PressureDropChart
          diameter={convertDiameter(parseFloat(diameter), unitSystem, "SI")}
          length={convertLength(parseFloat(length), unitSystem, "SI")}
          roughness={
            PIPE_MATERIALS[selectedMaterial as keyof typeof PIPE_MATERIALS]
              .roughness
          }
          kinematicViscosity={
            FLUIDS[selectedFluid as keyof typeof FLUIDS].viscosity
          }
        />
      )}
    </div>
  );
}
