// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shareOrCopy } from "./sharing";
beforeEach(() => {
  vi.stubGlobal("navigator", {
    share: vi.fn(),
    clipboard: { writeText: vi.fn() },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("sharing lifecycle", () => {
  it("reports handoff without claiming external posting", async () => {
    vi.spyOn(navigator, "share").mockResolvedValue(undefined);
    const status = vi.fn();
    await shareOrCopy("result", "https://example.com", status);
    expect(status).toHaveBeenLastCalledWith("共有先へ渡しました。");
  });
  it("does not copy after cancellation", async () => {
    vi.spyOn(navigator, "share").mockRejectedValue(
      new DOMException("cancel", "AbortError")
    );
    const copy = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    const status = vi.fn();
    await shareOrCopy("result", "https://example.com", status);
    expect(copy).not.toHaveBeenCalled();
    expect(status).toHaveBeenLastCalledWith("共有を取り消しました。");
  });
  it("ignores a stale completion and does not start fallback copying on another screen", async () => {
    let reject!: (e: Error) => void;
    let current = true;
    vi.spyOn(navigator, "share").mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        })
    );
    const copy = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    const status = vi.fn();
    const pending = shareOrCopy(
      "result",
      "https://example.com",
      status,
      () => current
    );
    current = false;
    reject(new Error("late failure"));
    await pending;
    expect(copy).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledTimes(1);
  });
  it("reports clipboard failure and preserves manual selection", async () => {
    vi.spyOn(navigator, "share").mockRejectedValue(new Error("unavailable"));
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied")
    );
    const status = vi.fn();
    await shareOrCopy("result", "https://example.com", status);
    expect(status).toHaveBeenLastCalledWith(
      "シェア文をコピーできませんでした。長押しで選択してください。"
    );
  });
});
