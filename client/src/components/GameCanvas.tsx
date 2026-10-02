// React owns the canvas lifetime; the title remains usable when 3D cannot start.
import { useEffect, useRef } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";
import { startGameRuntime } from "@/game/bootstrap";
import type { GameState, SceneStatus } from "@/game/contracts";
import { safeStorage } from "@/game/storage";
import {
  hardwareScalingLevelFor,
  readPerformanceTier,
  SETTINGS_STORAGE_KEYS,
  type PerformanceTier,
} from "@/game/config";

function applyRenderQuality(engine: Engine, tier: PerformanceTier) {
  engine.setHardwareScalingLevel(
    hardwareScalingLevelFor(tier, window.devicePixelRatio || 1)
  );
}

export default function GameCanvas({
  attempt,
  onStatusChange,
}: {
  attempt: number;
  onStatusChange: (status: SceneStatus) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: Engine | null = null;
    let handle: GameHandle | null = null;
    let disposed = false;
    let battleRenderActive = false;
    let renderLoopRunning = false;
    let motionStopTimer: number | null = null;
    let removeRestoreObserver: (() => void) | null = null;
    const renderFrame = () => handle?.scene.render();
    const setBattleRenderActive = (active: boolean) => {
      battleRenderActive = active;
      if (!handle || !engine) return;
      if (active && !renderLoopRunning) {
        renderLoopRunning = true;
        engine.runRenderLoop(renderFrame);
      } else if (!active) {
        if (renderLoopRunning) {
          engine.stopRenderLoop(renderFrame);
          renderLoopRunning = false;
        } else {
          renderFrame();
        }
      }
    };
    const onResize = () => {
      engine?.resize();
      const bounds = canvas.getBoundingClientRect();
      const hudBottom = Math.max(
        0,
        ...Array.from(
          document.querySelectorAll(".hud-card, .pause-button")
        ).map(node => node.getBoundingClientRect().bottom)
      );
      const copy = document
        .querySelector(".battle-copy")
        ?.getBoundingClientRect();
      const top = Math.min(bounds.height * 0.3, hudBottom + 8);
      const bottom = Math.max(
        top + bounds.height * 0.35,
        copy?.top ?? bounds.height * 0.8
      );
      if (bounds.width > 0 && bounds.height > 0)
        window.dispatchEvent(
          new CustomEvent("yamabushi-viewport", {
            detail: {
              top: top / bounds.height,
              bottom: Math.min(bounds.height, bottom) / bounds.height,
            },
          })
        );
      if (!battleRenderActive) renderFrame();
    };
    const onGameState = (event: Event) => {
      const state = (event as CustomEvent<GameState>).detail;
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
      if (
        !engine ||
        (next !== "high" && next !== "balanced" && next !== "lite")
      )
        return;
      safeStorage.setItem(SETTINGS_STORAGE_KEYS.performance, next);
      applyRenderQuality(engine, next);
      onResize();
    };
    const pauseForInterruption = (
      reason: "visibility" | "pagehide" | "pageshow"
    ) => {
      window.dispatchEvent(
        new CustomEvent("yamabushi-pause", {
          detail: { paused: true, reason },
        })
      );
    };
    const onVisibilityChange = () => pauseForInterruption("visibility");
    const onPageHide = () => pauseForInterruption("pagehide");
    const onPageShow = () => pauseForInterruption("pageshow");
    const onContextLost = (event: Event) => {
      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent("yamabushi-pause", {
          detail: { paused: true, reason: "context-lost" },
        })
      );
      onStatusChange({ phase: "error", reason: "context-lost" });
    };
    const onContextRestored = () => {
      if (disposed || !handle || !engine) return;
      try {
        onResize();
        onStatusChange({ phase: "ready" });
      } catch {
        onStatusChange({ phase: "error", reason: "context-lost" });
      }
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () =>
      window.dispatchEvent(
        new CustomEvent("yamabushi-motion", {
          detail: { reduced: reducedMotion.matches },
        })
      );
    reducedMotion.addEventListener("change", onMotion);
    const resizeObserver = new ResizeObserver(onResize);
    document
      .querySelectorAll(".hud-card, .battle-copy, .gameboy-controls")
      .forEach(node => resizeObserver.observe(node));
    window.addEventListener("resize", onResize);
    window.addEventListener("yamabushi-state", onGameState);
    window.addEventListener("yamabushi-performance", onPerformance);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);

    onStatusChange({ phase: "loading" });
    const runtime = startGameRuntime({
      createEngine: () =>
        new Engine(canvas, true, {
          preserveDrawingBuffer: false,
          stencil: true,
          adaptToDeviceRatio: false,
        }),
      createScene: async nextEngine => {
        engine = nextEngine;
        // Babylon rebuilds GPU resources asynchronously after the canvas event.
        // Readiness follows its restoration observable and a successful frame.
        if (nextEngine.onContextRestoredObservable) {
          const observer =
            nextEngine.onContextRestoredObservable.add(onContextRestored);
          removeRestoreObserver = () =>
            nextEngine.onContextRestoredObservable.remove(observer);
        }
        const tier = readPerformanceTier(
          safeStorage.getItem(SETTINGS_STORAGE_KEYS.performance)
        );
        applyRenderQuality(nextEngine, tier);
        return createGameScene(nextEngine, tier);
      },
      onReady: next => {
        handle = next;
        // A scene is ready only after the first frame has actually succeeded.
        onResize();
        onMotion();
        if (battleRenderActive) setBattleRenderActive(true);
        onStatusChange({ phase: "ready" });
      },
      onError: error => {
        engine = null;
        handle = null;
        renderLoopRunning = false;
        console.error("Game scene initialization failed", error);
        onStatusChange({
          phase: "error",
          reason:
            (Engine.isSupported?.() ?? true) ? "initialization" : "unsupported",
        });
      },
    });
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      reducedMotion.removeEventListener("change", onMotion);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      removeRestoreObserver?.();
      if (motionStopTimer !== null) window.clearTimeout(motionStopTimer);
      if (renderLoopRunning) engine?.stopRenderLoop(renderFrame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("yamabushi-state", onGameState);
      window.removeEventListener("yamabushi-performance", onPerformance);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      runtime.dispose();
      handle = null;
      engine = null;
    };
  }, [attempt, onStatusChange]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full outline-none"
      style={{ touchAction: "none" }}
      aria-hidden="true"
    />
  );
}
