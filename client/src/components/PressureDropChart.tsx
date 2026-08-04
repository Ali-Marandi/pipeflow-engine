import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUnits } from "@/contexts/UnitContext";
import {
  velocity,
  reynolds,
  friction_factor,
  head_loss,
} from "../../../server/pipeflowCalculations";
import {
  convertFlowRate,
  convertHeadLoss,
  getUnitLabel,
} from "@shared/unitConversion";

interface PressureDropChartProps {
  diameter: number; // in meters (SI)
  length: number; // in meters (SI)
  roughness: number; // in meters (SI)
  kinematicViscosity: number; // in m²/s (SI)
}

export function PressureDropChart({
  diameter,
  length,
  roughness,
  kinematicViscosity,
}: PressureDropChartProps) {
  const { unitSystem } = useUnits();

  const chartData = useMemo(() => {
    const data = [];

    // Generate flow rates from 0.001 to 0.05 m³/s
    const flowRates = Array.from({ length: 50 }, (_, i) => 0.001 + (i * 0.049) / 49);

    for (const flowRate of flowRates) {
      try {
        const vel = velocity(flowRate, diameter);
        const re = reynolds(vel, diameter, kinematicViscosity);
        const relRoughness = roughness / diameter;
        const f = friction_factor(re, relRoughness);
        const headLoss = head_loss(length, diameter, vel, f);

        // Convert to display units
        const displayFlowRate = convertFlowRate(flowRate, "SI", unitSystem);
        const displayHeadLoss = convertHeadLoss(headLoss, "SI", unitSystem);

        data.push({
          flowRate: parseFloat(displayFlowRate.toFixed(2)),
          headLoss: parseFloat(displayHeadLoss.toFixed(4)),
          velocity: parseFloat(vel.toFixed(3)),
          reynolds: parseFloat(re.toFixed(0)),
        });
      } catch {
        // Skip invalid calculations
      }
    }

    return data;
  }, [diameter, length, roughness, kinematicViscosity, unitSystem]);

  const flowRateUnit = getUnitLabel("flowRate", unitSystem);
  const headLossUnit = getUnitLabel("headLoss", unitSystem);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-accent">Pressure Drop vs. Flow Rate</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.1)" />
              <XAxis
                dataKey="flowRate"
                label={{
                  value: `Flow Rate (${flowRateUnit})`,
                  position: "insideBottomRight",
                  offset: -5,
                }}
                stroke="rgba(255,255,255,0.5)"
              />
              <YAxis
                label={{
                  value: `Head Loss (${headLossUnit})`,
                  angle: -90,
                  position: "insideLeft",
                }}
                stroke="rgba(255,255,255,0.5)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid rgba(0, 255, 255, 0.3)",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => value.toFixed(4)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="headLoss"
                stroke="#00ffff"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data available. Please enter valid parameters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
