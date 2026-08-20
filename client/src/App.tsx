// 墨霞の修験道：中央は剣戟の余白、情報は四隅へ。UIも能舞台のように静かに置く。
import { useEffect, useRef, useState } from "react";
import GameCanvas from "@/components/GameCanvas";
import {
  DEFAULT_AUDIO_SETTINGS,
  PERFORMANCE_CONFIG,
  nextVolume,
  readHandedness,
  readPerformanceTier,
  readStoredVolume,
  type AudioSettings,
  type Handedness,
  type PerformanceTier,
} from "@/game/config";
import {
  DIFFICULTY_CONFIG,
  RUN_MODE_CONFIG,
  type ChapterRewardKind,
  type Difficulty,
  type RunMode,
} from "@/game/rules";

type GameState = {
  mode: RunMode;
  modeLimit: number;
  difficulty: Difficulty;
  seed: number;
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
  transitioning: boolean;
  tutorialStep: number;
};

const initial: GameState = {
  mode: "fifty",
  modeLimit: 50,
  difficulty: "standard",
  seed: 0,
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
  paused: false,
  transitioning: false,
  tutorialStep: 1,
};

function Bar({ value, tone }: { value: number; tone: "player" | "enemy" }) {
  return (
    <div className={`bar ${tone}`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function PostureMeter({
  value,
  maximum,
  enemy = false,
}: {
  value: number;
  maximum: number;
  enemy?: boolean;
}) {
  const percentage = Math.max(
    0,
    Math.min(100, (value / Math.max(1, maximum)) * 100),
  );
  return (
    <div
      className={`posture-meter ${enemy ? "enemy-posture" : "player-posture"} ${percentage <= 25 ? "is-low" : ""}`}
    >
      <span>構え</span>
      <i>
        <b style={{ width: `${percentage}%` }} />
      </i>
      <strong>{Math.ceil(value)}</strong>
    </div>
  );
}

function dispatchGameEvent(name: string, detail: Record<string, unknown> = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function formatPlayTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function rewardEffectLabel(effect: ChapterRewardKind): string {
  if (effect === "heal") return "生命回復";
  if (effect === "parry-window") return "受け流し延長";
  return "得点倍率";
}

function volumeLabel(value: number): string {
  if (value >= 0.99) return "大";
  if (value <= 0.36) return "小";
  return "中";
}

export default function App() {
  const [state, setState] = useState(initial);
  const [showClimax, setShowClimax] = useState(false);
  const [showBossVictory, setShowBossVictory] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [showTitle, setShowTitle] = useState(true);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [selectedMode, setSelectedMode] = useState<RunMode>("fifty");
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<Difficulty>("standard");
  const [effectLevel, setEffectLevel] = useState<
    "full" | "reduced" | "minimal"
  >(
    () =>
      (localStorage.getItem("yamabushi-effects") as
        "full" | "reduced" | "minimal" | null) ?? "full",
  );
  const [ambientVolume, setAmbientVolume] = useState(() =>
    readStoredVolume(
      localStorage,
      "yamabushi-ambient-volume",
      DEFAULT_AUDIO_SETTINGS.ambientVolume,
    ),
  );
  const [masterVolume, setMasterVolume] = useState(() =>
    readStoredVolume(
      localStorage,
      "yamabushi-master-volume",
      DEFAULT_AUDIO_SETTINGS.masterVolume,
    ),
  );
  const [effectsVolume, setEffectsVolume] = useState(() =>
    readStoredVolume(
      localStorage,
      "yamabushi-effects-volume",
      DEFAULT_AUDIO_SETTINGS.effectsVolume,
    ),
  );
  const [audioMuted, setAudioMuted] = useState(
    () => localStorage.getItem("yamabushi-audio-muted") === "true",
  );
  const [handedness, setHandedness] = useState<Handedness>(() =>
    readHandedness(localStorage.getItem("yamabushi-handedness")),
  );
  const [performanceTier, setPerformanceTier] = useState<PerformanceTier>(() =>
    readPerformanceTier(localStorage.getItem("yamabushi-performance")),
  );
  const previousClimax = useRef(0);
  const previousCounter = useRef(0);
  const previousBossVictory = useRef(0);
  const swipeStart = useRef<{ x: number; y: number; at: number } | null>(null);
  const allowExit = useRef(false);
  const exitConfirmRef = useRef(false);
  const titleOpenRef = useRef(true);
  exitConfirmRef.current = showExitConfirm;
  titleOpenRef.current = showTitle;

  const cycleEffects = () => {
    const next =
      effectLevel === "full"
        ? "reduced"
        : effectLevel === "reduced"
          ? "minimal"
          : "full";
    setEffectLevel(next);
    localStorage.setItem("yamabushi-effects", next);
    dispatchGameEvent("yamabushi-effects", { level: next });
  };

  const updateAudioSettings = (changes: Partial<AudioSettings>) => {
    const next: AudioSettings = {
      masterVolume,
      effectsVolume,
      ambientVolume,
      muted: audioMuted,
      ...changes,
    };
    setMasterVolume(next.masterVolume);
    setEffectsVolume(next.effectsVolume);
    setAmbientVolume(next.ambientVolume);
    setAudioMuted(next.muted);
    localStorage.setItem("yamabushi-master-volume", String(next.masterVolume));
    localStorage.setItem(
      "yamabushi-effects-volume",
      String(next.effectsVolume),
    );
    localStorage.setItem(
      "yamabushi-ambient-volume",
      String(next.ambientVolume),
    );
    localStorage.setItem("yamabushi-audio-muted", String(next.muted));
    dispatchGameEvent("yamabushi-audio", next);
  };

  const cycleMasterVolume = () => {
    updateAudioSettings({ masterVolume: nextVolume(masterVolume) });
  };

  const cycleEffectsVolume = () => {
    updateAudioSettings({ effectsVolume: nextVolume(effectsVolume) });
  };

  const cycleAmbient = () => {
    updateAudioSettings({ ambientVolume: nextVolume(ambientVolume) });
  };

  const toggleAudioMute = () => {
    updateAudioSettings({ muted: !audioMuted });
  };

  const toggleHandedness = () => {
    const next = handedness === "right" ? "left" : "right";
    setHandedness(next);
    localStorage.setItem("yamabushi-handedness", next);
  };

  const cyclePerformance = () => {
    const next: PerformanceTier =
      performanceTier === "high"
        ? "balanced"
        : performanceTier === "balanced"
          ? "lite"
          : "high";
    setPerformanceTier(next);
    localStorage.setItem("yamabushi-performance", next);
    dispatchGameEvent("yamabushi-performance", { tier: next });
  };

  const startNewRun = (
    eventName = "yamabushi-restart",
    options: { seed?: number; mode?: RunMode; difficulty?: Difficulty } = {},
  ) => {
    const mode = options.mode ?? selectedMode;
    const difficulty = options.difficulty ?? selectedDifficulty;
    setShowPause(false);
    setShowTitle(false);
    setShowExitConfirm(false);
    titleOpenRef.current = false;
    dispatchGameEvent(eventName, {
      mode,
      difficulty,
      ...(options.seed === undefined ? {} : { seed: options.seed }),
    });
  };

  const openTitle = () => {
    setShowPause(false);
    setShowExitConfirm(false);
    setShowTitle(true);
    titleOpenRef.current = true;
    dispatchGameEvent("yamabushi-pause", { paused: true, reason: "title" });
  };

  const resumeGame = () => {
    setShowPause(false);
    dispatchGameEvent("yamabushi-pause", { paused: false });
  };

  useEffect(() => {
    const onState = (event: Event) => {
      const next = (event as CustomEvent<GameState>).detail;
      setState(next);
      if (
        next.paused &&
        !next.defeated &&
        !next.rewardPending &&
        !exitConfirmRef.current &&
        !titleOpenRef.current
      )
        setShowPause(true);
      if (!next.paused && !titleOpenRef.current) {
        setShowPause(false);
        setShowTitle(false);
      }
      if (next.climax > previousClimax.current) {
        previousClimax.current = next.climax;
        setShowClimax(true);
        window.setTimeout(() => setShowClimax(false), 2100);
      }
      if (next.counterPulse > previousCounter.current) {
        previousCounter.current = next.counterPulse;
        setShowCounter(true);
        window.setTimeout(() => setShowCounter(false), 900);
      }
      if (next.bossDefeatPulse > previousBossVictory.current) {
        previousBossVictory.current = next.bossDefeatPulse;
        setShowBossVictory(true);
        window.setTimeout(() => setShowBossVictory(false), 2600);
      }
    };
    window.addEventListener("yamabushi-state", onState);
    return () => window.removeEventListener("yamabushi-state", onState);
  }, []);

  useEffect(() => {
    const block = (event: Event) => event.preventDefault();
    document.addEventListener("contextmenu", block);
    document.addEventListener("selectstart", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);

    const onPopState = () => {
      if (allowExit.current) {
        allowExit.current = false;
        return;
      }
      window.history.pushState(
        { yamabushiGame: true },
        "",
        window.location.href,
      );
      setShowExitConfirm(true);
      setShowPause(false);
      dispatchGameEvent("yamabushi-pause", { paused: true, reason: "back" });
    };

    window.history.pushState({ yamabushiGame: true }, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("selectstart", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (
      event.pointerType === "mouse" ||
      (event.target as HTMLElement).closest("button")
    )
      return;
    swipeStart.current = {
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
    };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (
      !start ||
      event.pointerType === "mouse" ||
      (event.target as HTMLElement).closest("button")
    )
      return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (
      Math.abs(dx) >= 42 &&
      Math.abs(dx) > Math.abs(dy) * 1.15 &&
      performance.now() - start.at < 650
    ) {
      dispatchGameEvent("yamabushi-dodge", { direction: dx < 0 ? -1 : 1 });
    }
  };

  const victory = state.enemyHp === 0 && state.wave >= state.modeLimit;

  return (
    <main
      className={`game-shell ${handedness === "left" ? "is-left-handed" : ""} performance-${performanceTier}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <GameCanvas />
      <div
        className={`threat-vignette ${state.enemyPhase === "予備" ? "is-warning" : ""}`}
        aria-hidden="true"
      />
      <div
        className="grain"
        aria-hidden="true"
        style={{ opacity: PERFORMANCE_CONFIG[performanceTier].grainOpacity }}
      />

      {showClimax && (
        <div className="climax-fx" aria-live="assertive">
          <span className="slash slash-a" />
          <span className="slash slash-b" />
          <span className="burst burst-a" />
          <span className="burst burst-b" />
          <div className="climax-copy">
            <small>修験成就 / COMBO MILESTONE</small>
            <strong>{state.combo >= 20 ? state.combo : "十連"}</strong>
            <em>刃、迷いなし。</em>
          </div>
        </div>
      )}
      {showCounter && (
        <div className="counter-fx" aria-live="assertive">
          <span className="counter-ring" />
          <small>COUNTER SUCCESS</small>
          <strong>
            {state.combo}
            <em> CHAIN</em>
          </strong>
          <span>受け流し・反撃加算</span>
        </div>
      )}
      {showBossVictory && (
        <div className="boss-victory-fx" aria-live="assertive">
          <span className="victory-rays" />
          <small>THE MOUNTAIN LORD FALLS</small>
          <strong>峠の主、断つ</strong>
          <em>生命 +30・構え +30</em>
          <b>体力 {state.hp} / 100</b>
        </div>
      )}

      <header className="brand-lockup">
        <div className="crest" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div>
          <p className="eyebrow">修験の刃 / PROLOGUE</p>
          <h1>
            墨霞<span>の</span>剣
          </h1>
        </div>
      </header>
      <button
        type="button"
        className="pause-button"
        aria-label="一時停止"
        onClick={() =>
          dispatchGameEvent("yamabushi-pause", {
            paused: true,
            reason: "manual",
          })
        }
        disabled={state.defeated || state.rewardPending || showTitle}
      >
        一時停止
      </button>

      <section className="hud hud-card player-hud">
        <div className="hud-card-head">
          <div className="hud-label">
            <span>山伏</span>
            <small>YAMABUSHI</small>
          </div>
          <span className="hud-kicker">PLAYER</span>
        </div>
        <Bar value={state.hp} tone="player" />
        <div className="stat-line">
          <span>体力</span>
          <strong>{String(state.hp).padStart(3, "0")}</strong>
        </div>
        <PostureMeter
          value={state.playerPosture}
          maximum={state.playerPostureMax}
        />
      </section>
      <section
        className={`hud hud-card enemy-hud ${state.boss ? "boss-hud" : ""}`}
      >
        <div className="hud-card-head">
          <div className="hud-label align-right">
            <span>{state.enemyName}</span>
            <small>
              {state.boss
                ? `${state.enemyFamily} / BOSS ${state.wave}`
                : `${state.enemyFamily}・${state.enemyEpithet} / ${state.wave}体目`}
            </small>
          </div>
          <span className={`enemy-phase phase-${state.enemyPhase}`}>
            {state.enemyPhase === "防御"
              ? "GUARD"
              : state.enemyPhase === "大崩れ"
                ? "BREAK"
                : state.boss && state.enemyPhase === "巡回"
                  ? `BOSS ${state.bossPhase === 2 ? "II" : "I"}`
                  : state.enemyPhase}
          </span>
        </div>
        <Bar
          value={(state.enemyHp / Math.max(1, state.enemyMaxHp)) * 100}
          tone="enemy"
        />
        <div className="stat-line align-right">
          <span>
            {state.enemyPhase === "防御"
              ? "青輪・防御中"
              : state.enemyAttackStyle === "wide"
                ? "両側"
                : state.enemyAttackStyle === "left"
                  ? "左槍"
                  : state.enemyAttackStyle === "right"
                    ? "右槍"
                    : state.enemyAttackStyle === "alternate"
                      ? "交互"
                      : "追尾"}
          </span>
          <strong>{String(state.enemyHp).padStart(3, "0")}</strong>
        </div>
        <PostureMeter
          value={state.enemyPosture}
          maximum={state.enemyPostureMax}
          enemy
        />
        <div className="enemy-count">
          {RUN_MODE_CONFIG[state.mode].label}・第{state.chapter}章　残敵{" "}
          <strong>{String(state.remainingEnemies).padStart(2, "0")}</strong> /
          {state.modeLimit}
        </div>
      </section>

      <section className={`score-hud ${state.combo ? "is-combo" : ""}`}>
        <div className="audio-toggles">
          <button
            type="button"
            className="effect-toggle"
            onClick={cycleEffects}
            aria-label="演出強度を切り替える"
          >
            演出{" "}
            {effectLevel === "full"
              ? "標準"
              : effectLevel === "reduced"
                ? "軽量"
                : "最小"}
          </button>
          <button
            type="button"
            className="audio-toggle"
            onClick={cycleAmbient}
            aria-label="環境音量を切り替える"
          >
            環境音 {volumeLabel(ambientVolume)}
          </button>
        </div>
        <div className="score-label">SCORE / CHAIN</div>
        <strong>{String(state.score).padStart(6, "0")}</strong>
        <small className="run-meta">
          {RUN_MODE_CONFIG[state.mode].label} /{" "}
          {DIFFICULTY_CONFIG[state.difficulty].label}
        </small>
        {state.combo > 0 && (
          <div className="combo-readout">
            <span>連撃</span>
            <b>{state.combo}</b>
            <em>x</em>
          </div>
        )}
        {state.combo > 0 && (
          <div className="combo-meter">
            <i style={{ width: `${state.comboTime * 100}%` }} />
          </div>
        )}
      </section>
      {state.tutorialStep > 0 && !state.defeated && (
        <aside className="combat-guide" aria-label="序盤の操作ガイド">
          <b>
            {state.tutorialStep === 3
              ? "K"
              : state.tutorialStep === 1
                ? "右"
                : "左"}
          </b>{" "}
          {state.tutorialStep === 3
            ? "防御し、受け流し後にJで反撃"
            : "予告と反対側へ回避"}
        </aside>
      )}
      <div className="stance">
        <span className="dot" />
        構え <strong>{state.stance}</strong>
        {state.counterReady && (
          <small className="counter-ready">反撃受付 / J</small>
        )}
        {state.enemyPhase === "防御" && (
          <small className="guard-break-ready">青輪 GUARD / 防御崩し J</small>
        )}
        {state.attackPhase !== "待機" && (
          <small className="attack-phase">斬・{state.attackPhase}</small>
        )}
        {state.combo > 0 && <small>連撃継続中</small>}
      </div>
      <div className="message">
        <span className="message-caption">CURRENT EXCHANGE</span>
        <span className="message-mark">「</span>
        {state.message}
        <span className="message-mark">」</span>
      </div>

      <section className="controls">
        <span className="control-key">J</span>
        <span>斬る</span>
        <span className="control-key">K</span>
        <span>防御</span>
        <span className="control-key wide">SHIFT</span>
        <span>かわす</span>
      </section>
      <section
        className="mobile-controls gameboy-controls"
        aria-label="タッチ操作"
      >
        <div className="move-controls gameboy-dpad">
          <span className="mobile-group-label">MOVE</span>
          <div className="dpad-row">
            <button
              type="button"
              className="gb-btn direction-btn"
              aria-label="左へ回避"
              onClick={() =>
                dispatchGameEvent("yamabushi-dodge", { direction: -1 })
              }
            >
              <b>◀</b>
              <small>LEFT</small>
            </button>
            <button
              type="button"
              className="gb-btn direction-btn"
              aria-label="右へ回避"
              onClick={() =>
                dispatchGameEvent("yamabushi-dodge", { direction: 1 })
              }
            >
              <b>▶</b>
              <small>RIGHT</small>
            </button>
          </div>
        </div>
        <div className="combat-controls gameboy-actions">
          <span className="mobile-group-label">ACTION</span>
          <div className="action-row">
            <button
              type="button"
              className="gb-btn action-btn slash-btn"
              aria-label="斬る"
              onClick={() =>
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }))
              }
            >
              <b>斬</b>
              <small>SLASH</small>
            </button>
            <button
              type="button"
              className="gb-btn action-btn guard-btn"
              aria-label="防御"
              onClick={() =>
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }))
              }
            >
              <b>防</b>
              <small>GUARD</small>
            </button>
          </div>
        </div>
      </section>

      {state.rewardPending && !state.defeated && (
        <div
          className="reward-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reward-title"
        >
          <p className="eyebrow">CHAPTER CLEARED</p>
          <h2 id="reward-title">第{state.rewardChapter}章を越えた</h2>
          <p>次の章だけ有効な修験を一つ選ぶ。</p>
          <div className="reward-owned">
            所持効果 {state.rewardEffects.length} / 2
            {state.rewardEffects.length > 0 && (
              <span>
                {state.rewardEffects.map(rewardEffectLabel).join("・")}
              </span>
            )}
          </div>
          <div className="reward-options">
            {state.rewardOptions.map((option) => (
              <button
                type="button"
                key={option.kind}
                className="reward-option"
                onClick={() =>
                  dispatchGameEvent("yamabushi-reward", { kind: option.kind })
                }
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {state.defeated && (
        <div
          className="result-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="result-title"
        >
          <p className="eyebrow">THE MOUNTAIN REMAINS</p>
          <h2 id="result-title">{victory ? "敵影、断つ" : "霧に沈む"}</h2>
          <p>
            {RUN_MODE_CONFIG[state.mode].label}・
            {DIFFICULTY_CONFIG[state.difficulty].label}
            <br />
            到達 {state.wave}体目　／　撃破 {state.defeatedCount}体
          </p>
          <p>
            スコア {state.score}　／　最大連撃 {state.maxCombo}
          </p>
          <div className="result-stats">
            <span>ボス撃破 {state.bossDefeats}</span>
            <span>受け流し {state.parrySuccesses}</span>
            <span>正しい回避 {state.correctDodges}</span>
            <span>被弾 {state.hitsTaken}</span>
            <span>空振り {state.whiffs}</span>
            <span>時間 {formatPlayTime(state.playTimeMs)}</span>
          </div>
          <p className="result-seed">
            敵順コード <code>{state.seed.toString(16).padStart(8, "0")}</code>
          </p>
          {state.isNewRecord && (
            <strong className="new-record">自己最高記録を更新</strong>
          )}
          <div className="result-actions">
            <button
              type="button"
              className="result-primary"
              onClick={() => startNewRun()}
            >
              もう一度遊ぶ
            </button>
            <button
              type="button"
              className="result-secondary"
              onClick={() =>
                startNewRun("yamabushi-restart", {
                  seed: state.seed,
                  mode: state.mode,
                  difficulty: state.difficulty,
                })
              }
            >
              同じ敵順で再挑戦
            </button>
            <button
              type="button"
              className="result-secondary"
              onClick={openTitle}
            >
              最初の画面へ戻る
            </button>
          </div>
        </div>
      )}
      {showPause && !state.defeated && !state.rewardPending && !showTitle && (
        <div
          className="pause-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
        >
          <div className="pause-panel">
            <p className="eyebrow">THE BLADE RESTS</p>
            <h2 id="pause-title">一時停止</h2>
            <p>停止中は攻撃・防御・回避・連撃の時間が進みません。</p>
            <div className="pause-actions">
              <button
                type="button"
                className="result-primary"
                onClick={resumeGame}
              >
                再開
              </button>
              <button
                type="button"
                className="result-secondary"
                onClick={() => {
                  setShowPause(false);
                  dispatchGameEvent("yamabushi-retire");
                }}
              >
                リタイア
              </button>
              <button
                type="button"
                className="result-secondary"
                onClick={() => startNewRun()}
              >
                最初から
              </button>
              <button
                type="button"
                className="result-secondary"
                onClick={openTitle}
              >
                タイトルへ
              </button>
            </div>
            <div className="pause-settings">
              <button type="button" onClick={cycleEffects}>
                演出：
                {effectLevel === "full"
                  ? "標準"
                  : effectLevel === "reduced"
                    ? "軽量"
                    : "最小"}
              </button>
              <button type="button" onClick={cycleAmbient}>
                環境音：{volumeLabel(ambientVolume)}
              </button>
              <button type="button" onClick={cycleMasterVolume}>
                主音量：{volumeLabel(masterVolume)}
              </button>
              <button type="button" onClick={cycleEffectsVolume}>
                効果音：{volumeLabel(effectsVolume)}
              </button>
              <button
                type="button"
                onClick={toggleAudioMute}
                aria-pressed={audioMuted}
              >
                全消音：{audioMuted ? "入" : "切"}
              </button>
              <button type="button" onClick={toggleHandedness}>
                操作配置：{handedness === "left" ? "左利き" : "右利き"}
              </button>
              <button type="button" onClick={cyclePerformance}>
                描画：{PERFORMANCE_CONFIG[performanceTier].label}
              </button>
            </div>
          </div>
        </div>
      )}
      {showTitle && (
        <div
          className="title-screen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="title-heading"
        >
          <p className="eyebrow">修験の刃 / PROLOGUE</p>
          <h2 id="title-heading">
            墨霞<span>の</span>剣
          </h2>
          <p>敵の予告を読み、防御・回避・斬撃を選ぶ。</p>
          <div className="title-choice-group">
            <span>勝負の長さ</span>
            <div className="title-choice-row">
              {(Object.keys(RUN_MODE_CONFIG) as RunMode[]).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  className={selectedMode === mode ? "is-selected" : ""}
                  onClick={() => setSelectedMode(mode)}
                >
                  <strong>{RUN_MODE_CONFIG[mode].label}</strong>
                  <small>{RUN_MODE_CONFIG[mode].description}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="title-choice-group">
            <span>難易度</span>
            <div className="title-choice-row difficulty-row">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(
                (difficulty) => (
                  <button
                    type="button"
                    key={difficulty}
                    className={
                      selectedDifficulty === difficulty ? "is-selected" : ""
                    }
                    onClick={() => setSelectedDifficulty(difficulty)}
                  >
                    <strong>{DIFFICULTY_CONFIG[difficulty].label}</strong>
                    <small>{DIFFICULTY_CONFIG[difficulty].description}</small>
                  </button>
                ),
              )}
            </div>
          </div>
          <button
            type="button"
            className="result-primary"
            onClick={() => startNewRun("yamabushi-start")}
          >
            新しく始める
          </button>
        </div>
      )}

      {showExitConfirm && (
        <div
          className="exit-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-title"
        >
          <div className="exit-panel">
            <p className="eyebrow">THE MOUNTAIN REMAINS</p>
            <h2 id="exit-title">ゲームを終了しますか？</h2>
            <p>この対決を離れると、現在の連撃とスコアは失われます。</p>
            <div className="exit-actions">
              <button
                type="button"
                className="exit-cancel"
                onClick={() => {
                  setShowExitConfirm(false);
                  dispatchGameEvent("yamabushi-pause", { paused: false });
                }}
              >
                ゲームに戻る
              </button>
              <button
                type="button"
                className="exit-leave"
                onClick={() => {
                  allowExit.current = true;
                  dispatchGameEvent("yamabushi-pause", { paused: false });
                  window.history.go(-1);
                }}
              >
                終了する
              </button>
            </div>
          </div>
        </div>
      )}
      <footer className="footer-note">
        <span>霧ノ峠　第一幕</span>
        <span>© 墨霞修験会</span>
      </footer>
    </main>
  );
}
