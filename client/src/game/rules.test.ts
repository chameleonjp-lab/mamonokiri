import { describe, expect, it } from "vitest";
import {
  INITIAL_RUN,
  addChapterRewardEffect,
  applyDamage,
  attackPlanFor,
  attackTimingFor,
  bossPhaseForHealth,
  bossPoolForWave,
  canSlashDuringTutorial,
  canStartPlayerAction,
  chapterForWave,
  chapterRewardForDefeat,
  chapterRewardOptionsForDefeat,
  chooseNonRepeatingIndex,
  correctDodgeForLane,
  counterMayBeGranted,
  crossedComboMilestones,
  defeatProgress,
  DIFFICULTY_CONFIG,
  enemyAttackPlanFor,
  enemyPostureDamageFor,
  followUpLanesFor,
  freshRun,
  normalEnemyPoolForWave,
  modeLimitFor,
  nextSeed,
  postureAfterGuard,
  recoverPosture,
  scoreForCombo,
  shiftActiveTimer,
  shouldAdvanceAfterDefeat,
  shouldAdvanceCombatClock,
  tutorialVariantIndex,
} from "./rules";

describe("priority S combat rules", () => {
  it("keeps the initial run values safe for a retry", () => {
    expect(INITIAL_RUN.hp).toBe(100);
    expect(INITIAL_RUN.playerPosture).toBe(100);
    expect(INITIAL_RUN.enemyPosture).toBe(80);
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
    expect(attackPlanFor("left", 1, 0)).toEqual({
      dangerLane: -1,
      spearSide: -1,
      isWide: false,
    });
    expect(attackPlanFor("right", 1, 0)).toEqual({
      dangerLane: 1,
      spearSide: 1,
      isWide: false,
    });
  });

  it("alternates left then right without resetting the attack count", () => {
    expect(attackPlanFor("alternate", 1, 0).dangerLane).toBe(-1);
    expect(attackPlanFor("alternate", 2, 0).dangerLane).toBe(1);
    expect(attackPlanFor("alternate", 3, 0).dangerLane).toBe(-1);
  });

  it("makes the third tutorial enemy a readable guard lesson", () => {
    expect(attackPlanFor("alternate", 1, 0, 3)).toEqual({
      dangerLane: 0,
      spearSide: 0,
      isWide: true,
    });
  });

  it("does not let slash spam skip the three hands-on lessons", () => {
    expect(canSlashDuringTutorial(1, false)).toBe(false);
    expect(canSlashDuringTutorial(2, false)).toBe(false);
    expect(canSlashDuringTutorial(3, false)).toBe(false);
    expect(canSlashDuringTutorial(3, true)).toBe(true);
    expect(canSlashDuringTutorial(0, false)).toBe(true);
  });

  it("does not grant a chapter reward until the tenth enemy is defeated", () => {
    expect(chapterRewardForDefeat(9)).toBeNull();
    expect(chapterRewardForDefeat(10)).toEqual({ chapter: 1 });
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
    expect(defeatProgress(10, 50)).toMatchObject({
      advances: true,
      victory: false,
      chapterReward: { chapter: 1 },
    });
    expect(defeatProgress(50, 50)).toMatchObject({
      advances: false,
      victory: true,
      chapterReward: null,
    });
  });

  it("freezes active deadlines during a pause by shifting them on resume", () => {
    expect(shiftActiveTimer(1000, 5000)).toBe(6000);
    expect(shiftActiveTimer(0, 5000)).toBe(0);
    expect(shiftActiveTimer(1000, 5000, 1200)).toBe(1000);
    expect(shiftActiveTimer(1500, 5000, 1200)).toBe(6500);
    expect(shiftActiveTimer(1500, 5000 + 700, 1200)).toBe(7200);
  });

  it("stops the combat clock while paused, defeated, or changing enemies", () => {
    expect(shouldAdvanceCombatClock(false, false, false)).toBe(true);
    expect(shouldAdvanceCombatClock(true, false, false)).toBe(false);
    expect(shouldAdvanceCombatClock(false, true, false)).toBe(false);
    expect(shouldAdvanceCombatClock(false, false, true)).toBe(false);
  });

  it("creates a clean retry snapshot instead of reusing mutable run state", () => {
    const retry = freshRun();
    retry.combo = 12;
    retry.score = 9999;
    expect(freshRun()).toEqual(INITIAL_RUN);
    expect(retry).toMatchObject({ combo: 12, score: 9999 });
  });
});

describe("priority B run configuration and scoring", () => {
  it("keeps the three run lengths explicit", () => {
    expect(modeLimitFor("ten")).toBe(10);
    expect(modeLimitFor("twenty-five")).toBe(25);
    expect(modeLimitFor("fifty")).toBe(50);
  });

  it("makes difficulty visible through different timing values", () => {
    expect(DIFFICULTY_CONFIG.apprentice.warningMultiplier).toBeGreaterThan(1);
    expect(DIFFICULTY_CONFIG.dark.warningMultiplier).toBeLessThan(1);
    expect(DIFFICULTY_CONFIG.apprentice.parryWindow).toBeGreaterThan(
      DIFFICULTY_CONFIG.dark.parryWindow,
    );
  });

  it("offers three chapter choices only after a non-final ten defeat", () => {
    expect(chapterRewardOptionsForDefeat(9, 50)).toHaveLength(0);
    expect(chapterRewardOptionsForDefeat(10, 50)).toHaveLength(3);
    expect(chapterRewardOptionsForDefeat(10, 10)).toHaveLength(0);
  });

  it("limits held temporary effects without duplicating a choice", () => {
    expect(
      addChapterRewardEffect(["heal", "parry-window"], "score-multiplier"),
    ).toEqual(["parry-window", "score-multiplier"]);
    expect(addChapterRewardEffect(["heal"], "heal")).toEqual(["heal"]);
  });

  it("caps combo multiplication so hit spam cannot grow without bound", () => {
    expect(scoreForCombo(100, 1)).toBe(100);
    expect(scoreForCombo(100, 8)).toBe(800);
    expect(scoreForCombo(100, 80)).toBe(800);
  });

  it("replays the same deterministic random sequence from a seed", () => {
    const first = nextSeed(12345);
    const second = nextSeed(first.seed);
    const replayFirst = nextSeed(12345);
    const replaySecond = nextSeed(replayFirst.seed);
    expect([first.value, second.value]).toEqual([
      replayFirst.value,
      replaySecond.value,
    ]);
  });
});

describe("priority A combat depth", () => {
  it("gives normal, counter, and guard-break attacks distinct commitments", () => {
    expect(attackTimingFor("normal")).toMatchObject({
      startup: 300,
      total: 760,
    });
    expect(attackTimingFor("counter").total).toBeLessThan(
      attackTimingFor("normal").total,
    );
    expect(attackTimingFor("guard-break").startup).toBeGreaterThan(
      attackTimingFor("normal").startup,
    );
  });

  it("does not let rapid inputs overlap attack, guard, dodge, recoil, or guard-break recovery", () => {
    expect(canStartPlayerAction(1000, [1200, 0, 0])).toBe(false);
    expect(canStartPlayerAction(1000, [0, 1400, 0])).toBe(false);
    expect(canStartPlayerAction(1000, [0, 0, 1001])).toBe(false);
    expect(canStartPlayerAction(1000, [1000, 800, 0])).toBe(true);
  });

  it("breaks player posture instead of allowing unlimited normal guards", () => {
    expect(postureAfterGuard(100, 28)).toEqual({ posture: 72, broken: false });
    expect(postureAfterGuard(24, 28)).toEqual({ posture: 0, broken: true });
    expect(recoverPosture(92, 18)).toBe(100);
  });

  it("eventually defeats guard spam and makes heavy guards fail sooner", () => {
    const afterFourNormalGuards = [1, 2, 3, 4].reduce(
      (posture) => postureAfterGuard(posture, 28).posture,
      100,
    );
    const afterTwoHeavyGuards = [1, 2].reduce(
      (posture) => postureAfterGuard(posture, 52).posture,
      100,
    );
    expect(afterFourNormalGuards).toBe(0);
    expect(afterTwoHeavyGuards).toBe(0);
  });

  it("orders enemy posture pressure as normal < counter < guard break", () => {
    expect(enemyPostureDamageFor("normal")).toBeLessThan(
      enemyPostureDamageFor("counter"),
    );
    expect(enemyPostureDamageFor("counter")).toBeLessThan(
      enemyPostureDamageFor("guard-break"),
    );
  });

  it("gives all seven normal enemies a readable attack rule", () => {
    expect(enemyAttackPlanFor("left-teacher", 2, 0).dangerLane).toBe(-1);
    expect(enemyAttackPlanFor("right-teacher", 2, 0).dangerLane).toBe(1);
    expect(
      [1, 2, 3, 4].map(
        (count) => enemyAttackPlanFor("alternate", count, 0).dangerLane,
      ),
    ).toEqual([-1, 1, -1, 1]);
    expect(
      [1, 2, 3, 4].map(
        (count) => enemyAttackPlanFor("pattern", count, 0).dangerLane,
      ),
    ).toEqual([1, 1, -1, 1]);
    expect(enemyAttackPlanFor("tracking", 1, -0.8).dangerLane).toBe(-1);
    expect(followUpLanesFor("double", "二段攻撃型", -1, 1)).toEqual([1]);
  });

  it("makes heavy attacks a timing/pressure role rather than a random lane", () => {
    expect(enemyAttackPlanFor("heavy", 1, 0.9).dangerLane).toBe(1);
  });

  it("unlocks encounter lessons chapter by chapter", () => {
    expect(chapterForWave(1)).toBe(1);
    expect(chapterForWave(11)).toBe(2);
    expect(chapterForWave(50)).toBe(5);
    expect(normalEnemyPoolForWave(1)).toEqual([0, 1, 2]);
    expect(normalEnemyPoolForWave(21)).toEqual([2, 3, 4]);
    expect(normalEnemyPoolForWave(41)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("assigns each chapter its two existing bosses and avoids an immediate repeat", () => {
    expect(bossPoolForWave(5)).toEqual([0, 1]);
    expect(bossPoolForWave(25)).toEqual([4, 5]);
    expect(bossPoolForWave(50)).toEqual([8, 9]);
    expect(chooseNonRepeatingIndex([4, 5], 4, 0)).toBe(5);
  });

  it("enters phase two at half health and combines learned boss patterns", () => {
    expect(bossPhaseForHealth(161, 320)).toBe(1);
    expect(bossPhaseForHealth(160, 320)).toBe(2);
    expect(followUpLanesFor("tracking", "獣型", -1, 2)).toEqual([1, -1]);
    expect(followUpLanesFor("heavy", "モニュメント型", 1, 2)).toEqual([-1, 1]);
  });

  it("gives phase-two monster and bird bosses a readable second lane", () => {
    expect(followUpLanesFor("tracking", "モンスター型", 1, 1)).toEqual([]);
    expect(followUpLanesFor("tracking", "モンスター型", 1, 2)).toEqual([-1]);
    expect(followUpLanesFor("alternate", "鳥型", -1, 2)).toEqual([1]);
  });
});
