import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("responsive UI contract", () => {
  it("reserves one stacked region for guidance and live battle text", () => {
    expect(appSource).toContain('className="battle-copy"');
    expect(cssSource).toContain(".battle-copy");
    expect(cssSource).toContain(".battle-copy .combat-guide");
    expect(cssSource).toContain(".battle-copy .message");
    expect(cssSource).toContain(".battle-copy .stance");
    expect(cssSource).toContain("white-space: normal");
  });

  it("keeps keyboard and touch controls exclusive by viewport", () => {
    expect(appSource).toContain('className="controls desktop-controls"');
    expect(appSource).toContain('className="mobile-controls gameboy-controls"');
    expect(cssSource).toMatch(
      /@media \(min-width: 561px\)[\s\S]*?\.gameboy-controls\s*\{\s*display: none !important/
    );
    expect(cssSource).toMatch(
      /@media \(max-width: 560px\)[\s\S]*?\.desktop-controls\s*\{\s*display: none !important/
    );
    expect(cssSource).toMatch(
      /@media \(max-height: 500px\) and \(orientation: landscape\) and \(pointer: coarse\)[\s\S]*?\.gameboy-controls\s*\{\s*display: flex !important/
    );
  });

  it("uses Japanese labels for gameplay-critical controls and status", () => {
    for (const oldLabel of [
      "PROLOGUE",
      "CURRENT EXCHANGE",
      "SCORE / CHAIN",
      "MOVE",
      "LEFT",
      "RIGHT",
      "ACTION",
      "SLASH",
      "GUARD",
      "CHAPTER CLEARED",
      "RESULT RECORD",
      "TOP 10",
      "THE BLADE RESTS",
    ]) {
      expect(appSource).not.toContain(oldLabel);
    }
    for (const label of [
      "現在の読み合い",
      "得点・連撃",
      "キーボード操作",
      "タッチ操作",
      "結果の記録",
      "上位10名",
      "刃を休める",
    ]) {
      expect(appSource).toContain(label);
    }
  });

  it("keeps the title guidance actionable in Japanese", () => {
    expect(appSource).toContain(
      "敵の予告を見て、左・右へ避けるか、防御してから斬る。"
    );
    expect(appSource).toContain("赤い危険線の反対側へ移動");
    expect(appSource).toContain("攻撃直前に防御し、受け流したら斬る");
    expect(appSource).toContain("青い輪は防御中。斬で崩す。");
  });
});
