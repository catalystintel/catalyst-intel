"use client";

import { useCallback, useEffect, useState } from "react";

export type WebPushStatus =
  | "unsupported"
  | "denied"
  | "unsubscribed"
  | "subscribed"
  | "loading"
  | "error";

export function urlBase64ToUint8Array(
  base64String: string,
): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    bytes[i] = rawData.charCodeAt(i);
  }
  return bytes;
}

/**
 * Register `/sw.js` and wait until an active worker is available.
 * `register()` resolves before activation — calling pushManager.subscribe
 * too early throws AbortError: "Subscription failed - no active Service Worker".
 */
export async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });

  // If a new worker is installing, wait for it to activate (skipWaiting in sw.js).
  const installing = registration.installing;
  if (installing) {
    await waitForWorkerState(installing, "activated");
  } else if (registration.waiting) {
    // Stuck waiting — ask it to take over (install handler also calls skipWaiting).
    registration.waiting.postMessage?.({ type: "SKIP_WAITING" });
    await waitForWorkerState(registration.waiting, "activated").catch(() => {
      // ready below is the durable fallback
    });
  }

  // Prefer the registration that already has an active worker; otherwise wait
  // for the container-wide ready promise (resolves once any controlling SW is active).
  if (registration.active) {
    return registration;
  }

  return navigator.serviceWorker.ready;
}

function waitForWorkerState(
  worker: ServiceWorker,
  desired: ServiceWorkerState,
): Promise<void> {
  if (worker.state === desired) return Promise.resolve();
  if (worker.state === "redundant") {
    return Promise.reject(new Error("Service worker became redundant."));
  }

  return new Promise((resolve, reject) => {
    const onChange = () => {
      if (worker.state === desired) {
        worker.removeEventListener("statechange", onChange);
        resolve();
      } else if (worker.state === "redundant") {
        worker.removeEventListener("statechange", onChange);
        reject(new Error("Service worker became redundant."));
      }
    };
    worker.addEventListener("statechange", onChange);
  });
}

function pushSubscribeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();
  if (
    lower.includes("no active service worker") ||
    lower.includes("subscription failed")
  ) {
    return "Browser push isn’t ready yet — reload this page and try Enable again.";
  }
  if (
    lower.includes("push service error") ||
    lower.includes("registration failed")
  ) {
    return "This browser couldn’t reach the push service. Try Chrome/Edge, or check you’re on HTTPS/localhost.";
  }
  if (raw.trim()) return raw.slice(0, 180);
  return "Could not enable browser notifications.";
}

/**
 * Registers the Web Push service worker and manages the browser's
 * subscription for the current user. Free — no FCM/APNs account; relies
 * only on the browser Push API + the server's VAPID keypair.
 */
export function useWebPush(publicKey: string | null) {
  const [status, setStatus] = useState<WebPushStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      setStatus(subscription ? "subscribed" : "unsubscribed");
      setError(null);
    } catch {
      setStatus("unsubscribed");
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!publicKey) {
      setError(
        "Push isn’t configured on this deployment (missing VAPID public key).",
      );
      setStatus("error");
      return false;
    }
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return false;
    }

    setStatus("loading");
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return false;
      }

      const registration = await ensurePushServiceWorker();
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Browser returned an incomplete push subscription.");
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not save push subscription.");
      }

      setStatus("subscribed");
      setError(null);
      return true;
    } catch (err) {
      const message = pushSubscribeErrorMessage(err);
      setError(message);
      setStatus("error");
      return false;
    }
  }, [publicKey]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setStatus("unsubscribed");
        return;
      }

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await fetch(
        `/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`,
        {
          method: "DELETE",
          credentials: "same-origin",
        },
      );
      setStatus("unsubscribed");
    } catch (err) {
      setError(pushSubscribeErrorMessage(err));
      setStatus("error");
    }
  }, []);

  /**
   * Local OS banner (no server). Use after subscribe to catch macOS/Windows
   * blocking Chrome even when site permission is Allow.
   */
  const showProbe = useCallback(async (): Promise<{
    ok: boolean;
    detail: string;
  }> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return {
        ok: false,
        detail: "Notifications aren’t supported in this browser.",
      };
    }
    if (Notification.permission !== "granted") {
      return {
        ok: false,
        detail: "Allow notifications for this site first.",
      };
    }
    try {
      const registration = await ensurePushServiceWorker();
      await registration.showNotification("Catalyst Intel", {
        body: "Test banner — if you see this, push can reach this device.",
        icon: "/apple-icon.png",
        badge: "/apple-icon.png",
        tag: "catalyst-push-probe",
        data: { url: "/alerts" },
      });
      return { ok: true, detail: "Test banner sent to this device." };
    } catch (err) {
      return {
        ok: false,
        detail: pushSubscribeErrorMessage(err),
      };
    }
  }, []);

  return { status, error, subscribe, unsubscribe, showProbe };
}
