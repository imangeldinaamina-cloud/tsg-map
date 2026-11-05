"use client";
/** Fire-and-forget, privacy-friendly event. No identifiers are sent. */
export function track(type: string, props?: Record<string, string | number | boolean>) {
  try {
    const body = JSON.stringify({ type, path: window.location.pathname, props });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    else fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    /* analytics must never break the app */
  }
}

export function safeStorage() {
  return {
    get(k: string) {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set(k: string, v: string) {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
    },
    remove(k: string) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    },
  };
}
