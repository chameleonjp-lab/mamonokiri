import { describe, expect, it } from "vitest";
import { INITIAL_GAME_STATE, type GameState } from "./contracts";
import {
  RANKING_READ_RPC,
  RANKING_RULES_VERSION,
  RANKING_SUBMIT_RPC,
  rankingConditionFor,
  rankingReadPayloadFor,
  rankingRowsFrom,
  rankingSubmissionFor,
  rankingSubmitPayloadFor,
  submissionWasDuplicate,
} from "./ranking";

const resultState = (changes: Partial<GameState> = {}): GameState => ({
  ...INITIAL_GAME_STATE,
  mode: "twenty-five",
  modeLimit: 25,
  difficulty: "dark",
  seed: 123,
  runId: "11111111-1111-4111-8111-111111111111",
  score: 4567,
  wave: 25,
  defeated: true,
  ...changes,
});

describe("scoped ranking contract", () => {
  it("sends the run id and every ranking condition", () => {
    const submission = rankingSubmissionFor(
      resultState(),
      "  霞  ",
      "client-v1"
    );
    expect(submission).toMatchObject({
      submissionId: "11111111-1111-4111-8111-111111111111",
      mode: "twenty-five",
      difficulty: "dark",
      rulesVersion: RANKING_RULES_VERSION,
      runSeed: 123,
      score: 4567,
      clearWave: 25,
    });
    expect(rankingSubmitPayloadFor(submission)).toEqual({
      p_submission_id: submission.submissionId,
      p_display_name: "  霞  ",
      p_mode: "twenty-five",
      p_difficulty: "dark",
      p_rules_version: RANKING_RULES_VERSION,
      p_run_seed: 123,
      p_score: 4567,
      p_clear_wave: 25,
      p_client_version: "client-v1",
    });
  });

  it("keeps reads scoped and bounds the requested limit", () => {
    expect(
      rankingReadPayloadFor(rankingConditionFor(resultState()), 999)
    ).toEqual({
      p_mode: "twenty-five",
      p_difficulty: "dark",
      p_rules_version: RANKING_RULES_VERSION,
      p_limit: 50,
    });
    expect(RANKING_SUBMIT_RPC).toBe("mamonokiri_submit_score_v1");
    expect(RANKING_READ_RPC).toBe("mamonokiri_get_score_ranking_v1");
  });

  it("parses only finite scores and preserves a duplicate response", () => {
    expect(
      rankingRowsFrom([
        { display_name: "霞", best_score: 1200, play_count: 2 },
        { display_name: "壺", score: "900" },
        { display_name: "壊れた", best_score: "NaN" },
      ])
    ).toEqual([
      { name: "霞", score: 1200, playCount: 2 },
      { name: "壺", score: 900 },
    ]);
    expect(submissionWasDuplicate([{ duplicate: true }])).toBe(true);
    expect(submissionWasDuplicate({ duplicate: "false" })).toBe(false);
  });
});
