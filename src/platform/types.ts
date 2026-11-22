import type { HapticKind } from "../game/effects";

/**
 * What the game needs from the shell it runs in. The website uses the no-op
 * version in ./index.ts; the Android app (nova-mobile) swaps in a Capacitor
 * implementation at build time, so this one codebase serves both.
 */
export interface Platform {
  /** True inside the native app: turns on dual joysticks, the pause and dash buttons, robot select, adaptive quality. */
  readonly native: boolean;
  /** Vibration feedback for a game event. */
  haptic(kind: HapticKind): void;
  /** The Android back button / gesture. */
  onBack(handler: () => void): void;
  /** Close the app (back button on the title screen). */
  exitApp(): void;
  /** The game has loaded: hide the native splash and go full screen. */
  ready(): void;
}
