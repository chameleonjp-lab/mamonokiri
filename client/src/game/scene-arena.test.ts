import { afterEach, describe, expect, it, vi } from "vitest";
import { COMBAT_STEP_MS } from "./clock";
import { createSceneHarness } from "./testing/sceneHarness";

describe("scene arena alignment", () => {
  let harness: Awaited<ReturnType<typeof createSceneHarness>>;

  afterEach(() => {
    harness?.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("moves between fixed side anchors instead of accumulating viewport-sized drift", async () => {
    harness = await createSceneHarness();
    harness.start();
    const player = harness.handle.scene.getTransformNodeByName(
      "yamabushi_procedural_root"
    );
    expect(player?.position.x).toBe(-0.9);

    harness.dispatch("yamabushi-dodge", { direction: 1 });
    harness.advance(420);
    expect(player?.position.x).toBeCloseTo(0.9, 5);

    harness.dispatch("yamabushi-dodge", { direction: -1 });
    harness.advance(420);
    expect(player?.position.x).toBeCloseTo(-0.9, 5);
  });

  it("places the strong warning and all three lane markers in the same arena", async () => {
    harness = await createSceneHarness();
    harness.start();
    for (let frame = 0; frame < 300; frame++) {
      if (harness.state().enemyPhase === "予備") break;
      harness.frame(COMBAT_STEP_MS);
    }
    harness.advance(220);

    const warning = harness.handle.scene.getMeshByName("attack_warning_line");
    const left = harness.handle.scene.getMeshByName(
      "player_foot_attack_zone_-1"
    );
    const center = harness.handle.scene.getMeshByName(
      "player_foot_attack_zone_0"
    );
    const right = harness.handle.scene.getMeshByName(
      "player_foot_attack_zone_1"
    );
    expect(warning?.position.x).toBeCloseTo(-0.9, 5);
    expect([left?.position.x, center?.position.x, right?.position.x]).toEqual([
      -0.9, 0, 0.9,
    ]);
  });

  it("keeps the fixed right lane safe from the first left attack", async () => {
    harness = await createSceneHarness();
    harness.start();
    for (let frame = 0; frame < 300; frame++) {
      if (harness.state().enemyPhase === "予備") break;
      harness.frame(COMBAT_STEP_MS);
    }
    harness.dispatch("yamabushi-dodge", { direction: 1 });
    harness.advance(1100);
    expect(harness.state()).toMatchObject({ hp: 100, hitsTaken: 0 });
  });
});
