import { afterEach, describe, expect, it, vi } from "vitest";
import { COMBAT_STEP_MS } from "./clock";
import { DIFFICULTY_CONFIG, RESUME_GRACE_MS } from "./rules";
import { createSceneHarness } from "./testing/sceneHarness";

const firstWait = 3000 * DIFFICULTY_CONFIG.apprentice.cooldownMultiplier;

describe("scene run clock", () => {
  let h: Awaited<ReturnType<typeof createSceneHarness>>;
  afterEach(() => {
    h?.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const waitForWarning = () => {
    for (let frames = 0; frames < 300; frames++) {
      if (h.state().enemyPhase === "予備") return h.state().playTimeMs;
      h.frame(COMBAT_STEP_MS);
    }
    throw new Error("Enemy did not telegraph within five seconds");
  };

  it.each([0, 10_000, 60_000])(
    "starts the first warning from run start after %ims in the title",
    async realStart => {
      h = await createSceneHarness(realStart);
      h.start();
      expect(h.state().playTimeMs).toBe(0);
      const actual = waitForWarning();
      expect(actual).toBeGreaterThan(firstWait);
      expect(actual).toBeLessThanOrEqual(firstWait + COMBAT_STEP_MS + 1);
    }
  );

  it("restarts the same first-enemy wait on retry", async () => {
    h = await createSceneHarness(60_000);
    h.start();
    const first = waitForWarning();
    h.advance(1200);
    h.dispatch("yamabushi-restart", {
      mode: "ten",
      difficulty: "apprentice",
      seed: 123,
    });
    expect(h.state().playTimeMs).toBe(0);
    expect(waitForWarning()).toBe(first);
  });

  it("waits from the second enemy's own spawn, not the page or first enemy", async () => {
    h = await createSceneHarness(60_000);
    h.start();
    for (let attack = 0; attack < 8 && h.state().enemyHp > 0; attack++) {
      h.dispatch("yamabushi-slash");
      h.advance(800);
    }
    for (let frames = 0; frames < 90 && h.state().wave === 1; frames++)
      h.frame(COMBAT_STEP_MS);
    expect(h.state().wave).toBe(2);
    expect(h.state().enemyPhase).toBe("巡回");
    const spawned = h.state().playTimeMs;
    const actual = waitForWarning() - spawned;
    const expected = 3400 * DIFFICULTY_CONFIG.apprentice.cooldownMultiplier;
    expect(actual).toBeGreaterThan(expected);
    expect(actual).toBeLessThanOrEqual(expected + COMBAT_STEP_MS + 1);
  });

  it("preserves the pending hit through a 1600ms interruption and manual resume", async () => {
    h = await createSceneHarness();
    h.start();
    waitForWarning();
    h.advance(400);
    const before = h.state();
    h.frame(1600);
    expect(h.state()).toMatchObject({
      paused: true,
      pauseReason: "frame-gap",
      hp: before.hp,
      playTimeMs: before.playTimeMs,
      enemyPhase: before.enemyPhase,
    });
    h.dispatch("yamabushi-slash");
    h.frame(60_000);
    expect(h.state().enemyHp).toBe(before.enemyHp);
    expect(h.state().playTimeMs).toBe(before.playTimeMs);
    h.dispatch("yamabushi-pause", {
      paused: false,
      resumeGraceMs: RESUME_GRACE_MS,
    });
    h.advance(600);
    h.dispatch("yamabushi-guard");
    expect(h.state().stance).not.toBe("防御");
    expect(h.state().playTimeMs).toBe(before.playTimeMs);
    h.advance(100);
    h.advance(800);
    expect(h.state()).toMatchObject({
      paused: false,
      pauseReason: null,
      hp: 76,
      hitsTaken: 1,
    });
    h.advance(800);
    expect(h.state().hitsTaken).toBe(1);
  });

  it.each(["manual", "visibility", "pagehide", "pageshow"])(
    "freezes an active slash for %s pauses",
    async reason => {
      h = await createSceneHarness();
      h.start();
      h.dispatch("yamabushi-slash");
      h.advance(200);
      h.dispatch("yamabushi-pause", { paused: true, reason });
      const before = h.state();
      h.frame(60_000);
      expect(h.state()).toEqual(before);
      h.dispatch("yamabushi-pause", {
        paused: false,
        resumeGraceMs: RESUME_GRACE_MS,
      });
      h.advance(RESUME_GRACE_MS + 100);
      expect(h.state().enemyHp).toBe(100);
      h.advance(100);
      expect(h.state().enemyHp).toBeLessThan(100);
    }
  );

  it("detects a long gap before accepting input, even before another render", async () => {
    h = await createSceneHarness();
    h.start();
    vi.spyOn(performance, "now").mockReturnValue(1600);
    h.dispatch("yamabushi-slash");
    expect(h.state()).toMatchObject({
      paused: true,
      pauseReason: "frame-gap",
      attackPhase: "待機",
      enemyHp: 100,
    });
  });

  it.each([30, 60, 120])(
    "resolves the same hit with %i rendered frames per second",
    async fps => {
      h = await createSceneHarness();
      h.start();
      h.advance(firstWait + 2000, fps);
      expect(h.state()).toMatchObject({
        hp: 76,
        hitsTaken: 1,
        score: 0,
        paused: false,
      });
      expect(h.state().playTimeMs).toBeCloseTo(firstWait + 2000, 0);
    }
  );
});
