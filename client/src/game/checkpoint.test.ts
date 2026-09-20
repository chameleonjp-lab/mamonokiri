import { describe, expect, it } from "vitest";
import {
  clearRunCheckpoint,
  parseRunCheckpoint,
  readRunCheckpoint,
  RUN_CHECKPOINT_STORAGE_KEY,
  writeRunCheckpoint,
  type RunCheckpoint,
} from "./checkpoint";
import { SCORE_RULES_VERSION } from "./rules";

function memoryStorage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(RUN_CHECKPOINT_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    raw: () => values.get(RUN_CHECKPOINT_STORAGE_KEY) ?? null,
  };
}

function checkpoint(overrides: Partial<RunCheckpoint> = {}): RunCheckpoint {
  return {
    version: 1,
    scoreRulesVersion: SCORE_RULES_VERSION,
    mode: "fifty",
    difficulty: "dark",
    practice: false,
    seed: 0x12345678,
    runId: "run-stage09",
    wave: 11,
    boss: false,
    bossPhase: 1,
    variantIndex: 2,
    hp: 84,
    playerPosture: 63,
    enemyHp: 72,
    enemyMaxHp: 100,
    enemyPosture: 55,
    enemyPostureMax: 80,
    defeatedCount: 10,
    bossDefeats: 2,
    parrySuccesses: 4,
    correctDodges: 5,
    defensiveScoreAwards: 6,
    defensiveScoreAwardsThisEnemy: 1,
    hitsTaken: 1,
    whiffs: 2,
    activePlayTimeMs: 182340,
    score: 3240,
    combo: 2,
    maxCombo: 7,
    encounterRandomSeed: 0xabcdef01,
    combatRandomSeed: 0x10203040,
    lastNormalVariantIndex: 2,
    lastBossVariantIndex: -1,
    rewardEffects: ["heal"],
    rewardEffectStartWave: 11,
    rewardEffectEndWave: 20,
    rewardPending: false,
    rewardChapter: 0,
    rewardOptions: [],
    pendingDefeatWave: 0,
    tutorialStep: 0,
    tutorialObjectiveMet: false,
    ...overrides,
  };
}

describe("run checkpoint persistence", () => {
  it("round-trips a safe-boundary checkpoint including the initial -1 boss index", () => {
    const storage = memoryStorage();
    const saved = checkpoint();

    expect(writeRunCheckpoint(saved, storage)).toBe(true);
    expect(readRunCheckpoint(storage)).toEqual(saved);
  });

  it("keeps a chapter reward choice resumable without accepting an empty reward", () => {
    const storage = memoryStorage();
    const saved = checkpoint({
      wave: 10,
      boss: true,
      variantIndex: 1,
      enemyHp: 0,
      enemyMaxHp: 320,
      enemyPostureMax: 180,
      defeatedCount: 10,
      rewardEffects: [],
      rewardEffectStartWave: 0,
      rewardEffectEndWave: 0,
      rewardPending: true,
      rewardChapter: 1,
      pendingDefeatWave: 10,
      rewardOptions: [
        {
          kind: "parry-window",
          label: "白刃の間",
          description: "受け流しの受付を広げる。",
        },
      ],
    });

    expect(parseRunCheckpoint(saved)).toEqual(saved);
    expect(
      parseRunCheckpoint(
        checkpoint({
          rewardPending: true,
          rewardChapter: 1,
          pendingDefeatWave: 10,
        })
      )
    ).toBeNull();
  });

  it("removes malformed or stale data so the title can boot normally", () => {
    const broken = memoryStorage("{not-json");
    expect(readRunCheckpoint(broken)).toBeNull();
    expect(broken.raw()).toBeNull();

    const stale = memoryStorage(
      JSON.stringify(checkpoint({ version: 99 as 1 }))
    );
    expect(readRunCheckpoint(stale)).toBeNull();
    expect(stale.raw()).toBeNull();

    const wrongRules = memoryStorage(
      JSON.stringify(
        checkpoint({
          scoreRulesVersion: "old-rules" as typeof SCORE_RULES_VERSION,
        })
      )
    );
    expect(readRunCheckpoint(wrongRules)).toBeNull();
    expect(wrongRules.raw()).toBeNull();

    expect(
      parseRunCheckpoint(checkpoint({ practice: true, mode: "fifty" }))
    ).toBeNull();
    expect(parseRunCheckpoint(checkpoint({ variantIndex: 99 }))).toBeNull();
  });

  it("rejects impossible safe-boundary combinations before resume", () => {
    expect(
      parseRunCheckpoint(
        checkpoint({
          defeatedCount: 9,
          rewardEffects: [],
          rewardEffectStartWave: 0,
          rewardEffectEndWave: 0,
        })
      )
    ).toBeNull();
    expect(
      parseRunCheckpoint(
        checkpoint({
          enemyMaxHp: 320,
          enemyPostureMax: 180,
        })
      )
    ).toBeNull();
    expect(
      parseRunCheckpoint(
        checkpoint({
          rewardEffects: ["heal", "heal"],
        })
      )
    ).toBeNull();
    expect(
      parseRunCheckpoint(
        checkpoint({
          wave: 10,
          boss: true,
          variantIndex: 1,
          enemyHp: 0,
          enemyMaxHp: 320,
          enemyPostureMax: 180,
          defeatedCount: 10,
          rewardPending: true,
          rewardChapter: 2,
          pendingDefeatWave: 9,
          rewardOptions: [
            {
              kind: "heal",
              label: "生命を整える",
              description: "体力を30回復する",
            },
          ],
          rewardEffects: [],
          rewardEffectStartWave: 0,
          rewardEffectEndWave: 0,
        })
      )
    ).toBeNull();
  });

  it("clears a completed run without touching unrelated saved values", () => {
    const storage = memoryStorage();
    storage.setItem("other", "keep");
    writeRunCheckpoint(checkpoint(), storage);

    clearRunCheckpoint(storage);

    expect(storage.raw()).toBeNull();
    expect(storage.getItem("other")).toBe("keep");
  });
});
