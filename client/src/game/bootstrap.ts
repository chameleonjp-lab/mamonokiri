type Disposable = { dispose(): void };

/** A failed or abandoned attempt owns all of its resources, including late scenes. */
export function startGameRuntime<
  E extends Disposable,
  H extends Disposable,
>(options: {
  createEngine: () => E;
  createScene: (engine: E) => Promise<H>;
  onReady: (handle: H, engine: E) => void;
  onError: (error: unknown) => void;
}) {
  let engine: E | null = null;
  let handle: H | null = null;
  let canceled = false;
  const release = () => {
    const ownedHandle = handle;
    const ownedEngine = engine;
    handle = null;
    engine = null;
    try {
      ownedHandle?.dispose();
    } finally {
      ownedEngine?.dispose();
    }
  };
  const ready = (async () => {
    try {
      engine = options.createEngine();
      const next = await options.createScene(engine);
      if (canceled) {
        next.dispose();
        return;
      }
      handle = next;
      options.onReady(handle, engine);
    } catch (error) {
      try {
        release();
      } finally {
        if (!canceled) options.onError(error);
      }
    }
  })();
  return {
    ready,
    dispose() {
      canceled = true;
      release();
    },
  };
}
