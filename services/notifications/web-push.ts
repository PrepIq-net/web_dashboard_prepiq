"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { notificationEndpoints } from "@/services/notifications/endpoints";

const SW_URL = "/sw.js";

export type WebPushOutcome =
  | "granted"
  | "denied"
  | "unsupported"
  | "unconfigured"
  | "error";

export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function currentPermission(): NotificationPermission | "unsupported" {
  if (!isWebPushSupported()) return "unsupported";
  return Notification.permission;
}

// VAPID public keys are base64url; PushManager needs a Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function fetchPublicKey(): Promise<string | null> {
  const res = await apiClient<{ public_key: string | null }>(
    notificationEndpoints.webPushPublicKey(),
  );
  return res.public_key;
}

/**
 * Requests permission, subscribes this browser via the VAPID key, and saves the
 * subscription to the backend. Call only after priming — it triggers the OS
 * permission prompt. Returns a coarse outcome so the UI can message correctly:
 *  - "unconfigured" means the server has no VAPID keys yet (nothing to do).
 */
export async function enableWebPush(): Promise<WebPushOutcome> {
  if (!isWebPushSupported()) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const publicKey = await fetchPublicKey();
  if (!publicKey) return "unconfigured";

  try {
    const registration = await navigator.serviceWorker.register(SW_URL);
    await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    await apiClient(notificationEndpoints.webPushSubscribe(), {
      method: "POST",
      body: { ...subscription.toJSON(), user_agent: navigator.userAgent },
    });
    return "granted";
  } catch (err) {
    console.error("[web-push] failed to enable", err);
    return "error";
  }
}

/** Removes this browser's subscription locally and on the backend. */
export async function disableWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await apiClient(notificationEndpoints.webPushUnsubscribe(), {
      method: "POST",
      body: { endpoint: subscription.endpoint },
    });
  } finally {
    await subscription.unsubscribe();
  }
}

/**
 * Client-state hook for the web-push opt-in UI. `enable()` performs the full
 * subscribe flow; `permission` reflects the browser's Notification permission.
 */
export function useWebPush() {
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported" | "loading"
  >("loading");
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    setPermission(currentPermission());
  }, []);

  const enable = useCallback(async (): Promise<WebPushOutcome> => {
    setIsEnabling(true);
    try {
      const outcome = await enableWebPush();
      setPermission(currentPermission());
      return outcome;
    } finally {
      setIsEnabling(false);
    }
  }, []);

  return {
    permission,
    isEnabling,
    enable,
    isSupported: permission !== "unsupported",
    isGranted: permission === "granted",
    canPrompt: permission === "default",
  };
}
