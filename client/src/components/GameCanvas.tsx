// 墨霞の修験道：Reactは枠、Babylon.jsは剣戟の舞台。全画面キャンバスの寿命をここで管理する。
import { useEffect, useRef } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";
import {
  PERFORMANCE_CONFIG,
  readPerformanceTier,
  type PerformanceTier,
} from "@/game/config";

function applyRenderQuality(engine: Engine, tier: PerformanceTier) {
  const devicePixelRatio = Math.min(2, window.devicePixelRatio || 1);
  const resolutionScale = PERFORMANCE_CONFIG[tier].resolutionScale;
  engine.setHardwareScalingLevel(
    Math.max(1, devicePixelRatio / resolutionScale),
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
      localStorage.getItem("yamabushi-performance"),
    );
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      adaptToDeviceRatio: false,
    });
    applyRenderQuality(engine, performanceTier);
    let handle: GameHandle | null = null;
    createGameScene(engine, canvas, performanceTier).then((next) => {
      handle = next;
      engine.runRenderLoop(() => next.scene.render());
    });
    const onResize = () => engine.resize();
    const onPerformance = (event: Event) => {
      const next = (event as CustomEvent<{ tier?: PerformanceTier }>).detail
        ?.tier;
      if (next !== "high" && next !== "balanced" && next !== "lite") return;
      performanceTier = next;
      localStorage.setItem("yamabushi-performance", next);
      applyRenderQuality(engine, performanceTier);
      engine.resize();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        window.dispatchEvent(
          new CustomEvent("yamabushi-pause", {
            detail: { paused: true, reason: "visibility" },
          }),
        );
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("yamabushi-performance", onPerformance);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("yamabushi-performance", onPerformance);
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
