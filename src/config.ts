/**
 * Every tunable default for Rev 1 lives here (see CLAUDE.md "Tunable defaults").
 * Nothing else in the codebase should hard-code one of these numbers.
 */
export const CONFIG = {
  /** Number of star systems generated in the galaxy. */
  starCount: 50,
  /** Fixed seed. The galaxy layout and every name derive from it and never change in Rev 1. */
  galaxySeed: 1977_0416,
  /** Half-size of the cube the stars are scattered in (galaxy-map units). */
  galaxyExtent: 100,
  /** Minimum spacing between two stars on the map, so names stay readable. */
  minStarSpacing: 12,
  /** Fixed star-to-star jump range for every ship in Rev 1 (galaxy-map units). */
  jumpRange: 34,

  /** Seconds from pressing JUMP to entering the tunnel. */
  jumpChargeSeconds: 5,
  /** Minimum tunnel duration. Extends automatically if the next system takes longer to load. */
  tunnelMinSeconds: 4,
  /** Short alignment pause before an in-system jump. */
  inSystemChargeSeconds: 1,
  /** Lighter in-system jump animation length. */
  inSystemJumpSeconds: 2,
  /** Arrival flash fade. */
  arrivalFlashSeconds: 0.7,
  /** After any jump the ship arrives this many seconds of cruise flight from the target. */
  approachSeconds: 60,

  /** While the ship is under way, write the save this often. */
  autosaveSeconds: 5,

  // ---- Rev 2: manual steering ----
  /** Radians of turn per pixel of mouse movement while the right button is held. */
  mouseSensitivity: 0.0025,
  /** How fast W/S move the throttle, in full-throttle units per second. */
  throttleRate: 0.8,
  /** Speed change per second toward the throttle's target speed. */
  acceleration: 6,
  /** Roll speed for Q/E, radians per second. */
  rollRate: 1.6,

  // ---- Rev 2: cannon ----
  /** Shots per second while the left button is held. */
  fireRate: 6,
  /** World units per second. */
  boltSpeed: 240,
  /** Seconds a bolt lives before it vanishes. */
  boltLife: 2.5,
  /** Pool size; also the cap on bolts in flight. */
  boltPool: 64,

  // ---- Rev 2: practice asteroids ----
  asteroidsPerSystem: 6,
  /** Seconds before a destroyed asteroid comes back somewhere else. */
  asteroidRespawnSeconds: 12,

  /** ID of the system every new player starts in. Must exist in the generated galaxy. */
  startingSystemIndex: 0,

  /** In-system world units. The star sits at the origin; the planet orbits at this radius. */
  planetOrbitRadius: 1800,
  /** How far from the star a brand-new player's ship is placed. */
  newPlayerSpawnDistance: 600,
} as const;

export type Config = typeof CONFIG;
