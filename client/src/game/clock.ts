/** Gameplay time starts at zero for each run; menus never move its deadlines. */
export const COMBAT_STEP_MS = 1000 / 60;
export const INTERRUPTION_THRESHOLD_MS = 250;

export class RunClock {
  private ticks = 0;
  private previousFrameAt: number | null = null;
  private pendingMs = 0;
  private graceMs = 0;
  private paused = true;

  get nowMs(): number {
    return this.ticks * COMBAT_STEP_MS;
  }

  get acceptingInput(): boolean {
    return !this.paused && this.graceMs === 0;
  }

  reset(realNow: number): void {
    this.ticks = 0;
    this.pendingMs = 0;
    this.resume(realNow);
  }

  pause(realNow: number): void {
    this.paused = true;
    this.pendingMs = 0;
    this.previousFrameAt = realNow;
  }

  resume(realNow: number, graceMs = 0): void {
    this.paused = false;
    this.previousFrameAt = realNow;
    this.graceMs = Number.isFinite(graceMs)
      ? Math.max(0, Math.min(1500, graceMs))
      : 0;
  }

  /** Returns true when a long gap requires an explicit, manual resume. */
  frame(realNow: number, update: (dtSeconds: number) => void): boolean {
    const elapsed =
      this.previousFrameAt === null
        ? 0
        : Math.max(0, realNow - this.previousFrameAt);
    this.previousFrameAt = realNow;
    if (this.paused) return false;
    if (!Number.isFinite(elapsed) || elapsed > INTERRUPTION_THRESHOLD_MS) {
      this.pause(realNow);
      return true;
    }
    const grace = Math.min(elapsed, this.graceMs);
    this.graceMs -= grace;
    this.pendingMs += elapsed - grace;
    while (!this.paused && this.pendingMs + 0.000001 >= COMBAT_STEP_MS) {
      this.pendingMs = Math.max(0, this.pendingMs - COMBAT_STEP_MS);
      this.ticks += 1;
      update(COMBAT_STEP_MS / 1000);
    }
    return false;
  }
}
