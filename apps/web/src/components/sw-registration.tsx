"use client";

import { useEffect } from "react";
import { logger } from "@repo/utils";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    // The PWA service worker is generated only for production builds. Attempting
    // to register /sw.js under `next dev` produces an expected 404 and triggers
    // Next.js's error overlay.
    if (process.env.NODE_ENV !== "production") return;

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          logger.info({ registration }, "Service worker registered successfully");
        })
        .catch((error) => {
          logger.error({ error }, "Service worker registration failed");
        });
    }
  }, []);

  return null;
}
