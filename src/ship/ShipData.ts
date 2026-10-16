import { CONFIG } from "../config.ts";

/**
 * A ship is a swappable data item. Rev 1 ships one hull; later revisions add more
 * by adding entries to SHIPS and letting the save record a different shipId.
 */
export interface ShipData {
  id: string;
  name: string;
  /** In-system world units per second. */
  cruiseSpeed: number;
  /** Galaxy-map units. Rev 1: a single fixed value for every ship, from config. */
  jumpRange: number;
  /** Rough hull length in world units, drives the voxel build. */
  size: number;
  /** 0xRRGGBB */
  color: number;
}

export const SHIPS: Record<string, ShipData> = {
  "wren-mk1": {
    id: "wren-mk1",
    name: "Wren Mk I",
    cruiseSpeed: 12,
    jumpRange: CONFIG.jumpRange,
    size: 6,
    color: 0xd9dde3,
  },
};

export const DEFAULT_SHIP_ID = "wren-mk1";

export function getShip(id: string): ShipData {
  const ship = SHIPS[id] ?? SHIPS[DEFAULT_SHIP_ID];
  if (!ship) throw new Error("No ships defined");
  return ship;
}
