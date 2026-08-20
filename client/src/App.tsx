// 墨霞の修験道：中央は剣戟の余白、情報は四隅へ。UIも能舞台のように静かに置く。
import { useEffect, useRef, useState } from "react";
import GameCanvas from "@/components/GameCanvas";

type GameState = {
  hp: number;
  enemyHp: number;
  enemyMaxHp: number;
  wave: number;
  remainingEnemies: number;
  boss: boolean;
  bossDefeatPulse: number;
  enemyName: string;
  enemyEpithet: string;
  enemyFamily: string;
  enemyAttackStyle: "left" | "right" | "alternate" | "wide" | "target";
  enemyPhase: string;
  counterReady: boolean;
  counterPulse: number;
  stance: string;
  message: string;
  defeated: boolean;
  combo: number;
  maxCombo: number;
  score: number;
  comboTime: number;
  climax: number;
  paused: boolean;
  transitioning: boolean;
  tutorialStep: number;
};

const initial: GameState = {
  hp: 100,
  enemyHp: 100,
  enemyMaxHp: 100,
  wave: 1,
  remainingEnemies: 50,
  boss: false,
  bossDefeatPulse: 0,
  enemyName: "影面",
  enemyEpithet: "左薙の影",
  enemyFamily: "通常",
  enemyAttackStyle: "left",
  enemyPhase: "巡回",
  counterReady: false,
  counterPulse: 0,
  stance: "静止",
  message: "第1試練。左槍の予告を見て、右へ避けよ。",
  defeated: false,
  combo: 0,
  maxCombo: 0,
  score: 0,
  comboTime: 0,
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

function dispatchGameEvent(name: string, detail: Record<string, unknown> = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export default function App() {
  const [state, setState] = useState(initial);
  const [showClimax, setShowClimax] = useState(false);
  const [showBossVictory, setShowBossVictory] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [effectLevel, setEffectLevel] = useState<"full" | "reduced" | "minimal">(() => (localStorage.getItem("yamabushi-effects") as "full" | "reduced" | "minimal" | null) ?? "full");
  const [ambientVolume, setAmbientVolume] = useState(() => Number(localStorage.getItem("yamabushi-ambient-volume") ?? "0.7"));
  const previousClimax = useRef(0);
  const previousCounter = useRef(0);
  const previousBossVictory = useRef(0);
  const swipeStart = useRef<{ x: number; y: number; at: number } | null>(null);
  const allowExit = useRef(false);
  const exitConfirmRef = useRef(false);
  exitConfirmRef.current = showExitConfirm;

  const cycleEffects = () => {
    const next = effectLevel === "full" ? "reduced" : effectLevel === "reduced" ? "minimal" : "full";
    setEffectLevel(next);
    localStorage.setItem("yamabushi-effects", next);
    dispatchGameEvent("yamabushi-effects", { level: next });
  };

  const cycleAmbient = () => {
    const next = ambientVolume >= 0.99 ? 0.35 : ambientVolume <= 0.36 ? 0.7 : 1;
    setAmbientVolume(next);
    localStorage.setItem("yamabushi-ambient-volume", String(next));
    dispatchGameEvent("yamabushi-audio", { ambientVolume: next });
  };

  const startNewRun = (eventName = "yamabushi-restart") => {
    setShowPause(false);
    setShowTitle(false);
    setShowExitConfirm(false);
    dispatchGameEvent(eventName);
  };

  const openTitle = () => {
    setShowPause(false);
    setShowExitConfirm(false);
    setShowTitle(true);
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
      if (next.paused && !next.defeated && !exitConfirmRef.current) setShowPause(true);
      if (!next.paused) {
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
      window.history.pushState({ yamabushiGame: true }, "", window.location.href);
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
    if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button")) return;
    swipeStart.current = { x: event.clientX, y: event.clientY, at: performance.now() };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || event.pointerType === "mouse" || (event.target as HTMLElement).closest("button")) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.15 && performance.now() - start.at < 650) {
      dispatchGameEvent("yamabushi-dodge", { direction: dx < 0 ? -1 : 1 });
    }
  };

  return (
    <main className="game-shell" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
      <GameCanvas />
      <div className={`threat-vignette ${state.enemyPhase === "予備" ? "is-warning" : ""}`} aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      {showClimax && <div className="climax-fx" aria-live="assertive"><span className="slash slash-a" /><span className="slash slash-b" /><span className="burst burst-a" /><span className="burst burst-b" /><div className="climax-copy"><small>修験成就 / COMBO MILESTONE</small><strong>{state.combo >= 20 ? state.combo : "十連"}</strong><em>刃、迷いなし。</em></div></div>}
      {showCounter && <div className="counter-fx" aria-live="assertive"><span className="counter-ring" /><small>COUNTER SUCCESS</small><strong>{state.combo}<em> CHAIN</em></strong><span>受け流し・反撃加算</span></div>}
      {showBossVictory && <div className="boss-victory-fx" aria-live="assertive"><span className="victory-rays" /><small>THE MOUNTAIN LORD FALLS</small><strong>峠の主、断つ</strong><em>生命の護り +30</em><b>体力 {state.hp} / 100</b></div>}

      <header className="brand-lockup"><div className="crest" aria-hidden="true"><i /><i /><i /></div><div><p className="eyebrow">修験の刃 / PROLOGUE</p><h1>墨霞<span>の</span>剣</h1></div></header>
      <button type="button" className="pause-button" aria-label="一時停止" onClick={() => dispatchGameEvent("yamabushi-pause", { paused: true, reason: "manual" })} disabled={state.defeated || showTitle}>一時停止</button>

      <section className="hud hud-card player-hud"><div className="hud-card-head"><div className="hud-label"><span>山伏</span><small>YAMABUSHI</small></div><span className="hud-kicker">PLAYER</span></div><Bar value={state.hp} tone="player" /><div className="stat-line"><span>体力</span><strong>{String(state.hp).padStart(3, "0")}</strong></div></section>
      <section className={`hud hud-card enemy-hud ${state.boss ? "boss-hud" : ""}`}><div className="hud-card-head"><div className="hud-label align-right"><span>{state.enemyName}</span><small>{state.boss ? `${state.enemyFamily} / BOSS ${state.wave}` : `${state.enemyFamily}・${state.enemyEpithet} / ${state.wave}体目`}</small></div><span className={`enemy-phase phase-${state.enemyPhase}`}>{state.enemyPhase === "防御" ? "GUARD" : state.boss ? "BOSS" : state.enemyPhase}</span></div><Bar value={(state.enemyHp / Math.max(1, state.enemyMaxHp)) * 100} tone="enemy" /><div className="stat-line align-right"><span>{state.enemyPhase === "防御" ? "青輪・防御中" : state.enemyAttackStyle === "wide" ? "両側" : state.enemyAttackStyle === "left" ? "左槍" : state.enemyAttackStyle === "right" ? "右槍" : state.enemyAttackStyle === "alternate" ? "交互" : "追尾"}</span><strong>{String(state.enemyHp).padStart(3, "0")}</strong></div><div className="enemy-count">残敵 <strong>{String(state.remainingEnemies).padStart(2, "0")}</strong> / 50</div></section>

      <section className={`score-hud ${state.combo ? "is-combo" : ""}`}><div className="audio-toggles"><button type="button" className="effect-toggle" onClick={cycleEffects} aria-label="演出強度を切り替える">演出 {effectLevel === "full" ? "標準" : effectLevel === "reduced" ? "軽量" : "最小"}</button><button type="button" className="audio-toggle" onClick={cycleAmbient} aria-label="環境音量を切り替える">環境音 {ambientVolume >= 0.99 ? "大" : ambientVolume <= 0.36 ? "小" : "中"}</button></div><div className="score-label">SCORE / CHAIN</div><strong>{String(state.score).padStart(6, "0")}</strong>{state.combo > 0 && <div className="combo-readout"><span>連撃</span><b>{state.combo}</b><em>x</em></div>}{state.combo > 0 && <div className="combo-meter"><i style={{ width: `${state.comboTime * 100}%` }} /></div>}</section>
      {state.tutorialStep > 0 && !state.defeated && <aside className="combat-guide" aria-label="序盤の操作ガイド"><b>{state.tutorialStep === 3 ? "K" : state.tutorialStep === 1 ? "右" : "左"}</b> {state.tutorialStep === 3 ? "防御し、受け流し後にJで反撃" : "予告と反対側へ回避"}</aside>}
      <div className="stance"><span className="dot" />構え <strong>{state.stance}</strong>{state.counterReady && <small className="counter-ready">反撃受付 / J</small>}{state.enemyPhase === "防御" && <small className="guard-break-ready">青輪 GUARD / 防御崩し J</small>}{state.combo > 0 && <small>連撃継続中</small>}</div>
      <div className="message"><span className="message-caption">CURRENT EXCHANGE</span><span className="message-mark">「</span>{state.message}<span className="message-mark">」</span></div>

      <section className="controls"><span className="control-key">J</span><span>斬る</span><span className="control-key">K</span><span>防御</span><span className="control-key wide">SHIFT</span><span>かわす</span></section>
      <section className="mobile-controls gameboy-controls" aria-label="タッチ操作"><div className="move-controls gameboy-dpad"><span className="mobile-group-label">MOVE</span><div className="dpad-row"><button type="button" className="gb-btn direction-btn" aria-label="左へ回避" onClick={() => dispatchGameEvent("yamabushi-dodge", { direction: -1 })}><b>◀</b><small>LEFT</small></button><button type="button" className="gb-btn direction-btn" aria-label="右へ回避" onClick={() => dispatchGameEvent("yamabushi-dodge", { direction: 1 })}><b>▶</b><small>RIGHT</small></button></div></div><div className="combat-controls gameboy-actions"><span className="mobile-group-label">ACTION</span><div className="action-row"><button type="button" className="gb-btn action-btn slash-btn" aria-label="斬る" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }))}><b>斬</b><small>SLASH</small></button><button type="button" className="gb-btn action-btn guard-btn" aria-label="防御" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }))}><b>防</b><small>GUARD</small></button></div></div></section>

      {state.defeated && <div className="result-card" role="dialog" aria-modal="true" aria-labelledby="result-title"><p className="eyebrow">THE MOUNTAIN REMAINS</p><h2 id="result-title">{state.enemyHp === 0 && state.wave >= 50 ? "敵影、断つ" : "霧に沈む"}</h2><p>到達 {state.wave}体目　／　撃破 {state.enemyHp === 0 && state.wave >= 50 ? 50 : Math.max(0, state.wave - 1)}体</p><p>スコア {state.score}　／　最大連撃 {state.maxCombo}</p><div className="result-actions"><button type="button" className="result-primary" onClick={startNewRun}>もう一度遊ぶ</button><button type="button" className="result-secondary" onClick={openTitle}>最初の画面へ戻る</button></div></div>}
      {showPause && !state.defeated && !showTitle && <div className="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title"><div className="pause-panel"><p className="eyebrow">THE BLADE RESTS</p><h2 id="pause-title">一時停止</h2><p>停止中は攻撃・防御・回避・連撃の時間が進みません。</p><div className="pause-actions"><button type="button" className="result-primary" onClick={resumeGame}>再開</button><button type="button" className="result-secondary" onClick={() => { setShowPause(false); dispatchGameEvent("yamabushi-retire"); }}>リタイア</button><button type="button" className="result-secondary" onClick={startNewRun}>最初から</button><button type="button" className="result-secondary" onClick={openTitle}>タイトルへ</button></div><div className="pause-settings"><button type="button" onClick={cycleEffects}>演出：{effectLevel === "full" ? "標準" : effectLevel === "reduced" ? "軽量" : "最小"}</button><button type="button" onClick={cycleAmbient}>環境音：{ambientVolume >= 0.99 ? "大" : ambientVolume <= 0.36 ? "小" : "中"}</button></div></div></div>}
      {showTitle && <div className="title-screen" role="dialog" aria-modal="true" aria-labelledby="title-heading"><p className="eyebrow">修験の刃 / PROLOGUE</p><h2 id="title-heading">墨霞<span>の</span>剣</h2><p>敵の予告を読み、防御・回避・斬撃を選ぶ。</p><button type="button" className="result-primary" onClick={() => startNewRun("yamabushi-start")}>新しく始める</button></div>}

      {showExitConfirm && <div className="exit-confirm" role="dialog" aria-modal="true" aria-labelledby="exit-title"><div className="exit-panel"><p className="eyebrow">THE MOUNTAIN REMAINS</p><h2 id="exit-title">ゲームを終了しますか？</h2><p>この対決を離れると、現在の連撃とスコアは失われます。</p><div className="exit-actions"><button type="button" className="exit-cancel" onClick={() => { setShowExitConfirm(false); dispatchGameEvent("yamabushi-pause", { paused: false }); }}>ゲームに戻る</button><button type="button" className="exit-leave" onClick={() => { allowExit.current = true; dispatchGameEvent("yamabushi-pause", { paused: false }); window.history.go(-1); }}>終了する</button></div></div></div>}
      <footer className="footer-note"><span>霧ノ峠　第一幕</span><span>© 墨霞修験会</span></footer>
    </main>
  );
}
