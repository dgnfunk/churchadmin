"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.register("/sw-dev.js", { scope: "/", updateViaCache: "none" });
      if ("caches" in window) void caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("churchadmin-")).map((key) => caches.delete(key))));
      return;
    }
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  }, []);
  return null;
}
