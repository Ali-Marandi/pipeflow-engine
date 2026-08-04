

export function reynolds(velocity_m_s: number, diameter_m: number, kinematic_viscosity: number): number {
    if (velocity_m_s < 0 || diameter_m <= 0 || kinematic_viscosity <= 0) {
        throw new Error("invalid hydraulic input");
    }
    return velocity_m_s * diameter_m / kinematic_viscosity;
}

export function friction_factor(re: number, relative_roughness: number = 0.0): number {
    if (re <= 0 || relative_roughness < 0) {
        throw new Error("invalid Reynolds number or roughness");
    }
    if (re < 2300) {
        return 64 / re;
    }
    return 0.25 / Math.log10(relative_roughness / 3.7 + 5.74 / re**0.9) ** 2;
}

export function velocity(flow_m3_s: number, diameter_m: number): number {
    if (flow_m3_s < 0 || diameter_m <= 0) {
        throw new Error("invalid flow or diameter");
    }
    return flow_m3_s / (Math.PI * diameter_m**2 / 4);
}

export function head_loss(length_m: number, diameter_m: number, speed_m_s: number, factor: number, g: number = 9.80665): number {
    if (Math.min(length_m, diameter_m, g) <= 0 || speed_m_s < 0 || factor < 0) {
        throw new Error("invalid head-loss input");
    }
    return factor * length_m / diameter_m * speed_m_s**2 / (2 * g);
}
