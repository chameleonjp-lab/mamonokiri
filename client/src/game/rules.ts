export type AttackSide = "left" | "right" | "alternate" | "wide" | "target";

export type AttackPlan = {
  dangerLane: -1 | 0 | 1;
  spearSide: -1 | 0 | 1;
  isWide: boolean;
};

export type ChapterReward = {
  chapter: number;
  hp: number;
  score: number;
} | null;

export type RunResetSnapshot = {
  hp: number;
  enemyHp: number;
  enemyMaxHp: number;
  wave: number;
  boss: boolean;
  score: number;
  combo: number;
  maxCombo: number;
  counterReady: boolean;
  attackUntil: number;
  guardUntil: number;
  dodgeUntil: number;
  enemyAttackCount: number;
  paused: boolean;
  defeated: boolean;
  transitioning: boolean;
};

export const INITIAL_RUN: Readonly<RunResetSnapshot> = {
  hp: 100,
  enemyHp: 100,
  enemyMaxHp: 100,
  wave: 1,
  boss: false,
  score: 0,
  combo: 0,
  maxCombo: 0,
  counterReady: false,
  attackUntil: 0,
  guardUntil: 0,
  dodgeUntil: 0,
  enemyAttackCount: 0,
  paused: false,
  defeated: false,
  transitioning: false,
};

export function tutorialVariantIndex(wave: number): number | null {
  return wave >= 1 && wave <= 3 ? wave - 1 : null;
}

export function attackPlanFor(side: AttackSide, attackCount: number, playerX: number, tutorialWave = 0): AttackPlan {
  if (tutorialWave === 3) return { dangerLane: 0, spearSide: 0, isWide: true };

  if (side === "wide") return { dangerLane: 0, spearSide: 0, isWide: true };
  if (side === "left") return { dangerLane: -1, spearSide: -1, isWide: false };
  if (side === "right") return { dangerLane: 1, spearSide: 1, isWide: false };
  if (side === "alternate") {
    const lane = attackCount % 2 === 1 ? -1 : 1;
    return { dangerLane: lane, spearSide: lane, isWide: false };
  }

  const lane = playerX < -0.3 ? -1 : playerX > 0.3 ? 1 : 0;
  return { dangerLane: lane, spearSide: lane, isWide: false };
}

export function chapterRewardForDefeat(defeatedWave: number): ChapterReward {
  if (defeatedWave <= 0 || defeatedWave % 10 !== 0) return null;
  const chapter = Math.min(5, defeatedWave / 10);
  return { chapter, hp: 12, score: chapter * 500 };
}

export function crossedComboMilestones(previousCombo: number, nextCombo: number): number {
  if (nextCombo <= previousCombo) return 0;
  return Math.max(0, Math.floor(nextCombo / 10) - Math.floor(previousCombo / 10));
}

export function correctDodgeForLane(dodgeDirection: -1 | 1, dangerLane: -1 | 0 | 1, isWide: boolean): boolean {
  return !isWide && dangerLane !== 0 && dodgeDirection === -dangerLane;
}

export function counterMayBeGranted(source: "player-parry" | "enemy-guard-break" | "enemy-block" | "other"): boolean {
  return source === "player-parry";
}

export function shouldAdvanceAfterDefeat(defeatedWave: number, modeLimit = 50): boolean {
  return defeatedWave < modeLimit;
}

export function shiftActiveTimer(value: number, delta: number): number {
  return value > 0 ? value + delta : value;
}

export function applyDamage(currentHp: number, damage: number): { hp: number; defeated: boolean } {
  const hp = Math.max(0, currentHp - Math.max(0, damage));
  return { hp, defeated: hp === 0 };
}

export function defeatProgress(defeatedWave: number, modeLimit = 50) {
  return {
    advances: shouldAdvanceAfterDefeat(defeatedWave, modeLimit),
    victory: defeatedWave >= modeLimit,
    chapterReward: chapterRewardForDefeat(defeatedWave),
  };
}

export function freshRun(): RunResetSnapshot {
  return { ...INITIAL_RUN };
}
