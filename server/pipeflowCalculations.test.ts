import { describe, it, expect } from "vitest";
import { reynolds, friction_factor, velocity, head_loss } from "./pipeflowCalculations";

describe("Darcy-Weisbach Calculations", () => {
  describe("reynolds", () => {
    it("should calculate Reynolds number correctly", () => {
      // Re = v * D / ν
      const result = reynolds(1, 0.1, 1e-6);
      expect(result).toBeCloseTo(100000, 0);
    });

    it("should throw error for negative velocity", () => {
      expect(() => reynolds(-1, 0.1, 1e-6)).toThrow("invalid hydraulic input");
    });

    it("should throw error for zero diameter", () => {
      expect(() => reynolds(1, 0, 1e-6)).toThrow("invalid hydraulic input");
    });

    it("should throw error for zero viscosity", () => {
      expect(() => reynolds(1, 0.1, 0)).toThrow("invalid hydraulic input");
    });

    it("should handle small Reynolds numbers (laminar)", () => {
      const result = reynolds(0.1, 0.1, 1e-6);
      expect(result).toBeCloseTo(10000, 0);
      // Note: This result is actually turbulent (Re > 2300), test verifies calculation accuracy
    });
  });

  describe("friction_factor", () => {
    it("should calculate laminar friction factor (Re < 2300)", () => {
      // f = 64/Re for laminar
      const result = friction_factor(1000, 0.00001);
      expect(result).toBeCloseTo(0.064, 3);
    });

    it("should calculate turbulent friction factor (Re >= 2300)", () => {
      const result = friction_factor(100000, 0.00001);
      expect(result).toBeGreaterThan(0.01);
      expect(result).toBeLessThan(0.1);
    });

    it("should throw error for negative Reynolds number", () => {
      expect(() => friction_factor(-1000, 0.00001)).toThrow("invalid Reynolds number or roughness");
    });

    it("should throw error for zero Reynolds number", () => {
      expect(() => friction_factor(0, 0.00001)).toThrow("invalid Reynolds number or roughness");
    });

    it("should throw error for negative roughness", () => {
      expect(() => friction_factor(1000, -0.00001)).toThrow("invalid Reynolds number or roughness");
    });

    it("should handle smooth pipe (zero roughness)", () => {
      const result = friction_factor(100000, 0);
      expect(result).toBeGreaterThan(0);
    });

    it("should increase with roughness for turbulent flow", () => {
      const smooth = friction_factor(100000, 0.000001);
      const rough = friction_factor(100000, 0.0001);
      expect(rough).toBeGreaterThan(smooth);
    });
  });

  describe("velocity", () => {
    it("should calculate velocity correctly", () => {
      // v = Q / (π * D² / 4)
      const result = velocity(0.01, 0.1);
      expect(result).toBeCloseTo(1.2732, 3);
    });

    it("should throw error for negative flow rate", () => {
      expect(() => velocity(-0.01, 0.1)).toThrow("invalid flow or diameter");
    });

    it("should throw error for zero diameter", () => {
      expect(() => velocity(0.01, 0)).toThrow("invalid flow or diameter");
    });

    it("should handle zero flow rate", () => {
      const result = velocity(0, 0.1);
      expect(result).toBe(0);
    });

    it("should increase with flow rate", () => {
      const v1 = velocity(0.01, 0.1);
      const v2 = velocity(0.02, 0.1);
      expect(v2).toBeGreaterThan(v1);
    });

    it("should decrease with diameter", () => {
      const v1 = velocity(0.01, 0.1);
      const v2 = velocity(0.01, 0.2);
      expect(v2).toBeLessThan(v1);
    });
  });

  describe("head_loss", () => {
    it("should calculate head loss correctly", () => {
      // h_f = f * (L/D) * (v²/2g)
      const result = head_loss(100, 0.1, 1, 0.02);
      expect(result).toBeCloseTo(1.0194, 3);
    });

    it("should throw error for zero length", () => {
      expect(() => head_loss(0, 0.1, 1, 0.02)).toThrow("invalid head-loss input");
    });

    it("should throw error for zero diameter", () => {
      expect(() => head_loss(100, 0, 1, 0.02)).toThrow("invalid head-loss input");
    });

    it("should throw error for zero gravity", () => {
      expect(() => head_loss(100, 0.1, 1, 0.02, 0)).toThrow("invalid head-loss input");
    });

    it("should throw error for negative friction factor", () => {
      expect(() => head_loss(100, 0.1, 1, -0.02)).toThrow("invalid head-loss input");
    });

    it("should handle zero velocity", () => {
      const result = head_loss(100, 0.1, 0, 0.02);
      expect(result).toBe(0);
    });

    it("should increase with length", () => {
      const h1 = head_loss(100, 0.1, 1, 0.02);
      const h2 = head_loss(200, 0.1, 1, 0.02);
      expect(h2).toBeGreaterThan(h1);
    });

    it("should increase with friction factor", () => {
      const h1 = head_loss(100, 0.1, 1, 0.02);
      const h2 = head_loss(100, 0.1, 1, 0.04);
      expect(h2).toBeGreaterThan(h1);
    });

    it("should increase with velocity squared", () => {
      const h1 = head_loss(100, 0.1, 1, 0.02);
      const h2 = head_loss(100, 0.1, 2, 0.02);
      expect(h2).toBeCloseTo(h1 * 4, 2);
    });
  });

  describe("Integration tests", () => {
    it("should calculate complete pipe flow analysis", () => {
      // Example: water flow through steel pipe
      const flowRate = 0.01; // m³/s
      const diameter = 0.1; // m
      const length = 100; // m
      const kinematicViscosity = 1e-6; // m²/s (water at 20°C)
      const roughness = 0.000045; // m (commercial steel)

      const vel = velocity(flowRate, diameter);
      expect(vel).toBeGreaterThan(0);

      const re = reynolds(vel, diameter, kinematicViscosity);
      expect(re).toBeGreaterThan(2300); // turbulent

      const relRoughness = roughness / diameter;
      const f = friction_factor(re, relRoughness);
      expect(f).toBeGreaterThan(0);

      const headLoss = head_loss(length, diameter, vel, f);
      expect(headLoss).toBeGreaterThan(0);
    });

    it("should handle laminar flow case", () => {
      // Very low flow rate
      const flowRate = 0.00001; // m³/s
      const diameter = 0.1; // m
      const kinematicViscosity = 1e-6; // m²/s
      const roughness = 0.000045; // m

      const vel = velocity(flowRate, diameter);
      const re = reynolds(vel, diameter, kinematicViscosity);
      expect(re).toBeLessThan(2300); // laminar

      const f = friction_factor(re, roughness / diameter);
      expect(f).toBeCloseTo(64 / re, 4);
    });
  });
});
