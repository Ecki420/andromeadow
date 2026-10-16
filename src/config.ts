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

  /** ID of the system every new player starts in. Must exist in the generated galaxy. */
  startingSystemIndex: 0,

  /** In-system world units. The star sits at the origin; the planet orbits at this radius. */
  planetOrbitRadius: 1800,
  /** How far from the star a brand-new player's ship is placed. */
  newPlayerSpawnDistance: 600,
} as const;

export type Config = typeof CONFIG;
