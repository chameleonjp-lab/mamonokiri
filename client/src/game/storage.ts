type StorageAccess = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const STORAGE_UNAVAILABLE_MESSAGE =
  "名前・設定・記録をこのブラウザに保存できません。今の画面では遊べますが、ページを閉じると失われます。";

/** Keep current-session values even when access itself or the quota fails. */
export function createSafeStorage(getStorage: () => StorageAccess) {
  const session = new Map<string, string | null>();
  const listeners = new Set<() => void>();
  let unavailable = false;
  const failed = () => {
    if (unavailable) return;
    unavailable = true;
    listeners.forEach(listener => listener());
  };
  return {
    getItem(key: string): string | null {
      if (session.has(key)) return session.get(key) ?? null;
      try {
        const value = getStorage().getItem(key);
        if (value !== null) session.set(key, value);
        return value;
      } catch {
        failed();
        return null;
      }
    },
    setItem(key: string, value: string): void {
      session.set(key, value);
      try {
        getStorage().setItem(key, value);
      } catch {
        failed();
      }
    },
    removeItem(key: string): void {
      session.set(key, null);
      try {
        getStorage().removeItem(key);
      } catch {
        failed();
      }
    },
    isUnavailable: () => unavailable,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// Access the property inside the guard: Safari can throw before getItem runs.
export const safeStorage = createSafeStorage(() => globalThis.localStorage);
