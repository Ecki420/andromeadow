import * as THREE from "three";
import type { Ship } from "../ship/Ship.ts";

/** Smoothed chase camera orbiting the ship. Drag to look around, wheel to zoom. */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private yaw = 0.45;
  private pitch = 0.22;
  private distance = 36;
  private readonly desired = new THREE.Vector3();
  private initialised = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.5, 60000);
  }

  orbit(dx: number, dy: number): void {
    this.yaw -= dx * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.005, -1.2, 1.4);
  }

  zoom(delta: number): void {
    this.distance = THREE.MathUtils.clamp(this.distance * (1 + delta * 0.0012), 10, 400);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Snap the orbit back to directly behind the ship (used after jumps so the target is ahead). */
  resetBehind(): void {
    this.yaw = 0;
    this.pitch = 0.22;
  }

  update(ship: Ship, dt: number): void {
    // Yaw is measured from "behind the ship", so the view follows the heading
    // and the drag offset is kept on top of it.
    const behind = Math.atan2(-ship.heading.x, -ship.heading.z);
    const azimuth = behind + this.yaw;
    const cp = Math.cos(this.pitch);
    this.desired.set(
      Math.sin(azimuth) * cp * this.distance,
      Math.sin(this.pitch) * this.distance,
      Math.cos(azimuth) * cp * this.distance,
    ).add(ship.position);
    if (!this.initialised) {
      this.camera.position.copy(this.desired);
      this.initialised = true;
    } else {
      this.camera.position.lerp(this.desired, 1 - Math.exp(-10 * dt));
    }
    this.camera.lookAt(ship.position);
  }
}
