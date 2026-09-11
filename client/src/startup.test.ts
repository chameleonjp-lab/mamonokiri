// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { INITIAL_GAME_STATE } from "./game/contracts";
import { safeStorage, STORAGE_UNAVAILABLE_MESSAGE } from "./game/storage";

const mocked = vi.hoisted(() => ({ Engine: vi.fn(), createScene: vi.fn() }));
vi.mock("@babylonjs/core/Engines/engine", () => ({ Engine: mocked.Engine }));
vi.mock("./game/scene", () => ({ createGameScene: mocked.createScene }));

// Actual React components and DOM events; only the unavailable GPU is replaced.
// This does not measure CSS layout or Safari rendering.
describe("title and 3D startup", () => {
  let root: Root;
  let container: HTMLDivElement;
  let handle: {
    scene: { render: ReturnType<typeof vi.fn> };
    dispose: ReturnType<typeof vi.fn>;
  };
  const button = (text: string) =>
    Array.from(container.querySelectorAll("button")).find(node =>
      node.textContent?.includes(text)
    )!;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    safeStorage.removeItem("mamonokiri.player-name");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    handle = { scene: { render: vi.fn() }, dispose: vi.fn() };
    mocked.Engine.mockReset().mockImplementation(() => ({
      dispose: vi.fn(),
      resize: vi.fn(),
      runRenderLoop: vi.fn(),
      stopRenderLoop: vi.fn(),
      setHardwareScalingLevel: vi.fn(),
    }));
    mocked.createScene.mockReset().mockResolvedValue(handle);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the title visible and blocks start until the first frame is ready", async () => {
    safeStorage.setItem("mamonokiri.player-name", "動作確認");
    let resolve!: (value: typeof handle) => void;
    mocked.createScene.mockImplementation(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    const started = vi.fn();
    window.addEventListener("yamabushi-start", started);
    try {
      await act(async () => root.render(createElement(App)));
      expect(container.querySelector(".title-screen")).not.toBeNull();
      expect(container.textContent).toContain("ゲーム画面を準備中です");
      expect(button("新しく始める").disabled).toBe(true);
      await act(async () => button("新しく始める").click());
      expect(started).not.toHaveBeenCalled();
      await act(async () => resolve(handle));
      expect(handle.scene.render).toHaveBeenCalledTimes(1);
      expect(button("新しく始める").disabled).toBe(false);
      await act(async () => button("新しく始める").click());
      expect(started).toHaveBeenCalledTimes(1);
      expect(container.querySelector(".title-screen")).toBeNull();
    } finally {
      window.removeEventListener("yamabushi-start", started);
    }
  });

  it("shows a failure and retries successfully without losing the name or title", async () => {
    safeStorage.setItem("mamonokiri.player-name", "再試行確認");
    mocked.Engine.mockImplementationOnce(() => {
      throw new Error("WebGL not supported");
    });
    await act(async () => root.render(createElement(App)));
    expect(container.textContent).toContain(
      "3Dのゲーム画面を準備できませんでした"
    );
    expect(button("新しく始める").disabled).toBe(true);
    expect(
      (container.querySelector("#player-name") as HTMLInputElement).value
    ).toBe("再試行確認");
    await act(async () => button("画面の準備をやり直す").click());
    expect(button("新しく始める").disabled).toBe(false);
    expect(container.textContent).not.toContain(
      "3Dのゲーム画面を準備できませんでした"
    );
    expect(container.querySelector(".title-screen")).not.toBeNull();
    expect(mocked.Engine).toHaveBeenCalledTimes(2);
  });

  it("keeps the title and settings usable when reading and writing storage fail", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    });
    await act(async () => root.render(createElement(App)));
    expect(container.querySelector(".title-screen")).not.toBeNull();
    expect(container.textContent).toContain(STORAGE_UNAVAILABLE_MESSAGE);
    expect(button("演出：").textContent).toContain("標準");
    await act(async () => button("演出：").click());
    expect(button("演出：").textContent).toContain("軽量");
    expect(container.textContent).toContain(STORAGE_UNAVAILABLE_MESSAGE);
    expect(button("新しく始める").disabled).toBe(false);
  });

  it("keeps submission failure visible while ranking reads succeed and retries the same run idempotently", async () => {
    safeStorage.setItem("mamonokiri.player-name", "通信確認");
    const responses = [
      { ok: false, status: 503, body: "temporarily unavailable" },
      {
        ok: true,
        status: 200,
        body: JSON.stringify([{ display_name: "上位", best_score: 900 }]),
      },
      {
        ok: true,
        status: 200,
        body: JSON.stringify([{ accepted: true, duplicate: true }]),
      },
      {
        ok: true,
        status: 200,
        body: JSON.stringify([{ display_name: "上位", best_score: 900 }]),
      },
    ];
    const fetchMock = vi.fn().mockImplementation(async () => {
      const next = responses.shift();
      if (!next) throw new Error("unexpected fetch");
      return {
        ok: next.ok,
        status: next.status,
        text: async () => next.body,
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => root.render(createElement(App)));
    const result = {
      ...INITIAL_GAME_STATE,
      mode: "ten" as const,
      modeLimit: 10,
      runId: "22222222-2222-4222-8222-222222222222",
      seed: 321,
      score: 1234,
      wave: 10,
      enemyHp: 0,
      defeated: true,
    };
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("yamabushi-state", { detail: result })
      );
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain(
      "今回のスコアを送信できませんでした。再送信できます。"
    );
    expect(container.textContent).toContain(
      "このモード・難易度・得点規則の上位10名を表示しています。"
    );
    expect(button("スコアを再送信")).not.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      button("スコアを再送信").click();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(container.textContent).toContain(
      "同じ勝負IDは重複登録しません。送信済みの結果を再利用しました。"
    );
    expect(container.textContent).toContain("1位 上位");
  });
});
