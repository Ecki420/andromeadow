import * as THREE from "three";
import { CONFIG } from "../config.ts";
import type { ShipData } from "./ShipData.ts";
import type { ManualState } from "../input/ManualControls.ts";
import { buildShipModel } from "../system/voxel.ts";

export interface FlightTarget {
  point: THREE.Vector3;
  /** Stop when this close to the point (keeps the hull outside the body). */
  stopDistance: number;
  label: string;
}

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

/**
 * Movement layer. Two ways to move, never both at once:
 * - autopilot: flyTo() a point, arrive at cruise speed (Rev 1);
 * - manual: applyManual() intents from the keyboard/mouse layer (Rev 2).
 * It never reads input devices itself.
 */
export class Ship {
  readonly object: THREE.Group;
  readonly position = new THREE.Vector3();
  /** Full orientation. Nose is local +Z. */
  readonly orientation = new THREE.Quaternion();
  /** Unit forward vector, derived from orientation every frame. Saved with the player. */
  readonly heading = new THREE.Vector3(0, 0, 1);
  /** Current speed along the nose, world units per second. */
  speed = 0;
  /** 0..1 throttle lever (manual flight only). */
  throttle = 0;
  onArrive: ((target: FlightTarget) => void) | null = null;

  private target: FlightTarget | null = null;
  private readonly tmp = new THREE.Vector3();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpM = new THREE.Matrix4();

  constructor(readonly data: ShipData) {
    this.object = buildShipModel(data);
  }

  get flightTarget(): FlightTarget | null {
    return this.target;
  }

  get travelling(): boolean {
    return this.target !== null;
  }

  // ---- autopilot ---------------------------------------------------------

  flyTo(point: THREE.Vector3, stopDistance: number, label: string): void {
    this.target = { point: point.clone(), stopDistance, label };
  }

  /** Drop the autopilot target but keep flying at the current speed (manual takes over). */
  halt(): void {
    if (this.target) this.throttle = THREE.MathUtils.clamp(this.speed / this.data.cruiseSpeed, 0, 1);
    this.target = null;
  }

  /** Drop the target and come to rest (used before jumps). */
  stop(): void {
    this.target = null;
    this.speed = 0;
    this.throttle = 0;
  }

  teleport(position: THREE.Vector3, heading: THREE.Vector3): void {
    this.position.copy(position);
    if (heading.lengthSq() > 0) this.setHeading(heading);
    this.target = null;
    this.speed = 0;
    this.throttle = 0;
    this.syncObject();
  }

  /** Distance still to cover before stopping, or 0 when not on autopilot. */
  remainingDistance(): number {
    if (!this.target) return 0;
    return Math.max(0, this.position.distanceTo(this.target.point) - this.target.stopDistance);
  }

  etaSeconds(): number {
    return this.remainingDistance() / this.data.cruiseSpeed;
  }

  // ---- manual ------------------------------------------------------------

  /** Apply one frame of steering intents. Call only when not on autopilot. */
  applyManual(m: ManualState, dt: number): void {
    this.throttle = THREE.MathUtils.clamp(this.throttle + m.throttleDelta * CONFIG.throttleRate * dt, 0, 1);
    const yaw = m.yawRate * this.data.turnRate * dt + m.mouseYaw;
    const pitch = m.mousePitch;
    const roll = m.rollRate * CONFIG.rollRate * dt;
    // Rotations are applied in the ship's own frame so controls feel the same at any attitude.
    if (yaw !== 0) this.orientation.multiply(this.tmpQ.setFromAxisAngle(UP, yaw));
    if (pitch !== 0) this.orientation.multiply(this.tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch));
    if (roll !== 0) this.orientation.multiply(this.tmpQ.setFromAxisAngle(FORWARD, roll));
    this.orientation.normalize();
  }

  // ---- per frame ---------------------------------------------------------

  update(dt: number): void {
    if (this.target) {
      const toTarget = this.tmp.copy(this.target.point).sub(this.position);
      const dist = toTarget.length();
      if (dist <= this.target.stopDistance + 0.01) {
        const done = this.target;
        this.target = null;
        this.speed = 0;
        this.throttle = 0;
        this.onArrive?.(done);
      } else {
        toTarget.divideScalar(dist);
        this.turnHeadingToward(toTarget, dt);
        this.speed = this.data.cruiseSpeed;
        const step = Math.min(this.speed * dt, dist - this.target.stopDistance);
        this.position.addScaledVector(toTarget, step);
      }
    } else {
      const wanted = this.throttle * this.data.cruiseSpeed;
      const delta = THREE.MathUtils.clamp(wanted - this.speed, -CONFIG.acceleration * dt, CONFIG.acceleration * dt);
      this.speed += delta;
      this.updateHeading();
      this.position.addScaledVector(this.heading, this.speed * dt);
    }
    this.syncObject();
  }

  private turnHeadingToward(dir: THREE.Vector3, dt: number): void {
    this.updateHeading();
    const angle = this.heading.angleTo(dir);
    if (angle > 1e-4) {
      const t = Math.min(1, (this.data.turnRate * dt) / angle);
      this.heading.lerp(dir, t).normalize();
    }
    this.setHeading(this.heading);
  }

  /** Point the nose along a world direction, levelled to world up (autopilot and resume). */
  private setHeading(dir: THREE.Vector3): void {
    const d = this.tmp.copy(dir).normalize();
    // Mirrors Object3D.lookAt for non-cameras: local +Z ends up pointing along d.
    this.tmpM.lookAt(d, new THREE.Vector3(0, 0, 0), UP);
    this.orientation.setFromRotationMatrix(this.tmpM);
    this.heading.copy(d);
  }

  private updateHeading(): void {
    this.heading.copy(FORWARD).applyQuaternion(this.orientation);
  }

  private syncObject(): void {
    this.updateHeading();
    this.object.position.copy(this.position);
    this.object.quaternion.copy(this.orientation);
  }
}
