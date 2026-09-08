import { describe, expect, it } from "vitest";
import { RunClock, COMBAT_STEP_MS, INTERRUPTION_THRESHOLD_MS } from "./clock";

describe("fixed run clock", () => {
  it("processes all normal delayed steps but preserves time across a larger interruption", () => {
    const clock = new RunClock();
    let updates = 0;
    clock.reset(60_000);
    expect(
      clock.frame(60_000 + INTERRUPTION_THRESHOLD_MS, () => updates++)
    ).toBe(false);
    expect(updates).toBe(15);
    expect(clock.nowMs).toBeCloseTo(250);
    expect(clock.frame(62_000, () => updates++)).toBe(true);
    expect(clock.nowMs).toBeCloseTo(250);
    clock.resume(100_000, 700);
    clock.frame(100_200, () => updates++);
    clock.frame(100_400, () => updates++);
    clock.frame(100_600, () => updates++);
    expect(clock.acceptingInput).toBe(false);
    clock.frame(100_700 + COMBAT_STEP_MS, () => updates++);
    expect(clock.acceptingInput).toBe(true);
    expect(updates).toBe(16);
  });

  it("stops a batch immediately when a step pauses for a chapter reward", () => {
    const clock = new RunClock();
    clock.reset(0);
    clock.frame(100, () => clock.pause(100));
    expect(clock.nowMs).toBe(COMBAT_STEP_MS);
    clock.frame(20_000, () => {
      throw new Error("Advanced during pause");
    });
    expect(clock.nowMs).toBe(COMBAT_STEP_MS);
    clock.resume(20_000);
    clock.frame(20_000, () => {
      throw new Error("Replayed time after the pause");
    });
    expect(clock.nowMs).toBe(COMBAT_STEP_MS);
  });
});
