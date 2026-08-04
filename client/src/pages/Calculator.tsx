import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UnitToggle } from '@/components/UnitToggle';
import { PressureDropChart } from '@/components/PressureDropChart';
import { useUnits } from '@/contexts/UnitContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  convertDiameter,
  convertLength,
  convertFlowRate,
  convertVelocity,
  convertHeadLoss,
  getUnitLabel,
} from '@shared/unitConversion';

const PRESET_FLUIDS = [
  { name: 'Water (20°C)', kinematicViscosity: 1e-6, density: 998 },
  { name: 'Oil (ISO VG 32)', kinematicViscosity: 32e-6, density: 860 },
  { name: 'Air (20°C)', kinematicViscosity: 15.1e-6, density: 1.2 },
];

const PRESET_MATERIALS = [
  { name: 'Steel (Commercial)', roughness: 0.000045 },
  { name: 'PVC', roughness: 0.0000015 },
  { name: 'Copper', roughness: 0.0000015 },
  { name: 'Concrete', roughness: 0.0003 },
];

export default function Calculator() {
  const { unitSystem } = useUnits();
  const [inputs, setInputs] = useState({
    pipeDiameter: 0.1,
    pipeLength: 100,
    flowRate: 0.01,
    fluidKinematicViscosity: 1e-6,
    pipeRoughness: 0.000045,
  });

  const [results, setResults] = useState<any>(null);
  const [calculationName, setCalculationName] = useState('');

  const calculateMutation = trpc.pipeflow.calculateDarcyWeisbach.useMutation({
    onSuccess: (data) => {
      setResults(data);
      toast.success('Calculation completed');
    },
    onError: (error) => {
      toast.error(`Calculation error: ${error.message}`);
    },
  });

  const saveMutation = trpc.pipeflow.saveCalculation.useMutation({
    onSuccess: () => {
      toast.success('Calculation saved');
      setCalculationName('');
    },
    onError: (error) => {
      toast.error(`Save error: ${error.message}`);
    },
  });

  const handleCalculate = () => {
    calculateMutation.mutate(inputs);
  };

  const handleSave = () => {
    if (!calculationName.trim()) {
      toast.error('Please enter a name for this calculation');
      return;
    }
    if (!results) {
      toast.error('Please calculate first');
      return;
    }
    saveMutation.mutate({
      name: calculationName,
      inputs,
      results,
    });
  };

  // Get unit labels for display
  const diameterUnit = getUnitLabel('diameter', unitSystem);
  const lengthUnit = getUnitLabel('length', unitSystem);
  const flowRateUnit = getUnitLabel('flowRate', unitSystem);
  const velocityUnit = getUnitLabel('velocity', unitSystem);
  const headLossUnit = getUnitLabel('headLoss', unitSystem);

  // Convert display values
  const displayDiameter = convertDiameter(inputs.pipeDiameter, 'SI', unitSystem);
  const displayLength = convertLength(inputs.pipeLength, 'SI', unitSystem);
  const displayFlowRate = convertFlowRate(inputs.flowRate, 'SI', unitSystem);

  return (
    <div className="space-y-6">
      {/* Header with Unit Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-accent">Calculator</h2>
        <UnitToggle />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-1">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Pipe Parameters</CardTitle>
              <CardDescription>Enter your pipe flow parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pipe Diameter */}
              <div className="space-y-2">
                <Label htmlFor="diameter">Pipe Diameter ({diameterUnit})</Label>
                <Input
                  id="diameter"
                  type="number"
                  step="0.001"
                  value={displayDiameter.toFixed(4)}
                  onChange={(e) => setInputs({ ...inputs, pipeDiameter: convertDiameter(parseFloat(e.target.value), unitSystem, 'SI') })}
                  className="bg-input border-border"
                />
              </div>

              {/* Pipe Length */}
              <div className="space-y-2">
                <Label htmlFor="length">Pipe Length ({lengthUnit})</Label>
                <Input
                  id="length"
                  type="number"
                  step="1"
                  value={displayLength.toFixed(2)}
                  onChange={(e) => setInputs({ ...inputs, pipeLength: convertLength(parseFloat(e.target.value), unitSystem, 'SI') })}
                  className="bg-input border-border"
                />
              </div>

              {/* Flow Rate */}
              <div className="space-y-2">
                <Label htmlFor="flow">Flow Rate ({flowRateUnit})</Label>
                <Input
                  id="flow"
                  type="number"
                  step="0.0001"
                  value={displayFlowRate.toFixed(4)}
                  onChange={(e) => setInputs({ ...inputs, flowRate: convertFlowRate(parseFloat(e.target.value), unitSystem, 'SI') })}
                  className="bg-input border-border"
                />
              </div>

              {/* Fluid Selection */}
              <div className="space-y-2">
                <Label htmlFor="fluid">Fluid Type</Label>
                <Select
                  value={inputs.fluidKinematicViscosity.toString()}
                  onValueChange={(value) => setInputs({ ...inputs, fluidKinematicViscosity: parseFloat(value) })}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_FLUIDS.map((fluid) => (
                      <SelectItem key={fluid.name} value={fluid.kinematicViscosity.toString()}>
                        {fluid.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Material Selection */}
              <div className="space-y-2">
                <Label htmlFor="material">Pipe Material</Label>
                <Select
                  value={inputs.pipeRoughness.toString()}
                  onValueChange={(value) => setInputs({ ...inputs, pipeRoughness: parseFloat(value) })}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_MATERIALS.map((material) => (
                      <SelectItem key={material.name} value={material.roughness.toString()}>
                        {material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Calculate Button */}
              <Button
                onClick={handleCalculate}
                disabled={calculateMutation.isPending}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {calculateMutation.isPending ? 'Calculating...' : 'Calculate'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {results ? (
            <div className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Calculation Results</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Velocity</Label>
                    <p className="text-2xl font-bold text-accent">
                      {convertVelocity(results.velocity, 'SI', unitSystem).toFixed(4)} {velocityUnit}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Reynolds Number</Label>
                    <p className="text-2xl font-bold text-accent">{results.reynoldsNumber.toFixed(0)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Friction Factor</Label>
                    <p className="text-2xl font-bold text-accent">{results.frictionFactor.toFixed(6)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Head Loss</Label>
                    <p className="text-2xl font-bold text-accent">
                      {convertHeadLoss(results.headLoss, 'SI', unitSystem).toFixed(4)} {headLossUnit}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Flow Regime Indicator */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Flow Regime</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold text-accent">
                    {results.reynoldsNumber < 2300
                      ? 'Laminar'
                      : results.reynoldsNumber < 4000
                        ? 'Transitional'
                        : 'Turbulent'}
                  </p>
                </CardContent>
              </Card>

              {/* Save Calculation */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Save Calculation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Enter calculation name"
                    value={calculationName}
                    onChange={(e) => setCalculationName(e.target.value)}
                    className="bg-input border-border"
                  />
                  <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save Calculation'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="bg-card border-border h-full flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground">
                <p>Enter parameters and click Calculate to see results</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Pressure Drop Chart */}
      {results && (
        <PressureDropChart
          diameter={inputs.pipeDiameter}
          length={inputs.pipeLength}
          roughness={inputs.pipeRoughness}
          kinematicViscosity={inputs.fluidKinematicViscosity}
        />
      )}
    </div>
  );
}
