export type Handedness = "right" | "left";
export type PerformanceTier = "high" | "balanced" | "lite";

export type AudioSettings = {
  masterVolume: number;
  effectsVolume: number;
  ambientVolume: number;
  muted: boolean;
};

export const AUDIO_VOLUME_STEPS = [0.35, 0.7, 1] as const;

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 1,
  effectsVolume: 1,
  ambientVolume: 0.7,
  muted: false,
};

export const PERFORMANCE_CONFIG: Record<
  PerformanceTier,
  {
    label: string;
    description: string;
    resolutionScale: number;
    fogEnabled: boolean;
    grainOpacity: number;
  }
> = {
  high: {
    label: "高精細",
    description: "霧と質感を優先",
    resolutionScale: 1,
    fogEnabled: true,
    grainOpacity: 0.12,
  },
  balanced: {
    label: "標準",
    description: "見やすさと負荷の均衡",
    resolutionScale: 0.78,
    fogEnabled: true,
    grainOpacity: 0.08,
  },
  lite: {
    label: "軽量",
    description: "内部解像度を下げ霧を省略",
    resolutionScale: 0.58,
    fogEnabled: false,
    grainOpacity: 0,
  },
};

export function clampVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

export function readStoredVolume(
  storage: Storage,
  key: string,
  fallback: number,
): number {
  const stored = storage.getItem(key);
  return stored === null ? fallback : clampVolume(Number(stored), fallback);
}

export function nextVolume(value: number): number {
  const currentIndex = AUDIO_VOLUME_STEPS.findIndex(
    (step) => Math.abs(step - value) < 0.01,
  );
  return AUDIO_VOLUME_STEPS[(currentIndex + 1) % AUDIO_VOLUME_STEPS.length];
}

export function readHandedness(value: string | null): Handedness {
  return value === "left" ? "left" : "right";
}

export function readPerformanceTier(value: string | null): PerformanceTier {
  return value === "high" || value === "lite" ? value : "balanced";
}
