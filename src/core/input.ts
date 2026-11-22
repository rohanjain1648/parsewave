/**
 * Unified input: keyboard (WASD/arrows) + pointer (mouse/touch).
 *
 * Exposes a normalized movement vector so gameplay code never cares whether
 * the player is on desktop or mobile. Touch has two schemes:
 *  - website (default): dragging anywhere is a virtual stick that moves and fires;
 *  - app (`dualSticks`): a finger on the LEFT half spawns a move stick where it
 *    lands, a finger on the RIGHT half spawns an aim stick that fires while held.
 *    Both work at once (multi-touch). Reserved rects (pause, dash, ping buttons)
 *    stay plain taps and never become sticks.
 */

import { clamp, len } from "./math";
import type { PlayerInput } from "../game/types";

type Zone = "move" | "aim";

interface StickPointer {
  zone: Zone;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

/** Renderable stick geometry, in CSS pixels. */
export interface StickView {
  active: boolean;
  baseX: number;
  baseY: number;
  knobX: number;
  knobY: number;
  radius: number;
}

const STICK_RADIUS = 62; // max knob travel from the base, CSS px
const STICK_DEAD = 6; // ignore jitter within this radius

const mkStick = (): StickView => ({ active: false, baseX: 0, baseY: 0, knobX: 0, knobY: 0, radius: STICK_RADIUS });

export class Input {
  private keys = new Set<string>();
  private pointerActive = false;
  private pointerOriginX = 0;
  private pointerOriginY = 0;
  private pointerX = 0;
  private pointerY = 0;
  private usingTouch = false;
  /** Last mouse position, tracked even with no button held (for hover states). Null on touch devices. */
  private hover: { x: number; y: number } | null = null;

  /** One-shot "confirm/start" edge, consumed by the UI layer. */
  private pressedConfirm = false;
  /** Number keys 1..3 for level-up choices (edge-triggered). */
  private numberPressed = 0;
  /** Generic per-key edge buffer (consumed once per physical press). */
  private edges = new Set<string>();
  /** Pointer-press edge with the position where it happened. */
  private clicked = false;
  private clickX = 0;
  private clickY = 0;

  readonly move = { x: 0, y: 0 };
  /** Cursor aim (mouse held): unit direction from the robot (screen centre). */
  readonly aim = { x: 1, y: 0, active: false };
  /** True when the current move vector came from a touch drag. */
  private moveFromTouch = false;

  /** App mode: two floating thumbsticks instead of one drag. */
  private readonly dualSticks: boolean;
  private sticks = new Map<number, StickPointer>();
  private reserved: { x: number; y: number; w: number; h: number }[] = [];
  private dashRequested = false;
  readonly leftStick: StickView = mkStick();
  readonly rightStick: StickView = mkStick();

  constructor(target: HTMLElement, opts: { dualSticks?: boolean } = {}) {
    this.dualSticks = !!opts.dualSticks;
    addEventListener("keydown", this.onKeyDown, { passive: false });
    addEventListener("keyup", this.onKeyUp);
    target.addEventListener("pointerdown", this.onPointerDown);
    addEventListener("pointermove", this.onPointerMove);
    addEventListener("pointerup", this.onPointerUp);
    addEventListener("pointercancel", this.onPointerUp);
    addEventListener("blur", this.releaseAll);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Prevent page scroll on arrows/space during play.
    if (
      e.code === "Space" ||
      e.code.startsWith("Arrow") ||
      e.code === "Tab"
    ) {
      e.preventDefault();
    }
    if (!this.keys.has(e.code)) {
      this.edges.add(e.code);
      if (e.code === "Space" || e.code === "Enter") this.pressedConfirm = true;
      if (e.code === "Digit1" || e.code === "Numpad1") this.numberPressed = 1;
      if (e.code === "Digit2" || e.code === "Numpad2") this.numberPressed = 2;
      if (e.code === "Digit3" || e.code === "Numpad3") this.numberPressed = 3;
      if (e.code === "Digit4" || e.code === "Numpad4") this.numberPressed = 4;
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.usingTouch = e.pointerType === "touch";
    this.hover = this.usingTouch ? null : { x: e.clientX, y: e.clientY };
    this.pointerActive = true;
    this.pointerOriginX = this.pointerX = e.clientX;
    this.pointerOriginY = this.pointerY = e.clientY;
    this.pressedConfirm = true;
    this.clicked = true;
    this.clickX = e.clientX;
    this.clickY = e.clientY;
    if (this.dualSticks && this.usingTouch) {
      this.pointerActive = false; // touches drive the sticks, not the single-drag stick
      for (const r of this.reserved) {
        if (e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) return;
      }
      const zone: Zone = e.clientX < innerWidth / 2 ? "move" : "aim";
      for (const p of this.sticks.values()) if (p.zone === zone) return; // one finger per half
      this.sticks.set(e.pointerId, { zone, originX: e.clientX, originY: e.clientY, x: e.clientX, y: e.clientY });
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType !== "touch") this.hover = { x: e.clientX, y: e.clientY };
    const stick = this.sticks.get(e.pointerId);
    if (stick) {
      stick.x = e.clientX;
      stick.y = e.clientY;
    }
    if (!this.pointerActive) return;
    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.sticks.delete(e.pointerId)) return;
    this.pointerActive = false;
  };

  private releaseAll = (): void => {
    this.keys.clear();
    this.pointerActive = false;
    this.sticks.clear();
  };

  /** App mode: screen rects (CSS px) where a touch is a tap only, never a stick. */
  setReserved(rects: { x: number; y: number; w: number; h: number }[]): void {
    this.reserved = rects;
  }

  /** The on-screen DASH button was tapped: dash on the next sim step. */
  requestDash(): void {
    this.dashRequested = true;
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  /** Read + clear the confirm edge. */
  consumeConfirm(): boolean {
    const v = this.pressedConfirm;
    this.pressedConfirm = false;
    // Drain the raw Enter/Space edges too, so a stale menu confirm can't be picked up
    // later by an unrelated consumeKey() (e.g. instantly un-pausing).
    this.edges.delete("Space");
    this.edges.delete("Enter");
    return v;
  }

  /** Read + clear a 1..4 selection edge (0 = none). */
  consumeNumber(): number {
    const v = this.numberPressed;
    this.numberPressed = 0;
    return v;
  }

  /** Read + clear a pointer click, returning its position or null. */
  consumeClick(): { x: number; y: number } | null {
    if (!this.clicked) return null;
    this.clicked = false;
    return { x: this.clickX, y: this.clickY };
  }

  /** True once per physical key press for the given code. */
  consumeKey(code: string): boolean {
    if (this.edges.has(code)) {
      this.edges.delete(code);
      return true;
    }
    return false;
  }

  get pointerPosition(): { x: number; y: number } {
    return { x: this.pointerX, y: this.pointerY };
  }

  /** Where the mouse is right now (no button needed), or null if there is no mouse. */
  get hoverPoint(): { x: number; y: number } | null {
    return this.hover;
  }

  get isPointerActive(): boolean {
    return this.pointerActive;
  }

  /**
   * Recompute the normalized movement vector. Called once per sim step.
   * Keyboard takes priority; otherwise a touch/mouse drag acts as a stick.
   */
  update(): void {
    let x = 0;
    let y = 0;

    if (this.isDown("KeyA", "ArrowLeft")) x -= 1;
    if (this.isDown("KeyD", "ArrowRight")) x += 1;
    if (this.isDown("KeyW", "ArrowUp")) y -= 1;
    if (this.isDown("KeyS", "ArrowDown")) y += 1;

    this.moveFromTouch = false;
    this.leftStick.active = false;
    this.rightStick.active = false;
    if (this.dualSticks) {
      if (x === 0 && y === 0) {
        const mp = this.findStick("move");
        if (mp) {
          const v = this.stickVector(mp, this.leftStick);
          x = v.x;
          y = v.y;
        }
      }
      const ap = this.findStick("aim");
      if (ap) {
        // A finger in the aim half fires the whole time it's held; the heading only
        // changes once the thumb leaves the dead zone, so a tap keeps the last aim.
        const v = this.stickVector(ap, this.rightStick);
        const m = len(v.x, v.y);
        if (m > 0.0001) {
          this.aim.x = v.x / m;
          this.aim.y = v.y / m;
        }
      }
    }
    if (!this.dualSticks && x === 0 && y === 0 && this.pointerActive && this.usingTouch) {
      // Touch virtual stick: vector from where the finger went down.
      // (Mouse never moves the robot — the cursor is aim-only, see below.)
      const dx = this.pointerX - this.pointerOriginX;
      const dy = this.pointerY - this.pointerOriginY;
      const l = len(dx, dy);
      const dead = 8;
      const full = 70;
      if (l > dead) {
        const mag = clamp((l - dead) / (full - dead), 0, 1);
        x = (dx / l) * mag;
        y = (dy / l) * mag;
        this.moveFromTouch = true;
      }
    }

    // Mouse aim: while the button is held, the aim vector points from the
    // screen centre (the camera keeps the robot there) toward the cursor.
    this.aim.active = (this.pointerActive && !this.usingTouch) || this.rightStick.active;
    if (this.aim.active && !this.rightStick.active) {
      const dx = this.pointerX - innerWidth / 2;
      const dy = this.pointerY - innerHeight / 2;
      const l = len(dx, dy);
      if (l > 4) {
        this.aim.x = dx / l;
        this.aim.y = dy / l;
      } // cursor on top of the robot: keep the last aim direction
    }

    // Normalize diagonals for keyboard so you don't move faster on the angle.
    const l = len(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    this.move.x = x;
    this.move.y = y;
  }

  /** Recompute this step's controls and return them as a plain struct for the sim. */
  read(): PlayerInput {
    this.update();
    return {
      moveX: this.move.x,
      moveY: this.move.y,
      aimActive: this.aim.active,
      aimX: this.aim.x,
      aimY: this.aim.y,
      firing: this.aim.active || this.moveFromTouch,
      // One edge per press: Shift or E.
      dash: this.consumeKey("ShiftLeft") || this.consumeKey("ShiftRight") || this.consumeKey("KeyE") || this.takeDash(),
    };
  }

  private takeDash(): boolean {
    const v = this.dashRequested;
    this.dashRequested = false;
    return v;
  }

  private findStick(zone: Zone): StickPointer | null {
    for (const p of this.sticks.values()) if (p.zone === zone) return p;
    return null;
  }

  /** Update a stick's render geometry and return its analogue vector (0..1, zero in the dead zone). */
  private stickVector(p: StickPointer, view: StickView): { x: number; y: number } {
    const dx = p.x - p.originX;
    const dy = p.y - p.originY;
    const d = len(dx, dy);
    const travel = Math.min(d, view.radius);
    view.active = true;
    view.baseX = p.originX;
    view.baseY = p.originY;
    view.knobX = d > 0 ? p.originX + (dx / d) * travel : p.originX;
    view.knobY = d > 0 ? p.originY + (dy / d) * travel : p.originY;
    if (d <= STICK_DEAD) return { x: 0, y: 0 };
    const mag = clamp((d - STICK_DEAD) / (view.radius - STICK_DEAD), 0, 1);
    return { x: (dx / d) * mag, y: (dy / d) * mag };
  }

  /** True while a touch drag is driving movement (mobile fires while moving). */
  get touchSteering(): boolean {
    return this.moveFromTouch;
  }
}
