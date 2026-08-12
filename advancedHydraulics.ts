import { head_loss, velocity } from "./pipeflowCalculations";

export interface FittingLoss {
  name: string;
  coefficient: number;
}

export interface HydraulicDesignResult {
  velocity: number;
  majorHeadLoss: number;
  minorHeadLoss: number;
  staticHead: number;
  totalHead: number;
  hydraulicPowerWatts: number;
  shaftPowerWatts: number;
  annualEnergyKwh: number;
}

export function minor_head_loss(speed_m_s: number, fittings: FittingLoss[], g = 9.80665): number {
  if (speed_m_s < 0 || g <= 0 || fittings.some((f) => !Number.isFinite(f.coefficient) || f.coefficient < 0)) {
    throw new Error("invalid minor-loss input");
  }
  return fittings.reduce((sum, fitting) => sum + fitting.coefficient, 0) * speed_m_s ** 2 / (2 * g);
}

export function total_head_loss(
  majorHeadLoss_m: number,
  speed_m_s: number,
  fittings: FittingLoss[],
  staticHead_m = 0,
  g = 9.80665,
): number {
  if (majorHeadLoss_m < 0 || staticHead_m < 0) throw new Error("invalid total-head input");
  return majorHeadLoss_m + minor_head_loss(speed_m_s, fittings, g) + staticHead_m;
}

export function hydraulic_design(
  flow_m3_s: number,
  diameter_m: number,
  length_m: number,
  frictionFactor: number,
  density_kg_m3: number,
  fittings: FittingLoss[] = [],
  staticHead_m = 0,
  pumpEfficiency = 0.75,
  operatingHoursPerYear = 0,
  electricityPricePerKwh = 0,
): HydraulicDesignResult {
  if (flow_m3_s < 0 || diameter_m <= 0 || length_m <= 0 || density_kg_m3 <= 0 || pumpEfficiency <= 0 || pumpEfficiency > 1 || operatingHoursPerYear < 0 || electricityPricePerKwh < 0) {
    throw new Error("invalid hydraulic design input");
  }
  const speed = velocity(flow_m3_s, diameter_m);
  const major = head_loss(length_m, diameter_m, speed, frictionFactor);
  const minor = minor_head_loss(speed, fittings);
  const total = total_head_loss(major, speed, fittings, staticHead_m);
  const hydraulicPower = density_kg_m3 * 9.80665 * flow_m3_s * total;
  const shaftPower = hydraulicPower / pumpEfficiency;
  const annualEnergyKwh = shaftPower * operatingHoursPerYear / 1000;
  return { velocity: speed, majorHeadLoss: major, minorHeadLoss: minor, staticHead: staticHead_m, totalHead: total, hydraulicPowerWatts: hydraulicPower, shaftPowerWatts: shaftPower, annualEnergyKwh };
}
