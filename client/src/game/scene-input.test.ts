import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, afterEach, it, vi } from "vitest";
import { createGameScene } from "./scene";

describe("scene action input", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts a visible slash from the mobile event path before tutorial success", async () => {
    const eventBus = new EventTarget();
    const storageValues = new Map<string, string>();
    const storage = {
      getItem: (key: string) => storageValues.get(key) ?? null,
      setItem: (key: string, value: string) => storageValues.set(key, value),
    };
    Object.assign(eventBus, {
      AudioContext: undefined,
      clearTimeout,
      setTimeout,
    });
    vi.stubGlobal("window", eventBus);
    vi.stubGlobal("localStorage", storage);

    const states: Array<{
      attackPhase: string;
      enemyHp: number;
      message: string;
    }> = [];
    eventBus.addEventListener("yamabushi-state", (event) => {
      const detail = (event as CustomEvent<(typeof states)[number]>).detail;
      states.push(detail);
    });

    const engine = new NullEngine({ renderWidth: 402, renderHeight: 874 });
    const handle = await createGameScene(engine, "lite");

    eventBus.dispatchEvent(
      new CustomEvent("yamabushi-start", {
        detail: { mode: "ten", difficulty: "apprentice", seed: 123 },
      }),
    );
    eventBus.dispatchEvent(new CustomEvent("yamabushi-slash"));
    handle.scene.render();

    const latest = states.at(-1);
    expect(latest?.attackPhase).not.toBe("待機");
    expect(latest?.enemyHp).toBe(100);
    expect(latest?.message).toContain("飛刃、霧を裂く");

    await new Promise((resolve) => setTimeout(resolve, 380));
    handle.scene.render();
    expect(states.at(-1)?.enemyHp).toBeLessThan(100);

    handle.dispose();
    engine.dispose();
  });
});
