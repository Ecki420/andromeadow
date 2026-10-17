import * as THREE from "three";
import { CONFIG } from "../config.ts";
import { createRng, range } from "../galaxy/rng.ts";
import { disposeObject, voxelSphere } from "../system/voxel.ts";
import type { HitTarget } from "./Weapon.ts";

interface Rock extends HitTarget {
  mesh: THREE.InstancedMesh;
  spin: THREE.Vector3;
  drift: THREE.Vector3;
  respawnIn: number;
}

const ROCK_COLOURS = [0x8a7f72, 0x6e6a66, 0x9c8a6b, 0x7a8088];
const DEBRIS_COUNT = 120;

/**
 * Practice targets: a few drifting voxel rocks near the planet. A hit breaks a
 * rock into debris cubes and it comes back somewhere else a little later.
 * Purely for feedback; nothing here affects the ship.
 */
export class AsteroidField {
  readonly group = new THREE.Group();
  private readonly rocks: Rock[] = [];
  private readonly debris: THREE.InstancedMesh;
  private readonly dPos: THREE.Vector3[] = [];
  private readonly dVel: THREE.Vector3[] = [];
  private readonly dTtl: Float32Array;
  private readonly dRot: THREE.Quaternion[] = [];
  private nextDebris = 0;
  private readonly rng: () => number;
  private readonly matrix = new THREE.Matrix4();
  private readonly scale = new THREE.Vector3();
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(
    private readonly centre: THREE.Vector3,
    seed: number,
    count = CONFIG.asteroidsPerSystem,
  ) {
    this.rng = createRng(seed);
    for (let i = 0; i < count; i++) {
      const radius = range(this.rng, 10, 18);
      const mesh = voxelSphere({
        radius,
        voxel: radius / 3,
        color: ROCK_COLOURS[i % ROCK_COLOURS.length] as number,
        jitter: 0.35,
        seed: seed * 31 + i,
      });
      const rock: Rock = {
        mesh,
        position: this.randomSpot(),
        radius: radius * 1.15,
        alive: true,
        spin: new THREE.Vector3(range(this.rng, -0.4, 0.4), range(this.rng, -0.4, 0.4), range(this.rng, -0.4, 0.4)),
        drift: new THREE.Vector3(range(this.rng, -1.5, 1.5), range(this.rng, -0.5, 0.5), range(this.rng, -1.5, 1.5)),
        respawnIn: 0,
      };
      mesh.position.copy(rock.position);
      this.group.add(mesh);
      this.rocks.push(rock);
    }

    this.debris = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.2, 2.2, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x9a8f80 }),
      DEBRIS_COUNT,
    );
    this.debris.frustumCulled = false;
    this.dTtl = new Float32Array(DEBRIS_COUNT);
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      this.dPos.push(new THREE.Vector3());
      this.dVel.push(new THREE.Vector3());
      this.dRot.push(new THREE.Quaternion());
      this.debris.setMatrixAt(i, this.hidden);
    }
    this.debris.instanceMatrix.needsUpdate = true;
    this.group.add(this.debris);
  }

  /** Targets for the weapon, in a stable order. */
  get targets(): readonly HitTarget[] {
    return this.rocks;
  }

  /** Break rock `index` apart. */
  hit(index: number): void {
    const rock = this.rocks[index];
    if (!rock || !rock.alive) return;
    rock.alive = false;
    rock.mesh.visible = false;
    rock.respawnIn = CONFIG.asteroidRespawnSeconds;
    for (let n = 0; n < 24; n++) {
      const i = this.nextDebris;
      this.nextDebris = (this.nextDebris + 1) % DEBRIS_COUNT;
      const dir = new THREE.Vector3(range(this.rng, -1, 1), range(this.rng, -1, 1), range(this.rng, -1, 1)).normalize();
      (this.dPos[i] as THREE.Vector3).copy(rock.position).addScaledVector(dir, rock.radius * 0.4);
      (this.dVel[i] as THREE.Vector3).copy(dir).multiplyScalar(range(this.rng, 8, 26));
      (this.dRot[i] as THREE.Quaternion).setFromEuler(new THREE.Euler(range(this.rng, 0, 6), range(this.rng, 0, 6), 0));
      this.dTtl[i] = range(this.rng, 1.0, 1.8);
    }
  }

  update(dt: number): void {
    for (const rock of this.rocks) {
      if (rock.alive) {
        rock.position.addScaledVector(rock.drift, dt);
        // Stay in the shell around the planet: bounce the drift when leaving it.
        const d = rock.position.distanceTo(this.centre);
        if (d < 140 || d > 460) rock.drift.negate();
        rock.mesh.position.copy(rock.position);
        rock.mesh.rotation.x += rock.spin.x * dt;
        rock.mesh.rotation.y += rock.spin.y * dt;
        rock.mesh.rotation.z += rock.spin.z * dt;
      } else {
        rock.respawnIn -= dt;
        if (rock.respawnIn <= 0) {
          rock.alive = true;
          rock.position.copy(this.randomSpot());
          rock.mesh.position.copy(rock.position);
          rock.mesh.visible = true;
        }
      }
    }

    for (let i = 0; i < DEBRIS_COUNT; i++) {
      let life = this.dTtl[i] as number;
      if (life <= 0) continue;
      life -= dt;
      this.dTtl[i] = life;
      if (life <= 0) {
        this.debris.setMatrixAt(i, this.hidden);
        continue;
      }
      const p = this.dPos[i] as THREE.Vector3;
      p.addScaledVector(this.dVel[i] as THREE.Vector3, dt);
      const s = Math.min(1, life);
      this.scale.set(s, s, s);
      this.matrix.compose(p, this.dRot[i] as THREE.Quaternion, this.scale);
      this.debris.setMatrixAt(i, this.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.group.removeFromParent();
    disposeObject(this.group);
  }

  /** A random point in a shell 160..420 units from the planet, off the planet itself. */
  private randomSpot(): THREE.Vector3 {
    const dir = new THREE.Vector3(range(this.rng, -1, 1), range(this.rng, -0.4, 0.4), range(this.rng, -1, 1)).normalize();
    return this.centre.clone().addScaledVector(dir, range(this.rng, 160, 420));
  }
}
