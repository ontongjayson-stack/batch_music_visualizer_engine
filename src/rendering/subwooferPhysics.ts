/**
 * Subwoofer Physical Cone Excursion Physics Model
 * Batch Music Visualizer Engine
 *
 * Implements a damped driven spring-mass oscillator system:
 * m * x'' + c * x' + k * x = F(t)
 */

export interface SubwooferPhysicsState {
  displacement: number; // 0.0 to 1.0 (cone excursion depth)
  velocity: number;
  surroundStretch: number; // dynamic rubber surround bulge factor
  specularShiftX: number;
  specularShiftY: number;
}

export class SubwooferPhysics {
  private displacement: number = 0.0;
  private velocity: number = 0.0;

  // Spring-mass-damper constants
  private mass: number = 1.0;
  private stiffness: number = 180.0; // Fast snap back stiffness
  private damping: number = 18.0;   // Critical damping (~0.7 ratio) to eliminate jitter

  /**
   * Updates physical cone state given frame delta time and driving force signals.
   * @param dt Delta time in seconds (e.g., 1 / fps)
   * @param subBass Sub-bass energy (20-120Hz, normalized 0 to 1)
   * @param kickTransient Kick punch transient onset (normalized 0 to 1)
   * @param bassReactivity Sensitivity multiplier
   */
  public update(
    dt: number,
    subBass: number,
    kickTransient: number,
    bassReactivity: number = 1.4
  ): SubwooferPhysicsState {
    const clampedSub = Math.max(0, Math.min(1, subBass));
    const clampedKick = Math.max(0, Math.min(1, kickTransient));

    // Calculate total external acoustic driving force
    const drivingForce = (clampedKick * 0.75 + clampedSub * 0.45) * bassReactivity * 120.0;

    // Acceleration: a = (F_ext - c*v - k*x) / m
    const springForce = -this.stiffness * this.displacement;
    const dampingForce = -this.damping * this.velocity;
    const netForce = drivingForce + springForce + dampingForce;
    const acceleration = netForce / this.mass;

    // Euler-Cromer integration for energy stability
    this.velocity += acceleration * dt;
    this.displacement += this.velocity * dt;

    // Physical hard stops (cone spider mechanical limit)
    if (this.displacement < 0) {
      this.displacement = 0;
      this.velocity = Math.max(0, this.velocity);
    } else if (this.displacement > 1.2) {
      this.displacement = 1.2;
      this.velocity = Math.min(0, this.velocity);
    }

    const normalizedDisp = Math.min(1.0, this.displacement);

    return {
      displacement: normalizedDisp,
      velocity: this.velocity,
      surroundStretch: 1.0 + normalizedDisp * 0.15,
      specularShiftX: normalizedDisp * 8.0,
      specularShiftY: normalizedDisp * -6.0,
    };
  }

  public reset(): void {
    this.displacement = 0;
    this.velocity = 0;
  }
}
