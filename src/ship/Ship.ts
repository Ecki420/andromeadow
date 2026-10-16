import * as THREE from "three";
import type { ShipData } from "./ShipData.ts";
import { buildShipModel } from "../system/voxel.ts";

export interface FlightTarget {
  point: THREE.Vector3;
  /** Stop when this close to the point (keeps the hull outside the body). */
  stopDistance: number;
  label: string;
}

/**
 * Movement layer. Knows nothing about mice or keys: it is given a point to fly
 * to and gets there at cruise speed. A later manual-steering layer will drive
 * the same position/heading from key input instead of a target.
 */
export class Ship {
  readonly object: THREE.Group;
  readonly position = new THREE.Vector3();
  /** Unit vector the nose points along. */
  readonly heading = new THREE.Vector3(0, 0, -1);
  onArrive: ((target: FlightTarget) => void) | null = null;

  private target: FlightTarget | null = null;
  private readonly turnRate = 1.8; // radians per second
  private readonly tmp = new THREE.Vector3();

  constructor(readonly data: ShipData) {
    this.object = buildShipModel(data);
  }

  get flightTarget(): FlightTarget | null {
    return this.target;
  }

  get travelling(): boolean {
    return this.target !== null;
  }

  flyTo(point: THREE.Vector3, stopDistance: number, label: string): void {
    this.target = { point: point.clone(), stopDistance, label };
  }

  halt(): void {
    this.target = null;
  }

  teleport(position: THREE.Vector3, heading: THREE.Vector3): void {
    this.position.copy(position);
    if (heading.lengthSq() > 0) this.heading.copy(heading).normalize();
    this.target = null;
    this.syncObject();
  }

  /** Distance still to cover before stopping, or 0 when idle. */
  remainingDistance(): number {
    if (!this.target) return 0;
    return Math.max(0, this.position.distanceTo(this.target.point) - this.target.stopDistance);
  }

  etaSeconds(): number {
    return this.remainingDistance() / this.data.cruiseSpeed;
  }

  update(dt: number): void {
    if (this.target) {
      const toTarget = this.tmp.copy(this.target.point).sub(this.position);
      const dist = toTarget.length();
      if (dist <= this.target.stopDistance + 0.01) {
        const done = this.target;
        this.target = null;
        this.onArrive?.(done);
      } else {
        toTarget.divideScalar(dist);
        this.turnToward(toTarget, dt);
        const step = Math.min(this.data.cruiseSpeed * dt, dist - this.target.stopDistance);
        this.position.addScaledVector(toTarget, step);
      }
    }
    this.syncObject();
  }

  private turnToward(dir: THREE.Vector3, dt: number): void {
    const angle = this.heading.angleTo(dir);
    if (angle < 1e-4) return;
    const t = Math.min(1, (this.turnRate * dt) / angle);
    this.heading.lerp(dir, t).normalize();
  }

  private syncObject(): void {
    this.object.position.copy(this.position);
    this.object.lookAt(this.tmp.copy(this.position).add(this.heading));
  }
}
