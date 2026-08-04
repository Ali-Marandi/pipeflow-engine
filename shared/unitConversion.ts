/**
 * Unit Conversion Utilities
 * Converts between SI (metric) and Imperial units for hydraulic calculations
 */

export type UnitSystem = "SI" | "Imperial";

export interface UnitConversionFactors {
  diameter: { SI: string; Imperial: string; factor: number };
  length: { SI: string; Imperial: string; factor: number };
  flowRate: { SI: string; Imperial: string; factor: number };
  velocity: { SI: string; Imperial: string; factor: number };
  headLoss: { SI: string; Imperial: string; factor: number };
  roughness: { SI: string; Imperial: string; factor: number };
  viscosity: { SI: string; Imperial: string; factor: number };
}

export const UNIT_FACTORS: UnitConversionFactors = {
  diameter: {
    SI: "m",
    Imperial: "in",
    factor: 39.3701, // 1 m = 39.3701 inches
  },
  length: {
    SI: "m",
    Imperial: "ft",
    factor: 3.28084, // 1 m = 3.28084 feet
  },
  flowRate: {
    SI: "m³/s",
    Imperial: "gal/min",
    factor: 15850.4, // 1 m³/s = 15850.4 gal/min
  },
  velocity: {
    SI: "m/s",
    Imperial: "ft/s",
    factor: 3.28084, // 1 m/s = 3.28084 ft/s
  },
  headLoss: {
    SI: "m",
    Imperial: "ft",
    factor: 3.28084, // 1 m = 3.28084 feet
  },
  roughness: {
    SI: "m",
    Imperial: "in",
    factor: 39.3701, // 1 m = 39.3701 inches
  },
  viscosity: {
    SI: "m²/s",
    Imperial: "ft²/s",
    factor: 10.7639, // 1 m²/s = 10.7639 ft²/s
  },
};

/**
 * Convert diameter from SI to Imperial or vice versa
 */
export function convertDiameter(
  value: number,
  from: UnitSystem,
  to: UnitSystem
): number {
  if (from === to) return value;
  if (from === "SI" && to === "Imperial") {
    return value * UNIT_FACTORS.diameter.factor;
  }
  return value / UNIT_FACTORS.diameter.factor;
}

/**
 * Convert length from SI to Imperial or vice versa
 */
export function convertLength(
  value: number,
  from: UnitSystem,
  to: UnitSystem
): number {
  if (from === to) return value;
  if (from === "SI" && to === "Imperial") {
    return value * UNIT_FACTORS.length.factor;
  }
  return value / UNIT_FACTORS.length.factor;
}

/**
 * Convert flow rate from SI to Imperial or vice versa
 */
export function convertFlowRate(
  value: number,
  from: UnitSystem,
  to: UnitSystem
): number {
  if (from === to) return value;
  if (from === "SI" && to === "Imperial") {
    return value * UNIT_FACTORS.flowRate.factor;
  }
  return value / UNIT_FACTORS.flowRate.factor;
}

/**
 * Convert velocity from SI to Imperial or vice versa
 */
export function convertVelocity(
  value: number,
  from: UnitSystem,
  to: UnitSystem
): number {
  if (from === to) return value;
  if (from === "SI" && to === "Imperial") {
    return value * UNIT_FACTORS.velocity.factor;
  }
  return value / UNIT_FACTORS.velocity.factor;
}

/**
 * Convert head loss from SI to Imperial or vice versa
 */
export function convertHeadLoss(
  value: number,
  from: UnitSystem,
  to: UnitSystem
): number {
  if (from === to) return value;
  if (from === "SI" && to === "Imperial") {
    return value * UNIT_FACTORS.headLoss.factor;
  }
  return value / UNIT_FACTORS.headLoss.factor;
}

/**
 * Convert roughness from SI to Imperial or vice versa
 */
export function convertRoughness(
  value: number,
  from: UnitSystem,
  to: UnitSystem
): number {
  if (from === to) return value;
  if (from === "SI" && to === "Imperial") {
    return value * UNIT_FACTORS.roughness.factor;
  }
  return value / UNIT_FACTORS.roughness.factor;
}

/**
 * Convert kinematic viscosity from SI to Imperial or vice versa
 */
export function convertViscosity(
  value: number,
  from: UnitSystem,
  to: UnitSystem
): number {
  if (from === to) return value;
  if (from === "SI" && to === "Imperial") {
    return value * UNIT_FACTORS.viscosity.factor;
  }
  return value / UNIT_FACTORS.viscosity.factor;
}

/**
 * Get unit label for a given parameter and system
 */
export function getUnitLabel(
  parameter: keyof UnitConversionFactors,
  system: UnitSystem
): string {
  return system === "SI"
    ? UNIT_FACTORS[parameter].SI
    : UNIT_FACTORS[parameter].Imperial;
}

/**
 * Convert all input parameters from one unit system to another
 */
export function convertAllInputs(
  inputs: {
    diameter: number;
    length: number;
    flowRate: number;
    roughness: number;
  },
  from: UnitSystem,
  to: UnitSystem
) {
  if (from === to) return inputs;

  return {
    diameter: convertDiameter(inputs.diameter, from, to),
    length: convertLength(inputs.length, from, to),
    flowRate: convertFlowRate(inputs.flowRate, from, to),
    roughness: convertRoughness(inputs.roughness, from, to),
  };
}

/**
 * Convert all output results from one unit system to another
 */
export function convertAllResults(
  results: {
    velocity: number;
    reynolds: number;
    frictionFactor: number;
    headLoss: number;
  },
  from: UnitSystem,
  to: UnitSystem
) {
  if (from === to) return results;

  return {
    velocity: convertVelocity(results.velocity, from, to),
    reynolds: results.reynolds, // Reynolds is dimensionless
    frictionFactor: results.frictionFactor, // Friction factor is dimensionless
    headLoss: convertHeadLoss(results.headLoss, from, to),
  };
}
