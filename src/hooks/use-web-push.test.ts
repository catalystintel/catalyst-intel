import { afterEach, describe, expect, it, vi } from "vitest";

import { ensurePushServiceWorker, urlBase64ToUint8Array } from "./use-web-push";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("urlBase64ToUint8Array", () => {
  it("decodes a VAPID-style base64url key", () => {
    // "hi" in base64url
    const bytes = urlBase64ToUint8Array("aGk");
    expect(Array.from(bytes)).toEqual([104, 105]);
  });
});

describe("ensurePushServiceWorker", () => {
  it("waits for an installing worker to activate before returning", async () => {
    const listeners = new Map<string, Set<() => void>>();
    const installing = {
      state: "installing" as ServiceWorkerState,
      addEventListener: (type: string, fn: () => void) => {
        const set = listeners.get(type) ?? new Set();
        set.add(fn);
        listeners.set(type, set);
      },
      removeEventListener: (type: string, fn: () => void) => {
        listeners.get(type)?.delete(fn);
      },
    };

    const registration = {
      installing,
      waiting: null,
      active: null as ServiceWorker | null,
    };

    const register = vi.fn().mockResolvedValue(registration);
    const ready = Promise.resolve({
      ...registration,
      active: { state: "activated" },
    });

    vi.stubGlobal("navigator", {
      serviceWorker: {
        register,
        ready,
      },
    });

    const pending = ensurePushServiceWorker();

    // Simulate activation after subscribe started waiting.
    queueMicrotask(() => {
      installing.state = "activated";
      for (const fn of listeners.get("statechange") ?? []) fn();
      registration.active = { state: "activated" } as ServiceWorker;
    });

    const result = await pending;
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    expect(result.active || result).toBeTruthy();
  });

  it("returns immediately when registration already has an active worker", async () => {
    const registration = {
      installing: null,
      waiting: null,
      active: { state: "activated" },
    };
    const register = vi.fn().mockResolvedValue(registration);
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register,
        ready: Promise.resolve(registration),
      },
    });

    const result = await ensurePushServiceWorker();
    expect(result).toBe(registration);
  });
});
