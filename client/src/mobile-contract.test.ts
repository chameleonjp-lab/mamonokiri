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
const viteConfigSource = readFileSync(
  new URL("../../vite.config.ts", import.meta.url),
  "utf8",
);

describe("smartphone play contract", () => {
  it("uses a Japanese, safe-area-aware viewport without disabling menu zoom", () => {
    expect(htmlSource).toContain('<html lang="ja">');
    expect(htmlSource).toContain("viewport-fit=cover");
    expect(htmlSource).not.toContain("maximum-scale");
  });

  it("keeps touch actions independent from keyboard-only events and labels", () => {
    expect(appSource).toContain('"yamabushi-slash"');
    expect(appSource).toContain('"yamabushi-guard"');
    expect(appSource).toContain("handleMobileActionPointerDown");
    expect(appSource).toContain("handleMobileActionClick");
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
    expect(canvasSource).toContain("state?.defeated || state?.rewardPending");
  });

  it("keeps tutorial guidance while allowing slash input to animate", () => {
    expect(sceneSource).toMatch(
      /canSlashDuringTutorial\(\s*tutorialStep,\s*tutorialObjectiveMet,?\s*\)/,
    );
    expect(sceneSource).toContain("const tutorialHint");
    expect(sceneSource).toContain('"斬撃を放つ。"');
    expect(sceneSource).toContain("launchPlayerSlash(now, direction)");
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

  it("keeps the title showcase independent from image and texture assets", () => {
    expect(appSource).toContain("procedural-title-visual");
    expect(appSource).toContain("code-figure-player");
    expect(appSource).toContain("code-figure-enemy");
    expect(appSource).not.toContain("<img");
    expect(appSource).not.toContain("assets/production/");
    expect(cssSource).not.toContain("data:image");
  });

  it("keeps time-based HUD values synchronized during an active fight", () => {
    expect(sceneSource).toContain("const UI_SYNC_INTERVAL_MS = 100;");
    expect(sceneSource).toMatch(
      /if \(\s+!defeated &&\s+!rewardPending &&\s+now - lastUiSyncAt >= UI_SYNC_INTERVAL_MS\s+\) \{\s+lastUiSyncAt = now;\s+announce\(state\(\)\);\s+\}/,
    );
  });

  it("keeps the battle camera fixed so touch gestures stay game controls", () => {
    expect(sceneSource).not.toContain("attachControl(");
  });

  it("keeps portrait HUD layers separated and the title surface opaque", () => {
    expect(cssSource).toContain(
      "top: calc(clamp(128px, 17dvh, 152px) + env(safe-area-inset-top))",
    );
    expect(cssSource).toContain(
      "background: radial-gradient(ellipse at center, #1d2226 0%, #06090b 72%)",
    );
  });

  it("does not silently discard a playable slash because of 3D depth distance", () => {
    expect(sceneSource).toContain('"斬撃を放つ。"');
    expect(sceneSource).not.toContain(
      "Vector3.Distance(player.root.position, enemy.root.position) < 6",
    );
  });

  it("keeps Manus editor hooks out of the app build configuration", () => {
    expect(viteConfigSource).not.toMatch(/manus/i);
    expect(viteConfigSource).not.toContain("BUILT_IN_FORGE_API");
    expect(viteConfigSource).not.toContain("jsxLocPlugin");
  });
});
