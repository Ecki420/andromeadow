import * as THREE from "three";
import { createRng } from "../galaxy/rng.ts";
import type { ShipData } from "../ship/ShipData.ts";

export interface VoxelSphereOptions {
  radius: number;
  /** Edge length of one cube. */
  voxel: number;
  color: number;
  /** Unlit (stars) or lit (planets, hulls). */
  emissive?: boolean;
  /** Per-cube lightness jitter, 0..1. */
  jitter?: number;
  seed?: number;
}

/** A blocky sphere built from instanced cubes. Cheap, and exactly the Rev 1 look. */
export function voxelSphere(o: VoxelSphereOptions): THREE.InstancedMesh {
  const n = Math.ceil(o.radius / o.voxel);
  const cells: THREE.Vector3[] = [];
  for (let x = -n; x <= n; x++) {
    for (let y = -n; y <= n; y++) {
      for (let z = -n; z <= n; z++) {
        const p = new THREE.Vector3(x * o.voxel, y * o.voxel, z * o.voxel);
        if (p.length() <= o.radius) cells.push(p);
      }
    }
  }
  const geometry = new THREE.BoxGeometry(o.voxel, o.voxel, o.voxel);
  const material = o.emissive
    ? new THREE.MeshBasicMaterial({ color: 0xffffff })
    : new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
  const matrix = new THREE.Matrix4();
  const base = new THREE.Color(o.color);
  const tint = new THREE.Color();
  const rng = createRng(o.seed ?? 1);
  const jitter = o.jitter ?? 0.2;
  cells.forEach((p, i) => {
    matrix.makeTranslation(p.x, p.y, p.z);
    mesh.setMatrixAt(i, matrix);
    tint.copy(base).offsetHSL(0, 0, (rng() - 0.5) * jitter);
    mesh.setColorAt(i, tint);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function box(w: number, h: number, d: number, color: number, lit = true): THREE.Mesh {
  const material = lit ? new THREE.MeshLambertMaterial({ color }) : new THREE.MeshBasicMaterial({ color });
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

/**
 * The Rev 1 hull as a handful of blocks. Nose points down +Z, which is the
 * direction Object3D.lookAt() turns a non-camera object toward.
 */
export function buildShipModel(ship: ShipData): THREE.Group {
  const s = ship.size / 6;
  const group = new THREE.Group();

  const hull = box(1.6 * s, 1.0 * s, 6 * s, ship.color);
  group.add(hull);

  const nose = box(1.0 * s, 0.6 * s, 1.2 * s, ship.color);
  nose.position.set(0, 0, 3.4 * s);
  group.add(nose);

  const canopy = box(0.8 * s, 0.5 * s, 1.2 * s, 0x4cc9f0, false);
  canopy.position.set(0, 0.7 * s, 1.4 * s);
  group.add(canopy);

  const wings = box(5 * s, 0.2 * s, 2 * s, 0x9aa3ad);
  wings.position.set(0, -0.2 * s, -0.6 * s);
  group.add(wings);

  for (const side of [-1, 1]) {
    const engine = box(0.7 * s, 0.7 * s, 1.2 * s, 0x5c6670);
    engine.position.set(side * 1.0 * s, 0, -3.0 * s);
    group.add(engine);
    const glow = box(0.45 * s, 0.45 * s, 0.3 * s, 0x7fe3ff, false);
    glow.position.set(side * 1.0 * s, 0, -3.75 * s);
    group.add(glow);
  }
  return group;
}

/** Frees GPU resources for everything under an object. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else if (material) material.dispose();
  });
}
