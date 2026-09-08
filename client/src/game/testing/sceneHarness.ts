import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { vi } from "vitest";
import { createGameScene } from "../scene";
import { safeStorage } from "../storage";
import { SETTINGS_STORAGE_KEYS } from "../config";

export async function createSceneHarness(realStart = 0) {
  let realNow = realStart;
  vi.spyOn(performance, "now").mockImplementation(() => realNow);
  const bus = new EventTarget();
  Object.assign(bus, { AudioContext: undefined, setTimeout, clearTimeout });
  const values = new Map<string, string>();
  vi.stubGlobal("window", bus);
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  safeStorage.setItem(SETTINGS_STORAGE_KEYS.effectsLevel, "minimal");
  const engine = new NullEngine({
    renderWidth: 402,
    renderHeight: 874,
    textureSize: 512,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  const handle = await createGameScene(engine, "lite");
  const dispatch = (name: string, detail = {}) =>
    bus.dispatchEvent(new CustomEvent(name, { detail }));
  const frame = (ms: number) => {
    realNow += ms;
    // Run the actual scene observer without requiring a GPU or wall-clock sleeps.
    handle.scene.onBeforeRenderObservable.notifyObservers(handle.scene);
  };
  return {
    handle,
    state: handle.getState,
    dispatch,
    start: () =>
      dispatch("yamabushi-start", {
        mode: "ten",
        difficulty: "apprentice",
        seed: 123,
      }),
    frame,
    advance(ms: number, fps = 60) {
      const count = Math.ceil(ms / (1000 / fps));
      for (let index = 0; index < count; index++) frame(ms / count);
    },
    dispose() {
      handle.dispose();
      engine.dispose();
    },
  };
}
