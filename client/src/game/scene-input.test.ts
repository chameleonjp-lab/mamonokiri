import { describe, expect, afterEach, it, vi } from "vitest";
import { createSceneHarness } from "./testing/sceneHarness";

describe("scene action input", () => {
  let harness: Awaited<ReturnType<typeof createSceneHarness>>;
  afterEach(() => {
    harness?.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts a visible slash from the mobile event path before tutorial success", async () => {
    harness = await createSceneHarness();
    harness.start();
    harness.dispatch("yamabushi-slash");
    expect(harness.state().attackPhase).toBe("振り始め");
    expect(harness.state().enemyHp).toBe(100);
    expect(harness.state().message).toContain("飛刃、霧を裂く");
    expect(
      harness.handle.scene.meshes.some(mesh => mesh.name === "flying_slash_arc")
    ).toBe(true);
    // A single 380ms gap now pauses by design; normal frames must still hit.
    harness.advance(350);
    expect(harness.state().enemyHp).toBe(100);
    harness.advance(30);
    expect(harness.state().enemyHp).toBeLessThan(100);
  });
});
