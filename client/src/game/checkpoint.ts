import {
  DIFFICULTY_CONFIG,
  modeLimitFor,
  PRACTICE_WAVE_LIMIT,
  RUN_MODE_CONFIG,
  SCORE_RULES_VERSION,
  type ChapterRewardKind,
  type Difficulty,
  type RunMode,
} from "./rules";
import { safeStorage } from "./storage";

export const RUN_CHECKPOINT_STORAGE_KEY = "yamabushi-run-checkpoint-v1";
export const RUN_CHECKPOINT_VERSION = 1 as const;

export type CheckpointRewardOption = {
  kind: ChapterRewardKind;
  label: string;
  description: string;
};

export type RunCheckpoint = {
  version: typeof RUN_CHECKPOINT_VERSION;
  scoreRulesVersion: typeof SCORE_RULES_VERSION;
  mode: RunMode;
  difficulty: Difficulty;
  practice: boolean;
  seed: number;
  runId: string;
  wave: number;
  boss: boolean;
  bossPhase: 1 | 2;
  variantIndex: number;
  hp: number;
  playerPosture: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyPosture: number;
  enemyPostureMax: number;
  defeatedCount: number;
  bossDefeats: number;
  parrySuccesses: number;
  correctDodges: number;
  defensiveScoreAwards: number;
  defensiveScoreAwardsThisEnemy: number;
  hitsTaken: number;
  whiffs: number;
  activePlayTimeMs: number;
  score: number;
  combo: number;
  maxCombo: number;
  encounterRandomSeed: number;
  combatRandomSeed: number;
  lastNormalVariantIndex: number;
  lastBossVariantIndex: number;
  rewardEffects: ChapterRewardKind[];
  rewardEffectStartWave: number;
  rewardEffectEndWave: number;
  rewardPending: boolean;
  rewardChapter: number;
  rewardOptions: CheckpointRewardOption[];
  pendingDefeatWave: number;
  tutorialStep: number;
  tutorialObjectiveMet: boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const rewardKinds: ReadonlySet<ChapterRewardKind> = new Set<ChapterRewardKind>([
  "heal",
  "parry-window",
  "score-multiplier",
]);

const isFiniteInteger = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  Number.isInteger(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isRunMode = (value: unknown): value is RunMode =>
  typeof value === "string" && value in RUN_MODE_CONFIG;

const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === "string" && value in DIFFICULTY_CONFIG;

const isRewardKind = (value: unknown): value is ChapterRewardKind =>
  typeof value === "string" && rewardKinds.has(value as ChapterRewardKind);

function validRewardOption(value: unknown): value is CheckpointRewardOption {
  if (!value || typeof value !== "object") return false;
  const option = value as Partial<CheckpointRewardOption>;
  return (
    isRewardKind(option.kind) &&
    typeof option.label === "string" &&
    typeof option.description === "string"
  );
}

function validCheckpoint(value: unknown): value is RunCheckpoint {
  if (!value || typeof value !== "object") return false;
  const checkpoint = value as Partial<RunCheckpoint>;
  if (
    checkpoint.version !== RUN_CHECKPOINT_VERSION ||
    checkpoint.scoreRulesVersion !== SCORE_RULES_VERSION ||
    !isRunMode(checkpoint.mode) ||
    !isDifficulty(checkpoint.difficulty) ||
    typeof checkpoint.practice !== "boolean" ||
    typeof checkpoint.runId !== "string" ||
    checkpoint.runId.length === 0
  )
    return false;

  if (checkpoint.practice && checkpoint.mode !== "ten") return false;

  const limit = modeLimitFor(checkpoint.mode);
  const variantLimit = checkpoint.boss ? 10 : 7;
  if (
    !isFiniteInteger(checkpoint.seed) ||
    checkpoint.seed < 0 ||
    checkpoint.seed > 0xffffffff ||
    !isFiniteInteger(checkpoint.wave) ||
    checkpoint.wave < 1 ||
    checkpoint.wave > (checkpoint.practice ? PRACTICE_WAVE_LIMIT : limit) ||
    typeof checkpoint.boss !== "boolean" ||
    (checkpoint.bossPhase !== 1 && checkpoint.bossPhase !== 2) ||
    !isFiniteInteger(checkpoint.variantIndex) ||
    checkpoint.variantIndex < 0 ||
    checkpoint.variantIndex >= variantLimit ||
    !isFiniteNumber(checkpoint.hp) ||
    checkpoint.hp < 0 ||
    checkpoint.hp > 100 ||
    !isFiniteNumber(checkpoint.playerPosture) ||
    checkpoint.playerPosture < 0 ||
    checkpoint.playerPosture > 100 ||
    !isFiniteNumber(checkpoint.enemyHp) ||
    checkpoint.enemyHp < 0 ||
    !isFiniteNumber(checkpoint.enemyMaxHp) ||
    checkpoint.enemyMaxHp <= 0 ||
    checkpoint.enemyHp > checkpoint.enemyMaxHp ||
    !isFiniteNumber(checkpoint.enemyPosture) ||
    checkpoint.enemyPosture < 0 ||
    !isFiniteNumber(checkpoint.enemyPostureMax) ||
    checkpoint.enemyPostureMax <= 0 ||
    checkpoint.enemyPosture > checkpoint.enemyPostureMax
  )
    return false;

  const counters = [
    checkpoint.defeatedCount,
    checkpoint.bossDefeats,
    checkpoint.parrySuccesses,
    checkpoint.correctDodges,
    checkpoint.defensiveScoreAwards,
    checkpoint.defensiveScoreAwardsThisEnemy,
    checkpoint.hitsTaken,
    checkpoint.whiffs,
    checkpoint.activePlayTimeMs,
    checkpoint.score,
    checkpoint.combo,
    checkpoint.maxCombo,
    checkpoint.encounterRandomSeed,
    checkpoint.combatRandomSeed,
    checkpoint.lastNormalVariantIndex,
    checkpoint.rewardEffectStartWave,
    checkpoint.rewardEffectEndWave,
    checkpoint.rewardChapter,
    checkpoint.pendingDefeatWave,
    checkpoint.tutorialStep,
  ];
  const rewardChapter = checkpoint.rewardChapter;
  const pendingDefeatWave = checkpoint.pendingDefeatWave;
  if (
    counters.some(value => !isFiniteNumber(value) || value < 0) ||
    !isFiniteInteger(checkpoint.lastBossVariantIndex) ||
    checkpoint.lastBossVariantIndex < -1 ||
    !Array.isArray(checkpoint.rewardEffects) ||
    !checkpoint.rewardEffects.every(isRewardKind) ||
    !Array.isArray(checkpoint.rewardOptions) ||
    !checkpoint.rewardOptions.every(validRewardOption) ||
    typeof checkpoint.rewardPending !== "boolean" ||
    typeof checkpoint.tutorialObjectiveMet !== "boolean"
  )
    return false;

  if (checkpoint.rewardPending) {
    if (
      !isFiniteInteger(rewardChapter) ||
      rewardChapter <= 0 ||
      !isFiniteInteger(pendingDefeatWave) ||
      pendingDefeatWave <= 0 ||
      checkpoint.rewardOptions.length === 0
    )
      return false;
  } else if (
    rewardChapter !== 0 ||
    pendingDefeatWave !== 0 ||
    checkpoint.rewardOptions.length !== 0
  )
    return false;

  return true;
}

export function parseRunCheckpoint(value: unknown): RunCheckpoint | null {
  return validCheckpoint(value) ? value : null;
}

export function readRunCheckpoint(
  storage: StorageLike = safeStorage
): RunCheckpoint | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(RUN_CHECKPOINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseRunCheckpoint(JSON.parse(raw));
    if (parsed) return parsed;
  } catch {
    // A broken or unavailable browser store must never block the title.
  }
  try {
    storage.removeItem(RUN_CHECKPOINT_STORAGE_KEY);
  } catch {
    // The safe storage wrapper keeps the current page usable.
  }
  return null;
}

export function writeRunCheckpoint(
  checkpoint: RunCheckpoint,
  storage: StorageLike = safeStorage
): boolean {
  if (!parseRunCheckpoint(checkpoint)) return false;
  try {
    storage.setItem(RUN_CHECKPOINT_STORAGE_KEY, JSON.stringify(checkpoint));
    return true;
  } catch {
    return false;
  }
}

export function clearRunCheckpoint(storage: StorageLike = safeStorage): void {
  try {
    storage.removeItem(RUN_CHECKPOINT_STORAGE_KEY);
  } catch {
    // The safe storage wrapper keeps the current page usable.
  }
}
