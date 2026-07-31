"use client";

import { useCallback, useEffect, useState } from "react";

export type WebPushStatus =
  "unsupported" | "denied" | "unsubscribed" | "subscribed" | "loading";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
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
 * Registers the Web Push service worker and manages the browser's
 * subscription for the current user. Free — no FCM/APNs account; relies
 * only on the browser Push API + the server's VAPID keypair.
 */
export function useWebPush(publicKey: string | null) {
  const [status, setStatus] = useState<WebPushStatus>("loading");

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
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    setStatus(subscription ? "subscribed" : "unsubscribed");
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!publicKey) return false;
    if (typeof window === "undefined" || !("serviceWorker" in navigator))
      return false;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("denied");
      return false;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const json = subscription.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });

    setStatus("subscribed");
    return true;
  }, [publicKey]);

  const unsubscribe = useCallback(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

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
  }, []);

  return { status, subscribe, unsubscribe };
}
