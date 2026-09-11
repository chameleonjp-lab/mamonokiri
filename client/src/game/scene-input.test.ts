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

  it("resolves a parry counter at its hit time, not on button-down", async () => {
    harness = await createSceneHarness();
    harness.start();
    // Detect the first warning in the deterministic harness, then reserve
    // guard 150ms before the strike (inside the apprentice parry window).
    while (harness.state().enemyPhase !== "予備") harness.advance(1000 / 60);
    expect(harness.state().enemyPhase).toBe("予備");
    const firstWarningAt = harness.now();
    const expectedHitAt = firstWarningAt + 620 * 1.35 + 230;
    harness.advance(Math.max(0, expectedHitAt - harness.now() - 150));
    harness.dispatch("yamabushi-guard");
    for (let frame = 0; frame < 80 && !harness.state().counterReady; frame++)
      harness.advance(1000 / 60);
    expect(harness.state().counterReady).toBe(true);
    const before = harness.state().enemyHp;

    for (
      let frame = 0;
      frame < 40 && harness.state().attackPhase === "待機";
      frame++
    ) {
      harness.dispatch("yamabushi-slash");
      if (harness.state().attackPhase === "待機") harness.advance(1000 / 60);
    }
    expect(harness.state().attackPhase).toBe("振り始め");
    expect(harness.state().enemyHp).toBe(before);
    harness.advance(80);
    expect(harness.state().enemyHp).toBe(before);
    harness.advance(20);
    expect(harness.state().enemyHp).toBeLessThan(before);
  });

  it("keeps hit effects visual-only and reuses the flying slash material", async () => {
    const run = async (level: "minimal" | "full") => {
      const local = await createSceneHarness();
      local.start();
      local.dispatch("yamabushi-effects", { level });
      local.dispatch("yamabushi-slash");
      const slashMaterialsBefore = local.handle.scene.materials.filter(
        material => material.name === "flying_slash"
      ).length;
      local.advance(380);
      for (let index = 0; index < 2; index++) {
        local.advance(500);
        local.dispatch("yamabushi-slash");
        local.advance(380);
      }
      const result = {
        hp: local.state().enemyHp,
        slashMaterials: local.handle.scene.materials.filter(
          material => material.name === "flying_slash"
        ).length,
        slashMaterialsBefore,
      };
      local.dispose();
      return result;
    };

    const minimal = await run("minimal");
    const full = await run("full");
    expect(full.hp).toBe(minimal.hp);
    expect(full.hp).toBeLessThan(100);
    expect(minimal.slashMaterialsBefore).toBe(1);
    expect(minimal.slashMaterials).toBe(1);
    expect(full.slashMaterials).toBe(1);
  });
});
