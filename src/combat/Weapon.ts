import * as THREE from "three";
import { CONFIG } from "../config.ts";

/** Anything a bolt can hit. Position and radius are read each frame. */
export interface HitTarget {
  position: THREE.Vector3;
  radius: number;
  alive: boolean;
}

export interface Hit {
  /** Index into the targets array passed to update(). */
  targetIndex: number;
  point: THREE.Vector3;
}

/**
 * One fixed forward cannon. Bolts live in a pre-allocated instanced mesh, so
 * firing never allocates. No ammo, no heat, no damage model in Rev 2.
 */
export class Weapon {
  readonly mesh: THREE.InstancedMesh;
  private readonly count = CONFIG.boltPool;
  private readonly pos: THREE.Vector3[] = [];
  private readonly vel: THREE.Vector3[] = [];
  private readonly ttl: Float32Array;
  private readonly rot: THREE.Quaternion[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private cooldown = 0;
  private next = 0;
  private side = 1;

  constructor() {
    const geometry = new THREE.BoxGeometry(0.35, 0.35, 5);
    const material = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
    this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
    this.mesh.frustumCulled = false;
    this.ttl = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      this.pos.push(new THREE.Vector3());
      this.vel.push(new THREE.Vector3());
      this.rot.push(new THREE.Quaternion());
      this.mesh.setMatrixAt(i, this.hidden);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Try to fire from the ship. Returns true if a bolt left the barrel. */
  fire(shipPosition: THREE.Vector3, orientation: THREE.Quaternion, shipSpeed: number): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = 1 / CONFIG.fireRate;
    const i = this.next;
    this.next = (this.next + 1) % this.count;
    // Alternate left and right of the nose so it reads as two barrels.
    this.side = -this.side;
    const muzzle = new THREE.Vector3(this.side * 1.0, 0, 3.5).applyQuaternion(orientation).add(shipPosition);
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(orientation);
    (this.pos[i] as THREE.Vector3).copy(muzzle);
    (this.vel[i] as THREE.Vector3).copy(dir).multiplyScalar(CONFIG.boltSpeed + shipSpeed);
    (this.rot[i] as THREE.Quaternion).copy(orientation);
    this.ttl[i] = CONFIG.boltLife;
    return true;
  }

  /** Advance bolts, expire old ones, and report which targets were hit. */
  update(dt: number, targets: readonly HitTarget[]): Hit[] {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const hits: Hit[] = [];
    for (let i = 0; i < this.count; i++) {
      let life = this.ttl[i] as number;
      if (life <= 0) continue;
      const p = this.pos[i] as THREE.Vector3;
      p.addScaledVector(this.vel[i] as THREE.Vector3, dt);
      life -= dt;
      for (let t = 0; t < targets.length; t++) {
        const target = targets[t] as HitTarget;
        if (!target.alive) continue;
        if (p.distanceToSquared(target.position) <= target.radius * target.radius) {
          hits.push({ targetIndex: t, point: p.clone() });
          life = 0;
          break;
        }
      }
      this.ttl[i] = life;
      if (life <= 0) {
        this.mesh.setMatrixAt(i, this.hidden);
      } else {
        this.matrix.compose(p, this.rot[i] as THREE.Quaternion, this.scale);
        this.mesh.setMatrixAt(i, this.matrix);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    return hits;
  }
}
