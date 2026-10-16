import { CONFIG } from "../config.ts";

export type JumpKind = "star" | "system";
export type JumpPhase = "idle" | "charging" | "tunnel" | "arriving";

export interface JumpRequest {
  kind: JumpKind;
  /** Destination name for the HUD. */
  label: string;
  /** Star jumps: swap the loaded system. Runs during the tunnel; the tunnel waits for it. */
  load?: () => Promise<void>;
  /** Called once when the tunnel ends: place the ship, flash, etc. */
  onArrive: () => void;
}

/**
 * The jump sequence as a small state machine:
 * charging -> tunnel (min duration, extended while `load` is pending) -> arriving -> idle.
 * In-system jumps use the shorter timings and skip loading.
 */
export class JumpController {
  phase: JumpPhase = "idle";
  private request: JumpRequest | null = null;
  private t = 0;
  private loaded = true;
  private loadError: unknown = null;

  onPhase: ((phase: JumpPhase, request: JumpRequest) => void) | null = null;

  get current(): JumpRequest | null {
    return this.request;
  }

  get busy(): boolean {
    return this.phase !== "idle";
  }

  /** Seconds left in the current phase (charging countdown for the HUD). */
  get remaining(): number {
    if (!this.request) return 0;
    const d = this.phaseDuration();
    return Math.max(0, d - this.t);
  }

  /** 0..1 progress through the current phase, capped at 1 while waiting on a load. */
  get progress(): number {
    const d = this.phaseDuration();
    return d > 0 ? Math.min(1, this.t / d) : 1;
  }

  begin(request: JumpRequest): boolean {
    if (this.busy) return false;
    this.request = request;
    this.t = 0;
    this.loaded = !request.load;
    this.loadError = null;
    this.setPhase("charging");
    return true;
  }

  update(dt: number): void {
    if (!this.request) return;
    this.t += dt;
    switch (this.phase) {
      case "charging":
        if (this.t >= this.phaseDuration()) {
          this.setPhase("tunnel");
          if (this.request.load) {
            this.request
              .load()
              .then(() => {
                this.loaded = true;
              })
              .catch((err) => {
                this.loadError = err;
                this.loaded = true;
              });
          }
        }
        break;
      case "tunnel":
        if (this.t >= this.phaseDuration() && this.loaded) {
          if (this.loadError) console.error("System load failed during jump", this.loadError);
          this.setPhase("arriving");
          this.request.onArrive();
        }
        break;
      case "arriving":
        if (this.t >= this.phaseDuration()) {
          const done = this.request;
          this.request = null;
          this.phase = "idle";
          this.onPhase?.("idle", done);
        }
        break;
    }
  }

  private setPhase(phase: JumpPhase): void {
    this.phase = phase;
    this.t = 0;
    if (this.request) this.onPhase?.(phase, this.request);
  }

  private phaseDuration(): number {
    const star = this.request?.kind === "star";
    switch (this.phase) {
      case "charging":
        return star ? CONFIG.jumpChargeSeconds : CONFIG.inSystemChargeSeconds;
      case "tunnel":
        return star ? CONFIG.tunnelMinSeconds : CONFIG.inSystemJumpSeconds;
      case "arriving":
        return CONFIG.arrivalFlashSeconds;
      default:
        return 0;
    }
  }
}
