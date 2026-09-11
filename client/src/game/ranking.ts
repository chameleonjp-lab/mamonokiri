import type { GameState } from "./contracts";
import { SCORE_RULES_VERSION, type Difficulty, type RunMode } from "./rules";

/** A new scope keeps old, unscoped platform rows out of the new ranking. */
export const RANKING_RULES_VERSION = SCORE_RULES_VERSION;
export const RANKING_SUBMIT_RPC = "mamonokiri_submit_score_v1";
export const RANKING_READ_RPC = "mamonokiri_get_score_ranking_v1";

export type RankingCondition = {
  mode: RunMode;
  difficulty: Difficulty;
  rulesVersion: string;
};

export type RankingRow = {
  name: string;
  score: number;
  playCount?: number;
};

export type RankingSubmission = RankingCondition & {
  submissionId: string;
  displayName: string;
  runSeed: number;
  score: number;
  clearWave: number;
  clientVersion: string;
};

export function rankingConditionFor(state: GameState): RankingCondition {
  return {
    mode: state.mode,
    difficulty: state.difficulty,
    rulesVersion: RANKING_RULES_VERSION,
  };
}

export function rankingSubmissionFor(
  state: GameState,
  displayName: string,
  clientVersion: string
): RankingSubmission {
  return {
    ...rankingConditionFor(state),
    submissionId: state.runId,
    displayName,
    runSeed: state.seed,
    score: Math.trunc(state.score),
    clearWave: Math.trunc(state.wave),
    clientVersion,
  };
}

export function rankingSubmitPayloadFor(
  submission: RankingSubmission
): Record<string, unknown> {
  return {
    p_submission_id: submission.submissionId,
    p_display_name: submission.displayName,
    p_mode: submission.mode,
    p_difficulty: submission.difficulty,
    p_rules_version: submission.rulesVersion,
    p_run_seed: submission.runSeed,
    p_score: submission.score,
    p_clear_wave: submission.clearWave,
    p_client_version: submission.clientVersion,
  };
}

export function rankingReadPayloadFor(
  condition: RankingCondition,
  limit = 10
): Record<string, unknown> {
  return {
    p_mode: condition.mode,
    p_difficulty: condition.difficulty,
    p_rules_version: condition.rulesVersion,
    p_limit: Math.max(1, Math.min(50, Math.trunc(limit))),
  };
}

export function rankingRowsFrom(data: unknown): RankingRow[] {
  if (!Array.isArray(data)) return [];
  return data.slice(0, 50).flatMap(row => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const rawName = item.display_name ?? item.player_name ?? item.name;
    const score = Number(item.best_score ?? item.score);
    if (!Number.isFinite(score)) return [];
    return [
      {
        name:
          typeof rawName === "string" && rawName.trim() ? rawName : "ななし",
        score: Math.trunc(score),
        ...(Number.isFinite(Number(item.play_count))
          ? { playCount: Math.max(0, Math.trunc(Number(item.play_count))) }
          : {}),
      },
    ];
  });
}

export function submissionWasDuplicate(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  if (Array.isArray(data)) return submissionWasDuplicate(data[0]);
  const value = (data as Record<string, unknown>).duplicate;
  return value === true || value === "true";
}
