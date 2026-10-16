import { CONFIG } from "../config.ts";
import { createRng, pick, range } from "./rng.ts";
import { planetName, starName } from "./names.ts";
import type { Galaxy, StarSystem, Vec3 } from "./types.ts";

const STAR_PALETTE = [0xfff4d6, 0xffd27a, 0xffb347, 0xff8c5a, 0xbfd9ff, 0xe8f0ff, 0xfff0a0];
const PLANET_PALETTE = [0x5a8dd6, 0xc98b4b, 0x7fb069, 0xb08fd6, 0xd66d5a, 0x8fa6b0, 0xe0c080];

export interface GeneratorOptions {
  seed?: number;
  starCount?: number;
  extent?: number;
  minSpacing?: number;
  jumpRange?: number;
}

export function distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Generate the fixed Rev 1 galaxy. Deterministic for a given seed.
 * Guarantees the connectivity rule: every star reachable from every other
 * star by chains of jumps no longer than jumpRange.
 */
export function generateGalaxy(options: GeneratorOptions = {}): Galaxy {
  const seed = options.seed ?? CONFIG.galaxySeed;
  const starCount = options.starCount ?? CONFIG.starCount;
  const extent = options.extent ?? CONFIG.galaxyExtent;
  const minSpacing = options.minSpacing ?? CONFIG.minStarSpacing;
  const jumpRange = options.jumpRange ?? CONFIG.jumpRange;

  const rng = createRng(seed);
  const systems: StarSystem[] = [];
  const usedNames = new Set<string>();

  // Rejection-sample positions inside a flattened disc so the map reads as a galaxy
  // rather than a cube of noise. Enforce minimum spacing so labels stay legible.
  let attempts = 0;
  while (systems.length < starCount) {
    if (++attempts > starCount * 500) {
      throw new Error("Galaxy generator could not place stars with the requested spacing");
    }
    const position: Vec3 = {
      x: range(rng, -extent, extent),
      y: range(rng, -extent * 0.35, extent * 0.35),
      z: range(rng, -extent, extent),
    };
    if (Math.hypot(position.x, position.z) > extent) continue;
    if (systems.some((s) => distance(s.position, position) < minSpacing)) continue;

    let name = starName(rng);
    while (usedNames.has(name)) name = starName(rng);
    usedNames.add(name);

    const index = systems.length;
    systems.push({
      id: `sys-${index}`,
      index,
      name,
      position,
      starColor: pick(rng, STAR_PALETTE),
      starRadius: range(rng, 90, 160),
      planets: [
        {
          name: planetName(name, 0),
          orbitRadius: CONFIG.planetOrbitRadius,
          orbitAngle: range(rng, 0, Math.PI * 2),
          radius: range(rng, 28, 60),
          color: pick(rng, PLANET_PALETTE),
        },
      ],
    });
  }

  const galaxy: Galaxy = { seed, jumpRange, systems };
  enforceConnectivity(galaxy);
  return galaxy;
}

/** Indices of every system within jumpRange of the given one (excluding itself). */
export function neighboursOf(galaxy: Galaxy, index: number): number[] {
  const origin = galaxy.systems[index];
  if (!origin) return [];
  const out: number[] = [];
  for (const s of galaxy.systems) {
    if (s.index !== index && distance(s.position, origin.position) <= galaxy.jumpRange) out.push(s.index);
  }
  return out;
}

/** Connected components under the jump-range graph. Each entry is a list of indices. */
export function components(galaxy: Galaxy): number[][] {
  const seen = new Array<boolean>(galaxy.systems.length).fill(false);
  const result: number[][] = [];
  for (let start = 0; start < galaxy.systems.length; start++) {
    if (seen[start]) continue;
    const comp: number[] = [];
    const queue = [start];
    seen[start] = true;
    while (queue.length) {
      const i = queue.shift() as number;
      comp.push(i);
      for (const n of neighboursOf(galaxy, i)) {
        if (!seen[n]) {
          seen[n] = true;
          queue.push(n);
        }
      }
    }
    result.push(comp);
  }
  return result;
}

export function isConnected(galaxy: Galaxy): boolean {
  return components(galaxy).length <= 1;
}

/**
 * Deterministic fix-up: while more than one component exists, slide the whole of
 * the second-largest component toward the largest along the shortest gap between
 * them until that gap is 85% of jump range. Each pass merges at least one
 * component, so this always terminates.
 */
export function enforceConnectivity(galaxy: Galaxy): void {
  for (let guard = 0; guard < galaxy.systems.length; guard++) {
    const comps = components(galaxy).sort((a, b) => b.length - a.length);
    if (comps.length <= 1) return;
    const main = comps[0] as number[];
    const other = comps[1] as number[];

    let best: { a: StarSystem; b: StarSystem; d: number } | null = null;
    for (const ai of main) {
      for (const bi of other) {
        const a = galaxy.systems[ai] as StarSystem;
        const b = galaxy.systems[bi] as StarSystem;
        const d = distance(a.position, b.position);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    if (!best) return;

    const target = galaxy.jumpRange * 0.85;
    const shift = best.d - target;
    if (shift <= 0) continue;
    const dir = {
      x: (best.a.position.x - best.b.position.x) / best.d,
      y: (best.a.position.y - best.b.position.y) / best.d,
      z: (best.a.position.z - best.b.position.z) / best.d,
    };
    for (const bi of other) {
      const p = (galaxy.systems[bi] as StarSystem).position;
      p.x += dir.x * shift;
      p.y += dir.y * shift;
      p.z += dir.z * shift;
    }
  }
  if (!isConnected(galaxy)) {
    throw new Error("Galaxy connectivity could not be enforced");
  }
}
