export type AttackSide = "left" | "right" | "alternate" | "wide" | "target";

export type RunMode = "ten" | "twenty-five" | "fifty";

export type Difficulty = "apprentice" | "standard" | "dark";

export type ChapterRewardKind = "heal" | "parry-window" | "score-multiplier";

export type ChapterRewardOption = {
  kind: ChapterRewardKind;
  label: string;
  description: string;
};

export type Lane = -1 | 0 | 1;

export type EnemyRole =
  | "left-teacher"
  | "right-teacher"
  | "alternate"
  | "pattern"
  | "tracking"
  | "double"
  | "heavy";

export type BossFamily =
  | "獣型"
  | "モンスター型"
  | "人型"
  | "鳥型"
  | "モニュメント型";

export type PlayerAttackKind =
  | "normal"
  | "counter"
  | "guard-break"
  | "finisher";

export type AttackTiming = {
  startup: number;
  active: number;
  recovery: number;
  total: number;
};

export type AttackPlan = {
  dangerLane: Lane;
  spearSide: Lane;
  isWide: boolean;
};

export type ChapterReward = {
  chapter: number;
} | null;

export const RUN_MODE_CONFIG: Readonly<
  Record<RunMode, { label: string; limit: number; description: string }>
> = {
  ten: {
    label: "十番勝負",
    limit: 10,
    description: "短時間で一章を駆け抜ける",
  },
  "twenty-five": {
    label: "二十五番勝負",
    limit: 25,
    description: "前半の型を読み切る",
  },
  fifty: {
    label: "五十番修行",
    limit: 50,
    description: "五章を通して修める",
  },
};

export const DIFFICULTY_CONFIG: Readonly<
  Record<
    Difficulty,
    {
      label: string;
      description: string;
      warningMultiplier: number;
      cooldownMultiplier: number;
      parryWindow: number;
    }
  >
> = {
  apprentice: {
    label: "見習い",
    description: "予告が長く、型を読みやすい",
    warningMultiplier: 1.35,
    cooldownMultiplier: 1.15,
    parryWindow: 180,
  },
  standard: {
    label: "修験",
    description: "標準の予告と間合い",
    warningMultiplier: 1,
    cooldownMultiplier: 1,
    parryWindow: 150,
  },
  dark: {
    label: "無明",
    description: "予告が短く、判断が速い",
    warningMultiplier: 0.72,
    cooldownMultiplier: 0.84,
    parryWindow: 120,
  },
};

export const CHAPTER_REWARD_OPTIONS: ReadonlyArray<ChapterRewardOption> = [
  {
    kind: "heal",
    label: "生命を整える",
    description: "体力を30回復する",
  },
  {
    kind: "parry-window",
    label: "静かな見切り",
    description: "次の章だけ受け流し受付を45ms延長する",
  },
  {
    kind: "score-multiplier",
    label: "修験の勢い",
    description: "次の章だけ得点を15%増やす",
  },
];

export const COMBO_MULTIPLIER_CAP = 8;
export const RESUME_GRACE_MS = 700;

export function modeLimitFor(mode: RunMode): number {
  return RUN_MODE_CONFIG[mode].limit;
}

export function modeLabelFor(mode: RunMode): string {
  return RUN_MODE_CONFIG[mode].label;
}

export function difficultyLabelFor(difficulty: Difficulty): string {
  return DIFFICULTY_CONFIG[difficulty].label;
}

export function scoreForCombo(
  basePoints: number,
  combo: number,
  scoreMultiplier = 1,
): number {
  const safeBase = Math.max(0, basePoints);
  const safeCombo = Math.max(1, Math.min(COMBO_MULTIPLIER_CAP, combo));
  const safeMultiplier = Math.max(0, scoreMultiplier);
  return Math.round(safeBase * safeCombo * safeMultiplier);
}

export function normalizeSeed(seed: number): number {
  const normalized = Math.trunc(seed) >>> 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

export function nextSeed(seed: number): { seed: number; value: number } {
  const next = (normalizeSeed(seed) * 1664525 + 1013904223) >>> 0;
  return { seed: normalizeSeed(next), value: next / 0x100000000 };
}

export function chapterRewardOptionsForDefeat(
  defeatedWave: number,
  modeLimit = 50,
): ReadonlyArray<ChapterRewardOption> {
  return chapterRewardForDefeat(defeatedWave, modeLimit)
    ? CHAPTER_REWARD_OPTIONS.map((option) => ({ ...option }))
    : [];
}

export function addChapterRewardEffect(
  current: readonly ChapterRewardKind[],
  nextEffect: ChapterRewardKind,
  maximum = 2,
): ChapterRewardKind[] {
  const withoutDuplicate = current.filter((effect) => effect !== nextEffect);
  const next = [...withoutDuplicate, nextEffect];
  return next.slice(Math.max(0, next.length - Math.max(1, maximum)));
}

export type RunResetSnapshot = {
  hp: number;
  playerPosture: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyPosture: number;
  enemyPostureMax: number;
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
  playerPosture: 100,
  enemyHp: 100,
  enemyMaxHp: 100,
  enemyPosture: 80,
  enemyPostureMax: 80,
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

export function canSlashDuringTutorial(
  tutorialStep: number,
  objectiveMet: boolean,
): boolean {
  return tutorialStep < 1 || tutorialStep > 3 || objectiveMet;
}

export function attackPlanFor(
  side: AttackSide,
  attackCount: number,
  playerX: number,
  tutorialWave = 0,
): AttackPlan {
  if (tutorialWave === 3) return { dangerLane: 0, spearSide: 0, isWide: true };

  if (side === "wide") return { dangerLane: 0, spearSide: 0, isWide: true };
  if (side === "left") return { dangerLane: -1, spearSide: -1, isWide: false };
  if (side === "right") return { dangerLane: 1, spearSide: 1, isWide: false };
  if (side === "alternate") {
    const lane = attackCount % 2 === 1 ? -1 : 1;
    return { dangerLane: lane, spearSide: lane, isWide: false };
  }

  const lane =
    playerX < -0.3 ? -1 : playerX > 0.3 ? 1 : attackCount % 2 === 1 ? -1 : 1;
  return { dangerLane: lane, spearSide: lane, isWide: false };
}

export function enemyAttackPlanFor(
  role: EnemyRole,
  attackCount: number,
  playerX: number,
  tutorialWave = 0,
): AttackPlan {
  if (tutorialWave > 0) {
    const tutorialSide: AttackSide =
      tutorialWave === 1 ? "left" : tutorialWave === 2 ? "right" : "wide";
    return attackPlanFor(tutorialSide, attackCount, playerX, tutorialWave);
  }

  if (role === "left-teacher")
    return attackPlanFor("left", attackCount, playerX);
  if (role === "right-teacher")
    return attackPlanFor("right", attackCount, playerX);
  if (role === "alternate" || role === "double")
    return attackPlanFor("alternate", attackCount, playerX);
  if (role === "pattern") {
    const lane: Lane = attackCount % 3 === 0 ? -1 : 1;
    return { dangerLane: lane, spearSide: lane, isWide: false };
  }
  return attackPlanFor("target", attackCount, playerX);
}

export function attackTimingFor(kind: PlayerAttackKind): AttackTiming {
  const timing =
    kind === "guard-break"
      ? { startup: 430, active: 110, recovery: 360 }
      : kind === "counter"
        ? { startup: 90, active: 90, recovery: 260 }
        : kind === "finisher"
          ? { startup: 150, active: 100, recovery: 320 }
          : { startup: 300, active: 120, recovery: 340 };
  return { ...timing, total: timing.startup + timing.active + timing.recovery };
}

export function canStartPlayerAction(
  now: number,
  activeDeadlines: readonly number[],
): boolean {
  return activeDeadlines.every((deadline) => deadline <= now);
}

export function postureAfterGuard(
  current: number,
  pressure: number,
): { posture: number; broken: boolean } {
  const posture = Math.max(0, current - Math.max(0, pressure));
  return { posture, broken: current > 0 && posture === 0 };
}

export function recoverPosture(
  current: number,
  amount: number,
  maximum = 100,
): number {
  return Math.min(maximum, Math.max(0, current) + Math.max(0, amount));
}

export function enemyPostureDamageFor(kind: PlayerAttackKind): number {
  if (kind === "guard-break") return 46;
  if (kind === "finisher") return 60;
  if (kind === "counter") return 28;
  return 10;
}

export function chapterForWave(wave: number): number {
  return Math.max(1, Math.min(5, Math.ceil(Math.max(1, wave) / 10)));
}

const NORMAL_CHAPTER_POOLS: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 2],
  [2, 3, 6],
  [2, 3, 4],
  [4, 5, 6],
  [0, 1, 2, 3, 4, 5, 6],
];

export function normalEnemyPoolForWave(wave: number): number[] {
  return [...NORMAL_CHAPTER_POOLS[chapterForWave(wave) - 1]];
}

export function bossPoolForWave(wave: number): number[] {
  const first = (chapterForWave(wave) - 1) * 2;
  return [first, first + 1];
}

export function chooseNonRepeatingIndex(
  pool: readonly number[],
  previous: number,
  randomValue = Math.random(),
): number {
  if (pool.length === 0) throw new Error("Encounter pool must not be empty");
  const candidates =
    pool.length > 1 ? pool.filter((value) => value !== previous) : [...pool];
  const safeRandom = Math.max(0, Math.min(0.999999, randomValue));
  return candidates[Math.floor(safeRandom * candidates.length)];
}

export function bossPhaseForHealth(hp: number, maxHp: number): 1 | 2 {
  return maxHp > 0 && hp > 0 && hp <= maxHp * 0.5 ? 2 : 1;
}

export function followUpLanesFor(
  role: EnemyRole,
  family: string,
  initialLane: Lane,
  bossPhase: 1 | 2,
): Lane[] {
  const opposite: Lane = initialLane === 0 ? 1 : initialLane === -1 ? 1 : -1;
  if (family === "モニュメント型")
    return bossPhase === 2 ? [opposite, initialLane] : [opposite];
  if (family === "獣型")
    return bossPhase === 2 ? [opposite, initialLane] : [opposite];
  if (bossPhase === 2 && (family === "モンスター型" || family === "鳥型"))
    return [opposite];
  if (role === "double") return [opposite];
  return [];
}

export function chapterRewardForDefeat(
  defeatedWave: number,
  modeLimit = 50,
): ChapterReward {
  if (defeatedWave <= 0 || defeatedWave >= modeLimit || defeatedWave % 10 !== 0)
    return null;
  const chapter = Math.min(5, defeatedWave / 10);
  return { chapter };
}

export function crossedComboMilestones(
  previousCombo: number,
  nextCombo: number,
): number {
  if (nextCombo <= previousCombo) return 0;
  return Math.max(
    0,
    Math.floor(nextCombo / 10) - Math.floor(previousCombo / 10),
  );
}

export function correctDodgeForLane(
  dodgeDirection: -1 | 1,
  dangerLane: -1 | 0 | 1,
  isWide: boolean,
): boolean {
  return !isWide && dangerLane !== 0 && dodgeDirection === -dangerLane;
}

export function isPlayerInDangerLine(
  playerX: number,
  dangerLane: -1 | 0 | 1,
  isWide: boolean,
  hitWidth = 0.8,
): boolean {
  if (isWide || dangerLane === 0) return true;
  const laneCenter = dangerLane * 0.9;
  const safeSeamHalfWidth = Math.max(0, 0.9 - Math.max(0, hitWidth));
  return (
    Math.abs(playerX - laneCenter) < Math.max(0, hitWidth) ||
    Math.abs(playerX) <= safeSeamHalfWidth
  );
}

export function counterMayBeGranted(
  source: "player-parry" | "enemy-guard-break" | "enemy-block" | "other",
): boolean {
  return source === "player-parry";
}

export function shouldAdvanceAfterDefeat(
  defeatedWave: number,
  modeLimit = 50,
): boolean {
  return defeatedWave < modeLimit;
}

export function shouldAdvanceCombatClock(
  paused: boolean,
  defeated: boolean,
  transitioning: boolean,
): boolean {
  return !paused && !defeated && !transitioning;
}

export function shiftActiveTimer(
  value: number,
  delta: number,
  activeAfter = 0,
): number {
  return value > activeAfter ? value + delta : value;
}

export function applyDamage(
  currentHp: number,
  damage: number,
): { hp: number; defeated: boolean } {
  const hp = Math.max(0, currentHp - Math.max(0, damage));
  return { hp, defeated: hp === 0 };
}

export function defeatProgress(defeatedWave: number, modeLimit = 50) {
  return {
    advances: shouldAdvanceAfterDefeat(defeatedWave, modeLimit),
    victory: defeatedWave >= modeLimit,
    chapterReward: chapterRewardForDefeat(defeatedWave, modeLimit),
  };
}

export function freshRun(): RunResetSnapshot {
  return { ...INITIAL_RUN };
}
