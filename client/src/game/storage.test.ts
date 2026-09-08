import { describe, expect, it, vi } from "vitest";
import { createSafeStorage } from "./storage";
import {
  DEFAULT_AUDIO_SETTINGS,
  readAudioSettings,
  readEffectLevel,
  readPerformanceTier,
} from "./config";

describe("unavailable browser storage", () => {
  it("uses defaults when even access to storage throws", () => {
    const storage = createSafeStorage(() => {
      throw new Error("SecurityError");
    });
    const listener = vi.fn();
    const unsubscribe = storage.subscribe(listener);
    expect(readAudioSettings(storage)).toEqual(DEFAULT_AUDIO_SETTINGS);
    expect(readEffectLevel(storage.getItem("effects"))).toBe("full");
    expect(readPerformanceTier(storage.getItem("performance"))).toBe(
      "balanced"
    );
    expect(storage.isUnavailable()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
  it("retains changed values and removal in the session when writes fail", () => {
    const storage = createSafeStorage(() => ({
      getItem: () => "previous",
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    }));
    expect(storage.getItem("name")).toBe("previous");
    storage.setItem("name", "新しい名前");
    expect(storage.getItem("name")).toBe("新しい名前");
    storage.setItem("best", "1000");
    expect(storage.getItem("best")).toBe("1000");
    storage.removeItem("name");
    expect(storage.getItem("name")).toBeNull();
    expect(storage.isUnavailable()).toBe(true);
  });
});
