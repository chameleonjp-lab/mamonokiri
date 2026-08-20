import { describe, expect, it } from "vitest";
import {
  INITIAL_RUN,
  applyDamage,
  attackPlanFor,
  chapterRewardForDefeat,
  correctDodgeForLane,
  counterMayBeGranted,
  crossedComboMilestones,
  defeatProgress,
  freshRun,
  shiftActiveTimer,
  shouldAdvanceAfterDefeat,
  tutorialVariantIndex,
} from "./rules";

describe("priority S combat rules", () => {
  it("keeps the initial run values safe for a retry", () => {
    expect(INITIAL_RUN.hp).toBe(100);
    expect(INITIAL_RUN.score).toBe(0);
    expect(INITIAL_RUN.combo).toBe(0);
    expect(INITIAL_RUN.enemyAttackCount).toBe(0);
    expect(INITIAL_RUN.paused).toBe(false);
    expect(INITIAL_RUN.defeated).toBe(false);
  });

  it("fixes the first three enemies to the tutorial order", () => {
    expect(tutorialVariantIndex(1)).toBe(0);
    expect(tutorialVariantIndex(2)).toBe(1);
    expect(tutorialVariantIndex(3)).toBe(2);
    expect(tutorialVariantIndex(4)).toBeNull();
  });

  it("uses the configured left and right attack lanes", () => {
    expect(attackPlanFor("left", 1, 0)).toEqual({ dangerLane: -1, spearSide: -1, isWide: false });
    expect(attackPlanFor("right", 1, 0)).toEqual({ dangerLane: 1, spearSide: 1, isWide: false });
  });

  it("alternates left then right without resetting the attack count", () => {
    expect(attackPlanFor("alternate", 1, 0).dangerLane).toBe(-1);
    expect(attackPlanFor("alternate", 2, 0).dangerLane).toBe(1);
    expect(attackPlanFor("alternate", 3, 0).dangerLane).toBe(-1);
  });

  it("makes the third tutorial enemy a readable guard lesson", () => {
    expect(attackPlanFor("alternate", 1, 0, 3)).toEqual({ dangerLane: 0, spearSide: 0, isWide: true });
  });

  it("does not grant a chapter reward until the tenth enemy is defeated", () => {
    expect(chapterRewardForDefeat(9)).toBeNull();
    expect(chapterRewardForDefeat(10)).toEqual({ chapter: 1, hp: 12, score: 500 });
  });

  it("fires a ten-chain milestone only when crossing ten", () => {
    expect(crossedComboMilestones(9, 10)).toBe(1);
    expect(crossedComboMilestones(10, 11)).toBe(0);
    expect(crossedComboMilestones(19, 20)).toBe(1);
    expect(crossedComboMilestones(0, 30)).toBe(3);
  });

  it("accepts only the opposite-direction dodge for a side attack", () => {
    expect(correctDodgeForLane(1, -1, false)).toBe(true);
    expect(correctDodgeForLane(-1, -1, false)).toBe(false);
    expect(correctDodgeForLane(1, 0, true)).toBe(false);
  });

  it("allows counter input only after a player parry", () => {
    expect(counterMayBeGranted("player-parry")).toBe(true);
    expect(counterMayBeGranted("enemy-block")).toBe(false);
    expect(counterMayBeGranted("enemy-guard-break")).toBe(false);
  });

  it("advances after enemy 49 but ends after enemy 50", () => {
    expect(shouldAdvanceAfterDefeat(49, 50)).toBe(true);
    expect(shouldAdvanceAfterDefeat(50, 50)).toBe(false);
  });

  it("resolves normal and counter hits as real defeat events", () => {
    expect(applyDamage(22, 22)).toEqual({ hp: 0, defeated: true });
    expect(applyDamage(28, 28)).toEqual({ hp: 0, defeated: true });
    expect(applyDamage(100, 28)).toEqual({ hp: 72, defeated: false });
  });

  it("keeps chapter progress and the final victory separate", () => {
    expect(defeatProgress(10, 50)).toMatchObject({ advances: true, victory: false, chapterReward: { chapter: 1 } });
    expect(defeatProgress(50, 50)).toMatchObject({ advances: false, victory: true, chapterReward: { chapter: 5 } });
  });

  it("freezes active deadlines during a pause by shifting them on resume", () => {
    expect(shiftActiveTimer(1000, 5000)).toBe(6000);
    expect(shiftActiveTimer(0, 5000)).toBe(0);
  });

  it("creates a clean retry snapshot instead of reusing mutable run state", () => {
    const retry = freshRun();
    retry.combo = 12;
    retry.score = 9999;
    expect(freshRun()).toEqual(INITIAL_RUN);
    expect(retry).toMatchObject({ combo: 12, score: 9999 });
  });
});
