/**
 * The website's platform: no native shell, so everything is a no-op.
 * The Android build (nova-mobile/vite.config.ts) replaces this file with
 * nova-mobile/src/platform/native.ts.
 */
import type { Platform } from "./types";

export type { Platform } from "./types";

export const platform: Platform = {
  native: false,
  haptic() {},
  onBack() {},
  exitApp() {},
  ready() {},
};
