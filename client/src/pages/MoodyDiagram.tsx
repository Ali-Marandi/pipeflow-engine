import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Scatter, ScatterChart } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function MoodyDiagram() {
  const [relativeRoughness, setRelativeRoughness] = useState(0.00001);

  // Generate Moody diagram data
  const moodyData = useMemo(() => {
    const data: any[] = [];
    const reValues = [100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000, 3000000];
    const roughnessValues = [0, 0.000001, 0.000005, 0.00001, 0.00005, 0.0001, 0.0002, 0.0004, 0.0006, 0.0008, 0.001];

    // Laminar flow line (f = 64/Re)
    for (let i = 0; i < reValues.length; i++) {
      const re = reValues[i];
      if (re < 2300) {
        data.push({
          re,
          laminar: 64 / re,
          type: 'laminar',
        });
      }
    }

    // Turbulent flow curves (Swamee-Jain approximation)
    roughnessValues.forEach((roughness) => {
      for (let i = 0; i < reValues.length; i++) {
        const re = reValues[i];
        if (re >= 2300) {
          const relRough = roughness;
          const frictionFactor = 0.25 / Math.log10(relRough / 3.7 + 5.74 / Math.pow(re, 0.9)) ** 2;
          data.push({
            re,
            friction: frictionFactor,
            roughness: roughness.toExponential(1),
          });
        }
      }
    });

    return data;
  }, []);

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Moody Diagram</CardTitle>
          <CardDescription>Darcy-Weisbach friction factor vs. Reynolds number</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roughness">Relative Roughness (ε/D)</Label>
            <Input
              id="roughness"
              type="number"
              step="0.000001"
              value={relativeRoughness}
              onChange={(e) => setRelativeRoughness(parseFloat(e.target.value))}
              className="bg-input border-border"
            />
          </div>

          <div className="w-full h-96 bg-background rounded-lg p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={moodyData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.2 0.01 260)" />
                <XAxis
                  dataKey="re"
                  scale="log"
                  type="number"
                  label={{ value: 'Reynolds Number (Re)', position: 'insideBottomRight', offset: -5 }}
                  stroke="oklch(0.95 0.01 65)"
                />
                <YAxis
                  scale="log"
                  label={{ value: 'Friction Factor (f)', angle: -90, position: 'insideLeft' }}
                  stroke="oklch(0.95 0.01 65)"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'oklch(0.12 0.01 260)',
                    border: '1px solid oklch(0.2 0.01 260)',
                    color: 'oklch(0.95 0.01 65)',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="laminar"
                  stroke="oklch(0.6 0.2 260)"
                  name="Laminar (f=64/Re)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="friction"
                  stroke="oklch(0.55 0.2 260)"
                  name="Turbulent"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-muted-foreground">Laminar Region</p>
              <p className="text-foreground font-semibold">Re &lt; 2300</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-muted-foreground">Turbulent Region</p>
              <p className="text-foreground font-semibold">Re &gt; 4000</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
