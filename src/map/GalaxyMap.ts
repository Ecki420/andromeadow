import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Galaxy } from "../galaxy/types.ts";
import { distance, neighboursOf } from "../galaxy/generator.ts";

const COLOR_CURRENT = new THREE.Color(0xffd166);
const COLOR_REACHABLE = new THREE.Color(0x4cc9f0);
const COLOR_FAR = new THREE.Color(0x6b7482);
const COLOR_SELECTED = new THREE.Color(0xffffff);

/**
 * The galaxy map: every star as one instanced cube, names as DOM labels,
 * the current star highlighted with its jump-range shell and links to
 * every star it can reach. Lives in its own scene; the system is not rendered
 * while the map is open.
 */
export class GalaxyMap {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly stars: THREE.InstancedMesh;
  private readonly labels: HTMLElement[] = [];
  private readonly rangeShell: THREE.Mesh;
  private links: THREE.LineSegments | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private currentIndex = 0;
  private selectedIndex: number | null = null;
  private reachable = new Set<number>();
  private down: { x: number; y: number; moved: number } | null = null;
  private last = { x: 0, y: 0 };
  private open = false;

  onSelect: ((index: number | null) => void) | null = null;

  constructor(
    readonly galaxy: Galaxy,
    private readonly el: HTMLElement,
    aspect: number,
  ) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 5000);
    this.scene.background = new THREE.Color(0x04060c);
    this.controls = new OrbitControls(this.camera, el);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.enabled = false;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 600;

    const n = galaxy.systems.length;
    this.stars = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      n,
    );
    const m = new THREE.Matrix4();
    galaxy.systems.forEach((s, i) => {
      m.makeTranslation(s.position.x, s.position.y, s.position.z);
      this.stars.setMatrixAt(i, m);
      this.stars.setColorAt(i, COLOR_FAR);

      const label = document.createElement("button");
      label.className = "map-label";
      label.textContent = s.name;
      label.addEventListener("click", (e) => {
        e.stopPropagation();
        this.select(i);
      });
      const obj = new CSS2DObject(label);
      obj.position.set(s.position.x, s.position.y + 2.5, s.position.z);
      this.scene.add(obj);
      this.labels.push(label);
    });
    this.stars.instanceMatrix.needsUpdate = true;
    this.scene.add(this.stars);

    // Faint galactic plane grid for orientation.
    const grid = new THREE.GridHelper(260, 26, 0x1a2436, 0x111826);
    this.scene.add(grid);

    this.rangeShell = new THREE.Mesh(
      new THREE.SphereGeometry(galaxy.jumpRange, 32, 20),
      new THREE.MeshBasicMaterial({ color: 0x4cc9f0, wireframe: true, transparent: true, opacity: 0.12 }),
    );
    this.scene.add(this.rangeShell);

    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
  }

  get isOpen(): boolean {
    return this.open;
  }

  get selected(): number | null {
    return this.selectedIndex;
  }

  isReachable(index: number): boolean {
    return this.reachable.has(index);
  }

  distanceTo(index: number): number {
    const a = this.galaxy.systems[this.currentIndex];
    const b = this.galaxy.systems[index];
    return a && b ? distance(a.position, b.position) : Infinity;
  }

  show(currentIndex: number): void {
    this.open = true;
    this.currentIndex = currentIndex;
    this.selectedIndex = null;
    this.reachable = new Set(neighboursOf(this.galaxy, currentIndex));
    const cur = this.galaxy.systems[currentIndex];
    if (!cur) return;
    const centre = new THREE.Vector3(cur.position.x, cur.position.y, cur.position.z);
    this.rangeShell.position.copy(centre);
    this.controls.target.copy(centre);
    this.camera.position.copy(centre).add(new THREE.Vector3(40, 55, 90));
    this.controls.enabled = true;
    this.controls.update();
    this.rebuildLinks(centre);
    this.recolour();
  }

  hide(): void {
    this.open = false;
    this.controls.enabled = false;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(): void {
    if (this.open) this.controls.update();
  }

  private select(index: number | null): void {
    this.selectedIndex = index;
    this.recolour();
    this.onSelect?.(index);
  }

  private rebuildLinks(centre: THREE.Vector3): void {
    if (this.links) {
      this.links.geometry.dispose();
      (this.links.material as THREE.Material).dispose();
      this.scene.remove(this.links);
    }
    const pts: THREE.Vector3[] = [];
    for (const i of this.reachable) {
      const s = this.galaxy.systems[i];
      if (s) pts.push(centre.clone(), new THREE.Vector3(s.position.x, s.position.y, s.position.z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(pts);
    this.links = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: 0x4cc9f0, transparent: true, opacity: 0.45 }),
    );
    this.scene.add(this.links);
  }

  private recolour(): void {
    const m = new THREE.Matrix4();
    this.galaxy.systems.forEach((s, i) => {
      let colour = COLOR_FAR;
      let size = 1;
      let cls = "map-label";
      if (i === this.currentIndex) {
        colour = COLOR_CURRENT;
        size = 1.8;
        cls += " current";
      } else if (this.reachable.has(i)) {
        colour = COLOR_REACHABLE;
        size = 1.3;
        cls += " reachable";
      }
      if (i === this.selectedIndex) {
        colour = COLOR_SELECTED;
        size *= 1.4;
        cls += " selected";
      }
      m.compose(
        new THREE.Vector3(s.position.x, s.position.y, s.position.z),
        new THREE.Quaternion(),
        new THREE.Vector3(size, size, size),
      );
      this.stars.setMatrixAt(i, m);
      this.stars.setColorAt(i, colour);
      const label = this.labels[i];
      if (label) label.className = cls;
    });
    this.stars.instanceMatrix.needsUpdate = true;
    if (this.stars.instanceColor) this.stars.instanceColor.needsUpdate = true;
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.open || e.button !== 0) return;
    this.down = { x: e.clientX, y: e.clientY, moved: 0 };
    this.last = { x: e.clientX, y: e.clientY };
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.down) return;
    this.down.moved += Math.abs(e.clientX - this.last.x) + Math.abs(e.clientY - this.last.y);
    this.last = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.down) return;
    const wasClick = this.down.moved < 6;
    this.down = null;
    if (!this.open || !wasClick) return;
    const rect = this.el.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    // Generous pick radius: scale cubes up virtually by testing against spheres.
    let best: { i: number; d: number } | null = null;
    const ray = this.raycaster.ray;
    const p = new THREE.Vector3();
    this.galaxy.systems.forEach((s, i) => {
      p.set(s.position.x, s.position.y, s.position.z);
      const d = ray.distanceToPoint(p);
      const camDist = p.distanceTo(this.camera.position);
      const pickRadius = 1.5 + camDist * 0.012;
      if (d <= pickRadius && (!best || d < best.d)) best = { i, d };
    });
    this.select(best ? (best as { i: number }).i : null);
  };
}
