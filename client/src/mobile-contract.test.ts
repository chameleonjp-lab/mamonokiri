import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const canvasSource = readFileSync(
  new URL("./components/GameCanvas.tsx", import.meta.url),
  "utf8",
);
const sceneSource = readFileSync(
  new URL("./game/scene.ts", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const htmlSource = readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8",
);

describe("smartphone play contract", () => {
  it("uses a Japanese, safe-area-aware viewport without disabling menu zoom", () => {
    expect(htmlSource).toContain('<html lang="ja">');
    expect(htmlSource).toContain("viewport-fit=cover");
    expect(htmlSource).not.toContain("maximum-scale");
  });

  it("keeps touch actions independent from keyboard-only events and labels", () => {
    expect(appSource).toContain('dispatchGameEvent("yamabushi-slash")');
    expect(appSource).toContain('dispatchGameEvent("yamabushi-guard")');
    expect(appSource).not.toContain("new KeyboardEvent");
    expect(appSource).not.toContain("反撃受付 / J");
    expect(appSource).not.toContain("防御崩し J");
  });

  it("keeps every overlay scrollable while the live battle surface stays fixed", () => {
    expect(appSource).toContain('overlayOpen ? "is-overlay-open"');
    expect(cssSource).toContain(".game-shell.is-overlay-open");
    expect(cssSource).toContain("touch-action: pan-y pinch-zoom");
    expect(cssSource).toContain("height: 100dvh");
    expect(cssSource).toContain("max-height: 500px");
  });

  it("pauses for Safari interruption and grants an explicit safe resume window", () => {
    expect(canvasSource).toContain('window.addEventListener("pagehide"');
    expect(canvasSource).toContain('window.addEventListener("pageshow"');
    expect(appSource).toContain("resumeGraceMs: RESUME_GRACE_MS");
    expect(sceneSource).toContain("pauseDuration + resumeGraceMs");
  });

  it("stops continuous 3D rendering while a menu or result overlay is open", () => {
    expect(canvasSource).toContain('window.addEventListener("yamabushi-state"');
    expect(canvasSource).toContain("engine.stopRenderLoop(renderFrame)");
  });

  it("requires a real tutorial success before slash can advance the first three fights", () => {
    expect(sceneSource).toContain(
      "canSlashDuringTutorial(tutorialStep, tutorialObjectiveMet)",
    );
    expect(sceneSource).toContain("tutorialObjectiveMet = true");
  });

  it("keeps result records and replay settings tied to the completed run", () => {
    expect(appSource).toContain("自己最高 {state.bestScore}点");
    expect(appSource).toContain("const restartCurrentRun = () =>");
    expect(appSource).toContain("mode: state.mode");
    expect(appSource).toContain("difficulty: state.difficulty");
  });

  it("clears transient attack direction state before a retry starts", () => {
    expect(sceneSource).toMatch(/spearAttackSide = 0;\s+dangerLane = 0;/);
    expect(sceneSource).toMatch(/recoilUntil = 0;\s+recoilDirection = 1;/);
  });

  it("counts posture-break damage as a hit and resets the combo", () => {
    expect(sceneSource).toMatch(
      /hp = applyDamage\(hp, 10\)\.hp;\s+hitsTaken \+= 1;\s+enemyHitTaken = true;\s+combo = 0;\s+comboMilestone = 0;/,
    );
  });

  it("limits the R shortcut to the defeated result state", () => {
    expect(sceneSource).toMatch(
      /if \(key === "r"\) \{\s+if \(!paused && defeated\)\s+resetRun\(/,
    );
  });

  it("routes enemy hit detection through the shared danger-line rule", () => {
    expect(sceneSource).toContain("isPlayerInDangerLine(");
    expect(sceneSource).not.toContain(
      "Math.abs(player.root.position.x - dangerLane * 0.9) < hitWidth",
    );
  });

  it("clears React-only milestone overlays and swipe state on retry", () => {
    const startNewRunBlock =
      appSource.match(
        /const startNewRun = \([\s\S]*?\n  \};\n\n  const restartCurrentRun/m,
      )?.[0] ?? "";
    expect(startNewRunBlock).toContain("setShowClimax(false)");
    expect(startNewRunBlock).toContain("setShowCounter(false)");
    expect(startNewRunBlock).toContain("setShowBossVictory(false)");
    expect(startNewRunBlock).toContain("previousClimax.current = 0");
    expect(startNewRunBlock).toContain("previousCounter.current = 0");
    expect(startNewRunBlock).toContain("previousBossVictory.current = 0");
    expect(startNewRunBlock).toContain("swipeStart.current = null");
  });

  it("keeps the production render pack connected to the title showcase", () => {
    expect(appSource).toContain(
      "import.meta.env.BASE_URL",
    );
    expect(appSource).toContain(
      "assets/production/mamonokiri-arena-mist-shrine-v1.webp",
    );
    expect(appSource).toContain(
      "assets/production/mamonokiri-player-yamabushi-v1.webp",
    );
    expect(appSource).toContain(
      "assets/production/mamonokiri-enemy-kagemen-v1.webp",
    );
    expect(appSource).toContain(
      "assets/production/mamonokiri-boss-garei-v1.webp",
    );
  });
});
