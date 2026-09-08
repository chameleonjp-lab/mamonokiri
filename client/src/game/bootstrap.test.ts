import { describe, expect, it, vi } from "vitest";
import { startGameRuntime } from "./bootstrap";

const engine = () => ({ dispose: vi.fn() });
const handle = () => ({ dispose: vi.fn() });

describe("3D startup lifetime", () => {
  it("reports unavailable WebGL and permits a fresh successful retry", async () => {
    const onError = vi.fn();
    const onReady = vi.fn();
    await startGameRuntime({
      createEngine: () => {
        throw new Error("WebGL not supported");
      },
      createScene: async () => handle(),
      onReady,
      onError,
    }).ready;
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    const e = engine(),
      h = handle();
    const retry = startGameRuntime({
      createEngine: () => e,
      createScene: async () => h,
      onReady,
      onError,
    });
    await retry.ready;
    expect(onReady).toHaveBeenCalledWith(h, e);
    retry.dispose();
    expect(e.dispose).toHaveBeenCalledTimes(1);
    expect(h.dispose).toHaveBeenCalledTimes(1);
  });
  it("disposes the engine when scene creation rejects", async () => {
    const e = engine(),
      onError = vi.fn();
    const runtime = startGameRuntime({
      createEngine: () => e,
      createScene: async () => {
        throw new Error("scene failed");
      },
      onReady: vi.fn(),
      onError,
    });
    await runtime.ready;
    runtime.dispose();
    expect(e.dispose).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });
  it("cleans up both resources when the first render throws", async () => {
    const e = engine(),
      h = handle(),
      onError = vi.fn();
    const runtime = startGameRuntime({
      createEngine: () => e,
      createScene: async () => h,
      onReady: () => {
        throw new Error("render failed");
      },
      onError,
    });
    await runtime.ready;
    runtime.dispose();
    expect(e.dispose).toHaveBeenCalledTimes(1);
    expect(h.dispose).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });
  it("disposes late scenes without announcing readiness after unmount", async () => {
    const e = engine(),
      h = handle(),
      onReady = vi.fn(),
      onError = vi.fn();
    let resolve!: (result: typeof h) => void;
    const runtime = startGameRuntime({
      createEngine: () => e,
      createScene: () =>
        new Promise<typeof h>(done => {
          resolve = done;
        }),
      onReady,
      onError,
    });
    runtime.dispose();
    resolve(h);
    await runtime.ready;
    runtime.dispose();
    expect(e.dispose).toHaveBeenCalledTimes(1);
    expect(h.dispose).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
