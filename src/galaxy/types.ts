export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlanetData {
  name: string;
  /** Distance from the star, in-system world units. */
  orbitRadius: number;
  /** Where on the orbit the planet sits (fixed in Rev 1, radians). */
  orbitAngle: number;
  /** Rough radius in world units (drives the voxel build). */
  radius: number;
  /** 0xRRGGBB */
  color: number;
}

export interface StarSystem {
  /** Stable ID, safe to store in a save. */
  id: string;
  /** Index into Galaxy.systems. */
  index: number;
  name: string;
  /** Position on the galaxy map. */
  position: Vec3;
  /** 0xRRGGBB */
  starColor: number;
  /** Rough radius in in-system world units. */
  starRadius: number;
  /** Rev 1: exactly one planet per system. Kept as an array so more can be added later. */
  planets: PlanetData[];
}

export interface Galaxy {
  seed: number;
  jumpRange: number;
  systems: StarSystem[];
}
