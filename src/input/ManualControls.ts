import { CONFIG } from "../config.ts";

/**
 * Keyboard + mouse steering, Rev 2. Produces intents only; the ship applies them.
 *
 * - W/Up and S/Down: throttle up / down.  A/Left and D/Right: yaw.  Q/E: roll.
 * - Mouse turns the nose ONLY while the right button is held.
 * - Left button fires, unless the press landed on a clickable body (then it is a
 *   point-and-click pick, handled by PointAndClick).
 */
export interface ManualState {
  /** -1, 0 or 1: direction the throttle lever is being pushed this frame. */
  throttleDelta: number;
  /** -1..1, positive = turn left. */
  yawRate: number;
  /** -1..1, positive = roll left. */
  rollRate: number;
  /** Radians of yaw from the mouse this frame (already scaled). */
  mouseYaw: number;
  /** Radians of pitch from the mouse this frame (already scaled). */
  mousePitch: number;
  /** Left button held on empty space. */
  firing: boolean;
  /** Right button held (mouse look active). */
  looking: boolean;
  /** Any steering happened this frame: used to cancel the autopilot. */
  steered: boolean;
}

export class ManualControls {
  enabled = true;
  private readonly keys = new Set<string>();
  private rmb = false;
  private lmb = false;
  private dx = 0;
  private dy = 0;

  constructor(
    private readonly el: HTMLElement,
    private readonly isOverBody: (ndcX: number, ndcY: number) => boolean,
  ) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clear);
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointerleave", this.onUp);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /** Read and reset this frame's intents. */
  poll(): ManualState {
    const k = (code: string) => this.keys.has(code);
    const throttleDelta = (k("KeyW") || k("ArrowUp") ? 1 : 0) - (k("KeyS") || k("ArrowDown") ? 1 : 0);
    const yawRate = (k("KeyA") || k("ArrowLeft") ? 1 : 0) - (k("KeyD") || k("ArrowRight") ? 1 : 0);
    const rollRate = (k("KeyQ") ? 1 : 0) - (k("KeyE") ? 1 : 0);
    const mouseYaw = this.rmb ? -this.dx * CONFIG.mouseSensitivity : 0;
    const mousePitch = this.rmb ? this.dy * CONFIG.mouseSensitivity : 0;
    const moved = this.dx !== 0 || this.dy !== 0;
    this.dx = 0;
    this.dy = 0;
    if (!this.enabled) {
      return { throttleDelta: 0, yawRate: 0, rollRate: 0, mouseYaw: 0, mousePitch: 0, firing: false, looking: false, steered: false };
    }
    return {
      throttleDelta,
      yawRate,
      rollRate,
      mouseYaw,
      mousePitch,
      firing: this.lmb,
      looking: this.rmb,
      steered: throttleDelta !== 0 || yawRate !== 0 || rollRate !== 0 || (this.rmb && moved),
    };
  }

  private clear = (): void => {
    this.keys.clear();
    this.rmb = false;
    this.lmb = false;
  };

  private static readonly STEER_CODES = new Set([
    "KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  ]);

  private onKeyDown = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if (!ManualControls.STEER_CODES.has(e.code)) return;
    e.preventDefault();
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onDown = (e: PointerEvent): void => {
    if (e.button === 2) {
      this.rmb = true;
      return;
    }
    if (e.button === 0) {
      const rect = this.el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      if (!this.isOverBody(x, y)) this.lmb = true;
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.rmb) return;
    this.dx += e.movementX;
    this.dy += e.movementY;
  };

  private onUp = (e: PointerEvent): void => {
    if (e.type === "pointerleave") {
      this.rmb = false;
      this.lmb = false;
      return;
    }
    if (e.button === 2) this.rmb = false;
    if (e.button === 0) this.lmb = false;
  };
}
