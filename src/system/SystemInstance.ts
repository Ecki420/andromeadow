import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { StarSystem } from "../galaxy/types.ts";
import { disposeObject, voxelSphere } from "./voxel.ts";
import { AsteroidField } from "../combat/AsteroidField.ts";

export type BodyKind = "star" | "planet";

export interface Body {
  kind: BodyKind;
  name: string;
  position: THREE.Vector3;
  radius: number;
  object: THREE.Object3D;
}

/**
 * One star system, fully built and ready to render. Only one exists at a time;
 * the previous one is disposed while the hyperspace tunnel plays.
 */
export class SystemInstance {
  readonly group = new THREE.Group();
  readonly bodies: Body[] = [];
  /** Objects that respond to a click (raycast targets). */
  readonly clickable: THREE.Object3D[] = [];
  /** Rev 2 practice targets, drifting near the planet. */
  readonly asteroids: AsteroidField;

  constructor(
    readonly system: StarSystem,
    onLabelClick: (body: Body) => void,
  ) {
    // Star: unlit voxel ball with a soft glow shell and the system's light source.
    const star = voxelSphere({
      radius: system.starRadius,
      voxel: system.starRadius / 6,
      color: system.starColor,
      emissive: true,
      jitter: 0.18,
      seed: system.index + 1,
    });
    this.group.add(star);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(system.starRadius * 1.6, 16, 12),
      new THREE.MeshBasicMaterial({ color: system.starColor, transparent: true, opacity: 0.12, depthWrite: false }),
    );
    this.group.add(glow);
    this.group.add(new THREE.PointLight(system.starColor, 3, 0, 0));
    this.group.add(new THREE.AmbientLight(0x5a6a80, 1.2));

    this.addBody("star", system.name, star, new THREE.Vector3(0, 0, 0), system.starRadius, onLabelClick);

    // Planet(s): lit voxel balls on a fixed orbit, with a faint ring so the orbit reads.
    system.planets.forEach((planet, i) => {
      const mesh = voxelSphere({
        radius: planet.radius,
        voxel: planet.radius / 5,
        color: planet.color,
        jitter: 0.3,
        seed: system.index * 7 + i + 11,
      });
      const position = new THREE.Vector3(
        Math.cos(planet.orbitAngle) * planet.orbitRadius,
        0,
        Math.sin(planet.orbitAngle) * planet.orbitRadius,
      );
      mesh.position.copy(position);
      this.group.add(mesh);
      this.group.add(orbitRing(planet.orbitRadius));
      this.addBody("planet", planet.name, mesh, position, planet.radius, onLabelClick);
    });

    const planet = this.bodies.find((b) => b.kind === "planet") ?? this.bodies[0];
    this.asteroids = new AsteroidField(planet ? planet.position : new THREE.Vector3(), system.index + 101);
    this.group.add(this.asteroids.group);
  }

  private addBody(
    kind: BodyKind,
    name: string,
    object: THREE.Object3D,
    position: THREE.Vector3,
    radius: number,
    onLabelClick: (body: Body) => void,
  ): void {
    const body: Body = { kind, name, position, radius, object };
    this.bodies.push(body);
    this.clickable.push(object);

    const el = document.createElement("button");
    el.className = `body-label body-label-${kind}`;
    el.textContent = name;
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      onLabelClick(body);
    });
    const label = new CSS2DObject(el);
    label.position.set(0, radius * 1.5, 0);
    object.add(label);
  }

  bodyFor(object: THREE.Object3D): Body | null {
    let cursor: THREE.Object3D | null = object;
    while (cursor) {
      const hit = this.bodies.find((b) => b.object === cursor);
      if (hit) return hit;
      cursor = cursor.parent;
    }
    return null;
  }

  dispose(): void {
    this.asteroids.dispose();
    this.group.removeFromParent();
    disposeObject(this.group);
    // CSS2DObjects drop their DOM element on the "removed" event.
    this.bodies.forEach((b) => b.object.children.filter((c) => c instanceof CSS2DObject).forEach((c) => c.removeFromParent()));
  }
}

function orbitRing(radius: number): THREE.LineLoop {
  const points: THREE.Vector3[] = [];
  const segments = 128;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x2a3a52, transparent: true, opacity: 0.6 });
  return new THREE.LineLoop(geometry, material);
}

/** Shared background: a sphere of distant points. Built once, kept across systems. */
export function buildStarfield(count = 3000, radius = 25000, seed = 9): THREE.Points {
  const positions = new Float32Array(count * 3);
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1;
    const t = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions[i * 3] = r * Math.cos(t) * radius;
    positions[i * 3 + 1] = u * radius;
    positions[i * 3 + 2] = r * Math.sin(t) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xcfd8e6, size: 2, sizeAttenuation: false });
  return new THREE.Points(geometry, material);
}
