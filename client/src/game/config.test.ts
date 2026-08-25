import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUDIO_SETTINGS,
  PERFORMANCE_CONFIG,
  clampVolume,
  hardwareScalingLevelFor,
  nextVolume,
  readAudioSettings,
  readEffectLevel,
  readHandedness,
  readPerformanceTier,
  SETTINGS_STORAGE_KEYS,
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
    expect(readEffectLevel("reduced")).toBe("reduced");
    expect(readEffectLevel("corrupted")).toBe("full");
    expect(readPerformanceTier("high")).toBe("high");
    expect(readPerformanceTier("lite")).toBe("lite");
    expect(readPerformanceTier("unknown")).toBe("balanced");
  });

  it("reads all audio settings through the shared storage contract", () => {
    const values: Record<string, string> = {
      [SETTINGS_STORAGE_KEYS.masterVolume]: "0.35",
      [SETTINGS_STORAGE_KEYS.effectsVolume]: "invalid",
      [SETTINGS_STORAGE_KEYS.audioMuted]: "true",
    };
    const storage = {
      getItem: (key: string) => values[key] ?? null,
    } as Storage;

    expect(readAudioSettings(storage)).toEqual({
      masterVolume: 0.35,
      effectsVolume: DEFAULT_AUDIO_SETTINGS.effectsVolume,
      ambientVolume: DEFAULT_AUDIO_SETTINGS.ambientVolume,
      muted: true,
    });
  });

  it("calculates a bounded hardware scaling level for each render tier", () => {
    expect(hardwareScalingLevelFor("high", 3)).toBe(0.5);
    expect(hardwareScalingLevelFor("balanced", 2)).toBeCloseTo(1 / (2 * 0.78));
    expect(hardwareScalingLevelFor("lite", 0.5)).toBeCloseTo(1 / 0.75);
    expect(hardwareScalingLevelFor("balanced", Number.NaN)).toBeCloseTo(
      1 / (1 * 0.78),
    );
    expect(hardwareScalingLevelFor("high", 2)).toBeLessThan(
      hardwareScalingLevelFor("lite", 2),
    );
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
