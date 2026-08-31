// 墨霞の修験道：Reactは枠、Babylon.jsは剣戟の舞台。全画面キャンバスの寿命をここで管理する。
import { useEffect, useRef } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";
import {
  hardwareScalingLevelFor,
  readPerformanceTier,
  SETTINGS_STORAGE_KEYS,
  type PerformanceTier,
} from "@/game/config";

function applyRenderQuality(engine: Engine, tier: PerformanceTier) {
  engine.setHardwareScalingLevel(
    hardwareScalingLevelFor(tier, window.devicePixelRatio || 1),
  );
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;
    let performanceTier = readPerformanceTier(
      localStorage.getItem(SETTINGS_STORAGE_KEYS.performance),
    );
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      adaptToDeviceRatio: false,
    });
    applyRenderQuality(engine, performanceTier);
    let handle: GameHandle | null = null;
    let disposed = false;
    let battleRenderActive = false;
    let renderLoopRunning = false;
    let motionStopTimer: number | null = null;
    const renderFrame = () => handle?.scene.render();
    const setBattleRenderActive = (active: boolean) => {
      battleRenderActive = active;
      if (!handle) return;
      if (active && !renderLoopRunning) {
        renderLoopRunning = true;
        engine.runRenderLoop(renderFrame);
        return;
      }
      if (!active) {
        if (renderLoopRunning) {
          engine.stopRenderLoop(renderFrame);
          renderLoopRunning = false;
          return;
        }
        renderFrame();
      }
    };
    createGameScene(engine, performanceTier).then((next) => {
      if (disposed) {
        next.dispose();
        return;
      }
      handle = next;
      setBattleRenderActive(battleRenderActive);
    });
    const onResize = () => {
      engine.resize();
      if (!battleRenderActive) renderFrame();
    };
    const onGameState = (event: Event) => {
      const state = (
        event as CustomEvent<{
          paused?: boolean;
          defeated?: boolean;
          rewardPending?: boolean;
        }>
      ).detail;
      if (motionStopTimer !== null) {
        window.clearTimeout(motionStopTimer);
        motionStopTimer = null;
      }
      if (state?.defeated || state?.rewardPending) {
        setBattleRenderActive(true);
        motionStopTimer = window.setTimeout(() => {
          motionStopTimer = null;
          if (!disposed) setBattleRenderActive(false);
        }, 1050);
        return;
      }
      setBattleRenderActive(!state?.paused);
    };
    const onPerformance = (event: Event) => {
      const next = (event as CustomEvent<{ tier?: PerformanceTier }>).detail
        ?.tier;
      if (next !== "high" && next !== "balanced" && next !== "lite") return;
      performanceTier = next;
      localStorage.setItem(SETTINGS_STORAGE_KEYS.performance, next);
      applyRenderQuality(engine, performanceTier);
      engine.resize();
      if (!battleRenderActive) renderFrame();
    };
    const pauseForInterruption = (
      reason: "visibility" | "pagehide" | "pageshow",
    ) => {
      window.dispatchEvent(
        new CustomEvent("yamabushi-pause", {
          detail: { paused: true, reason },
        }),
      );
    };
    const onVisibilityChange = () => pauseForInterruption("visibility");
    const onPageHide = () => pauseForInterruption("pagehide");
    const onPageShow = () => pauseForInterruption("pageshow");
    window.addEventListener("resize", onResize);
    window.addEventListener("yamabushi-state", onGameState);
    window.addEventListener("yamabushi-performance", onPerformance);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      if (motionStopTimer !== null) window.clearTimeout(motionStopTimer);
      if (renderLoopRunning) engine.stopRenderLoop(renderFrame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("yamabushi-state", onGameState);
      window.removeEventListener("yamabushi-performance", onPerformance);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      handle?.dispose();
      engine.dispose();
      startedRef.current = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full outline-none"
      style={{ touchAction: "none" }}
    />
  );
}
