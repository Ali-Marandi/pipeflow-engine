import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function About() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>About PipeFlow Pro Engine</CardTitle>
          <CardDescription>Professional hydraulic calculations for pipe flow analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-foreground">
          <p>
            PipeFlow Pro Engine is a comprehensive web-based application designed for engineers and professionals who need to perform accurate hydraulic calculations for circular pipe systems. Built on the Darcy-Weisbach equation, this tool provides real-time analysis of pipe flow dynamics.
          </p>

          <h3 className="text-lg font-semibold text-accent">Key Features</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-accent">•</span>
              <span><strong>Interactive Calculator:</strong> Real-time computation of velocity, Reynolds number, friction factor, and head loss</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">•</span>
              <span><strong>Moody Diagram:</strong> Visual representation of friction factor across laminar and turbulent flow regimes</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">•</span>
              <span><strong>Pipe Network Analysis:</strong> Multi-segment calculations for series and parallel configurations</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">•</span>
              <span><strong>Fluid Properties Database:</strong> Presets for water, oil, and air with custom fluid support</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">•</span>
              <span><strong>Material Database:</strong> Common pipe materials with standard roughness values</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">•</span>
              <span><strong>Calculation History:</strong> Save, name, and retrieve past calculations</span>
            </li>
            <li className="flex gap-2">
              <span className="text-accent">•</span>
              <span><strong>Export Functionality:</strong> Download results as CSV for documentation</span>
            </li>
          </ul>

          <h3 className="text-lg font-semibold text-accent mt-6">Darcy-Weisbach Equation</h3>
          <p className="text-sm">
            The application uses the Darcy-Weisbach equation to calculate head loss in pipes:
          </p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            h<sub>f</sub> = f × (L/D) × (v²/2g)
          </div>
          <p className="text-sm">
            Where: f is the friction factor, L is pipe length, D is pipe diameter, v is flow velocity, and g is gravitational acceleration.
          </p>

          <h3 className="text-lg font-semibold text-accent mt-6">Friction Factor Calculation</h3>
          <p className="text-sm">
            For laminar flow (Re &lt; 2300):
          </p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm mb-4">
            f = 64/Re
          </div>
          <p className="text-sm">
            For turbulent flow (Re ≥ 2300), the application uses the Swamee-Jain approximation:
          </p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            f = 0.25 / [log₁₀(ε/3.7D + 5.74/Re^0.9)]²
          </div>

          <h3 className="text-lg font-semibold text-accent mt-6">Technical Specifications</h3>
          <ul className="space-y-2 text-sm">
            <li><strong>Reynolds Number:</strong> Re = (v × D) / ν</li>
            <li><strong>Flow Velocity:</strong> v = Q / (π × D² / 4)</li>
            <li><strong>Gravitational Acceleration:</strong> g = 9.80665 m/s²</li>
            <li><strong>Relative Roughness:</strong> ε/D (ratio of absolute roughness to diameter)</li>
          </ul>

          <h3 className="text-lg font-semibold text-accent mt-6">User Authentication</h3>
          <p className="text-sm">
            PipeFlow Pro uses secure Manus OAuth authentication to protect your calculations and ensure your data persists across sessions. Your calculation history is stored securely and associated with your user account.
          </p>

          <div className="bg-accent/10 border border-accent rounded-lg p-4 mt-6">
            <p className="text-sm text-muted-foreground">
              <strong>Version:</strong> 1.0.0 | <strong>Last Updated:</strong> August 2026
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
