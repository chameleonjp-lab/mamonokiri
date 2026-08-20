import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUDIO_SETTINGS,
  PERFORMANCE_CONFIG,
  clampVolume,
  nextVolume,
  readHandedness,
  readPerformanceTier,
} from "./config";

describe("priority C device settings", () => {
  it("keeps audio values within the browser-safe range", () => {
    expect(clampVolume(1.4, 0.7)).toBe(1);
    expect(clampVolume(-0.2, 0.7)).toBe(0);
    expect(clampVolume(Number.NaN, 0.7)).toBe(0.7);
    expect(DEFAULT_AUDIO_SETTINGS.ambientVolume).toBe(0.7);
  });

  it("cycles audio volume without creating an always-on silent state", () => {
    expect(nextVolume(0.35)).toBe(0.7);
    expect(nextVolume(0.7)).toBe(1);
    expect(nextVolume(1)).toBe(0.35);
  });

  it("normalizes persisted layout and performance values", () => {
    expect(readHandedness("left")).toBe("left");
    expect(readHandedness("unknown")).toBe("right");
    expect(readPerformanceTier("high")).toBe("high");
    expect(readPerformanceTier("lite")).toBe("lite");
    expect(readPerformanceTier("unknown")).toBe("balanced");
  });

  it("retains judgement-critical display features in every tier", () => {
    expect(PERFORMANCE_CONFIG.high.fogEnabled).toBe(true);
    expect(PERFORMANCE_CONFIG.balanced.fogEnabled).toBe(true);
    expect(PERFORMANCE_CONFIG.lite.fogEnabled).toBe(false);
    expect(PERFORMANCE_CONFIG.lite.resolutionScale).toBeLessThan(
      PERFORMANCE_CONFIG.balanced.resolutionScale,
    );
  });
});
