import * as THREE from "three";
import type { Ship } from "../ship/Ship.ts";

/**
 * Chase camera: sits behind and slightly above the ship and follows its full
 * orientation, so after a roll or a pitch the view rolls and pitches with it.
 * Wheel zooms. There is no free orbit in Rev 2 because left-drag now fires.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private distance = 36;
  private readonly desired = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private initialised = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.5, 60000);
  }

  zoom(delta: number): void {
    this.distance = THREE.MathUtils.clamp(this.distance * (1 + delta * 0.0012), 10, 400);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(ship: Ship, dt: number): void {
    // Behind (-Z local) and above (+Y local), in the ship's frame.
    this.desired.set(0, this.distance * 0.32, -this.distance).applyQuaternion(ship.orientation).add(ship.position);
    this.up.set(0, 1, 0).applyQuaternion(ship.orientation);
    if (!this.initialised) {
      this.camera.position.copy(this.desired);
      this.camera.up.copy(this.up);
      this.initialised = true;
    } else {
      const k = 1 - Math.exp(-10 * dt);
      this.camera.position.lerp(this.desired, k);
      this.camera.up.lerp(this.up, k).normalize();
    }
    // Look a little ahead of the ship so the nose points at the crosshair.
    this.look.copy(ship.heading).multiplyScalar(this.distance * 0.6).add(ship.position);
    this.camera.lookAt(this.look);
  }
}
