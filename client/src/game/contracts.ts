import {
  DEFENSIVE_SCORE_AWARDS_PER_ENEMY,
  type ChapterRewardKind,
  type Difficulty,
  type RunMode,
} from "./rules";

export type PauseReason =
  | "manual"
  | "visibility"
  | "pagehide"
  | "pageshow"
  | "title"
  | "back"
  | "frame-gap";
export type PauseRequest = {
  paused?: boolean;
  resumeGraceMs?: number;
  reason?: PauseReason;
};
export type SceneStatus =
  | { phase: "loading" }
  | { phase: "ready" }
  | { phase: "error" };

export type GameState = {
  mode: RunMode;
  modeLimit: number;
  difficulty: Difficulty;
  seed: number;
  runId: string;
  chapter: number;
  hp: number;
  playerPosture: number;
  playerPostureMax: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyPosture: number;
  enemyPostureMax: number;
  wave: number;
  remainingEnemies: number;
  boss: boolean;
  bossPhase: 1 | 2;
  bossDefeatPulse: number;
  enemyName: string;
  enemyEpithet: string;
  enemyFamily: string;
  enemyAttackStyle: "left" | "right" | "alternate" | "wide" | "target";
  enemyPhase: string;
  counterReady: boolean;
  counterPulse: number;
  stance: string;
  attackPhase: string;
  message: string;
  defeated: boolean;
  combo: number;
  maxCombo: number;
  score: number;
  comboTime: number;
  defeatedCount: number;
  bossDefeats: number;
  parrySuccesses: number;
  correctDodges: number;
  defensiveScoreAwards: number;
  defensiveScoreAwardsThisEnemy: number;
  defensiveScoreLimit: number;
  hitsTaken: number;
  whiffs: number;
  playTimeMs: number;
  bestScore: number;
  isNewRecord: boolean;
  rewardPending: boolean;
  rewardChapter: number;
  rewardOptions: ReadonlyArray<{
    kind: ChapterRewardKind;
    label: string;
    description: string;
  }>;
  rewardEffects: ReadonlyArray<ChapterRewardKind>;
  climax: number;
  paused: boolean;
  pauseReason: PauseReason | null;
  transitioning: boolean;
  tutorialStep: number;
  tutorialObjectiveMet: boolean;
};

export const INITIAL_GAME_STATE: GameState = {
  mode: "fifty",
  modeLimit: 50,
  difficulty: "standard",
  seed: 0,
  runId: "",
  chapter: 1,
  hp: 100,
  playerPosture: 100,
  playerPostureMax: 100,
  enemyHp: 100,
  enemyMaxHp: 100,
  enemyPosture: 80,
  enemyPostureMax: 80,
  wave: 1,
  remainingEnemies: 50,
  boss: false,
  bossPhase: 1,
  bossDefeatPulse: 0,
  enemyName: "影面",
  enemyEpithet: "左薙の影",
  enemyFamily: "左右教材型",
  enemyAttackStyle: "left",
  enemyPhase: "巡回",
  counterReady: false,
  counterPulse: 0,
  stance: "静止",
  attackPhase: "待機",
  message: "第1試練。左槍の予告を見て、右へ避けよ。",
  defeated: false,
  combo: 0,
  maxCombo: 0,
  score: 0,
  comboTime: 0,
  defeatedCount: 0,
  bossDefeats: 0,
  parrySuccesses: 0,
  correctDodges: 0,
  defensiveScoreAwards: 0,
  defensiveScoreAwardsThisEnemy: 0,
  defensiveScoreLimit: DEFENSIVE_SCORE_AWARDS_PER_ENEMY,
  hitsTaken: 0,
  whiffs: 0,
  playTimeMs: 0,
  bestScore: 0,
  isNewRecord: false,
  rewardPending: false,
  rewardChapter: 0,
  rewardOptions: [],
  rewardEffects: [],
  climax: 0,
  paused: true,
  pauseReason: null,
  transitioning: false,
  tutorialStep: 1,
  tutorialObjectiveMet: false,
};
