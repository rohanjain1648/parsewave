/**
 * One-directional adaptive quality: if the render frame rate stays below
 * budget for a sustained window, step graphics quality down once — never
 * back up mid-run, which would show as a visible quality flicker. Reset to
 * max quality at the start of each run so a bad patch doesn't linger forever.
 */
export class PerfScaler {
  private tier = 0;
  private windowT = 0;
  private windowFrames = 0;
  private windowSlow = 0;

  constructor(
    private readonly maxTier: number,
    private readonly onDowngrade: (tier: number) => void,
  ) {}

  reset(): void {
    this.tier = 0;
    this.windowT = 0;
    this.windowFrames = 0;
    this.windowSlow = 0;
  }

  /** Feed one frame's render delta (seconds). Call once per rendered frame. */
  sample(rdt: number): void {
    if (this.tier >= this.maxTier) return;

    this.windowT += rdt;
    this.windowFrames++;
    if (rdt > 1 / 40) this.windowSlow++; // frame missed a 40fps budget

    if (this.windowT < 2) return;
    // Sustained: over half the frames in this 2s window missed budget.
    if (this.windowFrames > 0 && this.windowSlow / this.windowFrames > 0.5) {
      this.tier++;
      this.onDowngrade(this.tier);
    }
    this.windowT = 0;
    this.windowFrames = 0;
    this.windowSlow = 0;
  }
}
