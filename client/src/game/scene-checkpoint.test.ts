import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearRunCheckpoint,
  readRunCheckpoint,
  writeRunCheckpoint,
} from "./checkpoint";
import { safeStorage } from "./storage";
import { createSceneHarness } from "./testing/sceneHarness";

describe("scene run checkpoint", () => {
  let harness: Awaited<ReturnType<typeof createSceneHarness>> | undefined;

  afterEach(() => {
    harness?.dispose();
    clearRunCheckpoint();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("writes only a stable boundary and resumes the same run state", async () => {
    clearRunCheckpoint();
    harness = await createSceneHarness();
    harness.dispatch("yamabushi-start", {
      mode: "fifty",
      difficulty: "dark",
      seed: 0x12345678,
    });
    const initial = readRunCheckpoint();
    expect(initial).toMatchObject({
      mode: "fifty",
      difficulty: "dark",
      seed: 0x12345678,
      wave: 1,
      lastBossVariantIndex: -1,
    });
    if (!initial) throw new Error("expected initial checkpoint");

    const saved = {
      ...initial,
      wave: 11,
      hp: 57,
      score: 4321,
      defeatedCount: 10,
      enemyHp: 72,
      enemyMaxHp: 100,
      variantIndex: 2,
      lastNormalVariantIndex: 2,
    };
    expect(writeRunCheckpoint(saved)).toBe(true);
    const runId = saved.runId;
    harness.dispose();
    harness = await createSceneHarness();

    harness.dispatch("yamabushi-resume");

    expect(harness.state()).toMatchObject({
      mode: "fifty",
      modeLimit: 50,
      difficulty: "dark",
      seed: 0x12345678,
      runId,
      wave: 11,
      hp: 57,
      score: 4321,
      defeatedCount: 10,
      enemyHp: 72,
      paused: false,
      defeated: false,
    });
  });

  it("restores a chapter reward checkpoint as a paused choice", async () => {
    clearRunCheckpoint();
    harness = await createSceneHarness();
    harness.start();
    const initial = readRunCheckpoint();
    if (!initial) throw new Error("expected initial checkpoint");
    expect(
      writeRunCheckpoint({
        ...initial,
        wave: 10,
        enemyHp: 0,
        defeatedCount: 10,
        rewardPending: true,
        rewardChapter: 1,
        pendingDefeatWave: 10,
        rewardOptions: [
          {
            kind: "heal",
            label: "水鏡の息",
            description: "体力を整える。",
          },
        ],
      })
    ).toBe(true);

    harness.dispatch("yamabushi-resume");

    expect(harness.state()).toMatchObject({
      wave: 10,
      rewardPending: true,
      rewardChapter: 1,
      paused: true,
      enemyHp: 0,
    });
  });

  it("does not overwrite the checkpoint while a slash is in flight", async () => {
    clearRunCheckpoint();
    harness = await createSceneHarness();
    harness.start();
    const before = readRunCheckpoint();
    const rawBefore = safeStorage.getItem("yamabushi-run-checkpoint-v1");
    expect(before).not.toBeNull();

    harness.dispatch("yamabushi-slash");
    harness.advance(120);

    expect(readRunCheckpoint()).toEqual(before);
    expect(safeStorage.getItem("yamabushi-run-checkpoint-v1")).toBe(rawBefore);
  });

  it("ignores corrupt resume data and still allows a fresh run", async () => {
    clearRunCheckpoint();
    harness = await createSceneHarness();
    safeStorage.setItem("yamabushi-run-checkpoint-v1", "{broken");

    expect(() => harness?.dispatch("yamabushi-resume")).not.toThrow();
    expect(readRunCheckpoint()).toBeNull();

    harness.start();
    expect(harness.state()).toMatchObject({ wave: 1, defeated: false });
  });

  it("keeps scene resources bounded across repeated retry cycles", async () => {
    clearRunCheckpoint();
    harness = await createSceneHarness();
    harness.start();
    const scene = harness.handle.scene;
    const baselineMeshes = scene.meshes.length;

    for (let cycle = 0; cycle < 6; cycle += 1) {
      harness.dispatch("yamabushi-slash");
      harness.advance(900);
      harness.dispatch("yamabushi-restart", {
        mode: "ten",
        difficulty: "apprentice",
        seed: 100 + cycle,
      });
      expect(
        scene.meshes.filter(mesh => mesh.name === "flying_slash_arc")
      ).toHaveLength(0);
      expect(
        scene.materials.filter(material => material.name === "flying_slash")
      ).toHaveLength(1);
      expect(scene.meshes.length).toBeLessThanOrEqual(baselineMeshes + 2);
    }
  });
});
