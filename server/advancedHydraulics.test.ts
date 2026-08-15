import { describe, expect, it } from "vitest";
import { hydraulic_design, minor_head_loss, total_head_loss } from "./advancedHydraulics";

describe("advanced hydraulic design", () => {
  const fittings = [{ name: "90-degree elbow", coefficient: 0.9 }, { name: "gate valve", coefficient: 0.2 }];

  it("calculates minor losses from fitting coefficients", () => {
    expect(minor_head_loss(2, fittings)).toBeCloseTo(1.1 * 4 / (2 * 9.80665), 8);
  });

  it("combines major, minor, and static head", () => {
    expect(total_head_loss(10, 2, fittings, 5)).toBeCloseTo(15 + 1.1 * 4 / (2 * 9.80665), 8);
  });

  it("returns pump sizing and annual energy metrics", () => {
    const result = hydraulic_design(0.01, 0.1, 100, 0.02, 998, fittings, 8, 0.8, 2000, 0.12);
    expect(result.velocity).toBeGreaterThan(0);
    expect(result.totalHead).toBeGreaterThan(result.majorHeadLoss);
    expect(result.shaftPowerWatts).toBeGreaterThan(result.hydraulicPowerWatts);
    expect(result.annualEnergyKwh).toBeGreaterThan(0);
  });
});
