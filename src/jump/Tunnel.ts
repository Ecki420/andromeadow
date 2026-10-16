import * as THREE from "three";

/**
 * The hyperspace tunnel: a cylinder of voxel streaks rushing past the camera.
 * Rendered in its own scene while the destination system loads behind it.
 */
export class Tunnel {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly streaks: THREE.InstancedMesh;
  private readonly z: Float32Array;
  private readonly r: Float32Array;
  private readonly a: Float32Array;
  private readonly count = 700;
  private readonly depth = 240;
  private readonly matrix = new THREE.Matrix4();
  private readonly quat = new THREE.Quaternion();
  private readonly pos = new THREE.Vector3();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  /** 1 = full star-to-star tunnel, lower = the lighter in-system version. */
  intensity = 1;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(95, aspect, 0.1, 1000);
    this.scene.background = new THREE.Color(0x02040a);
    this.scene.fog = new THREE.Fog(0x02040a, 60, this.depth);

    this.z = new Float32Array(this.count);
    this.r = new Float32Array(this.count);
    this.a = new Float32Array(this.count);
    let s = 1234;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < this.count; i++) {
      this.z[i] = -rnd() * this.depth;
      this.r[i] = 3 + rnd() * 34;
      this.a[i] = rnd() * Math.PI * 2;
    }

    const geometry = new THREE.BoxGeometry(0.25, 0.25, 7);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.streaks = new THREE.InstancedMesh(geometry, material, this.count);
    const c = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      c.setHSL(0.58 + rnd() * 0.08, 0.8, 0.6 + rnd() * 0.35);
      this.streaks.setColorAt(i, c);
    }
    this.scene.add(this.streaks);
    this.update(0);
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    const speed = 40 + 160 * this.intensity;
    const stretch = 0.6 + 1.6 * this.intensity;
    this.scale.set(1, 1, stretch);
    for (let i = 0; i < this.count; i++) {
      let z = (this.z[i] as number) + speed * dt;
      if (z > 6) z -= this.depth;
      this.z[i] = z;
      const r = this.r[i] as number;
      const a = this.a[i] as number;
      this.pos.set(Math.cos(a) * r, Math.sin(a) * r, z);
      this.matrix.compose(this.pos, this.quat, this.scale);
      this.streaks.setMatrixAt(i, this.matrix);
    }
    this.streaks.instanceMatrix.needsUpdate = true;
    this.camera.rotation.z += dt * 0.15 * this.intensity;
  }
}
