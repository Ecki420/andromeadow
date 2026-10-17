# Andromeadow — Rev 1 Build Brief

## What this game is (long-term vision — for context only)
A browser-based space universe inspired by *The Universal* (Mitchell Goodwin, early 2000s) and *Empyrion*.
The universe is made of star systems. Some are wild, some have space stations, about 80% have planets.
Long-term, each planet is its own game server: a host (usually a paying player) can customise its game, rules and graphics.
Planets without a custom host use one of 5 world templates (resource-rich but hostile, barren and peaceful, and options in between), which set the new settler's starting difficulty.

**None of the planet, station, trading or hosting features are built in Rev 1.** They are listed only so the Rev 1 code leaves room for them.

**Originality rule:** do not copy code, art, names or text from The Universal, A Tractor, Elite Dangerous or Empyrion. Game mechanics may be used as inspiration.

## Rev 1 scope — in one sentence
A logged-in player flies one ship around a fixed 3D voxel-style galaxy of about 50 star systems, jumping between stars and between bodies inside a system, and their position is saved to their account.

## Rev 1 features

### 1. Accounts and saving
- Email + password login using Supabase Auth (ready-made service; do not build a custom login system).
- Player save stored in Supabase database: current star system ID and ship position within that system.
- On login, the player resumes exactly where they left off. New players start in a fixed starting system.

### 2. Galaxy
- About 50 star systems in 3D space.
- Layout is generated once from a fixed seed and never changes in Rev 1.
- Star and planet names are auto-generated and stay fixed (same seed).
- The galaxy itself is stored as lightweight data only: system ID, name, position. It is never loaded as one big scene.
- **Connectivity rule:** using the Rev 1 jump range, every star must be reachable from every other star through a chain of jumps. The generator must check this and fix or regenerate until true. No isolated stars or isolated pairs.

### 3. Star systems (one instance each)
- Each star system is a separate instance: only the current system is loaded and rendered.
- Rev 1 content per system: 1 star + 1 planet. The planet is visual only; no landing.
- Visual style: 3D, voxel/blocky low-poly. No detailed models or textures needed.

### 4. Ship
- One ship only, same for every player.
- Code must treat the ship as a swappable data item (stats: cruise speed, jump range) so more starter ships can be added later without rework.

### 5. Flying — point-and-click
- Player clicks a target in the current system; the ship flies there by itself at cruise speed.
- Keep input handling as a separate layer from ship movement, so manual keyboard + mouse steering can be added in a later revision without rewriting movement.

### 6. Jumps — two types

**a) Star-to-star jump (between instances)**
- Player opens the galaxy map and selects a star within jump range.
- Rev 1 jump range: one fixed value for every ship, set so that the connectivity rule above holds (at minimum the nearest star is always reachable).
- Sequence: charge-up countdown → hyperspace tunnel animation (voxel star-streaks) → arrival flash.
- The old system unloads and the new system loads **during** the tunnel animation, so the player never sees a loading screen.
- Player arrives near the destination star.

**b) In-system jump (within the same instance)**
- Player selects the star or the planet in the current system and jumps to it.
- No loading needed; use a shorter, lighter version of the jump animation.

**Arrival distance (both jump types):** the ship arrives at a distance equal to **cruise speed × 60 seconds** from the target body, so the final approach always takes about 1 minute at cruise speed, whatever the ship's speed.

### 7. Galaxy map
- Shows all ~50 stars in 3D, with names.
- Highlights the current system and stars within jump range.
- Selecting a reachable star starts the star-to-star jump.

## Tunable defaults (keep in one config file)
| Setting | Rev 1 default |
|---|---|
| Number of star systems | 50 |
| Galaxy seed | fixed value, stored in config |
| Jump charge-up time | 5 seconds |
| Hyperspace tunnel minimum duration | 4 seconds (extend automatically if loading takes longer) |
| In-system jump animation | 2 seconds |
| Final approach time after any jump | 60 seconds at cruise speed |

## Technology
- Browser-based, desktop browsers first.
- 3D rendering: Three.js. Use instancing for the star field on the galaxy map.
- Language/tooling: TypeScript + Vite.
- Backend: Supabase (Auth + Postgres database), free plan for development.
- Rev 1 runs locally for development and testing. Public hosting is not part of Rev 1.

## Out of scope for Rev 1 (do not build)
Landing on planets, planet servers, world templates, space stations, docking, trading, multiplayer / seeing other players, combat, manual steering, multiple ships, variable jump range, payments, player-hosted content.

## Planned for later revisions (design so these can be added)
1. Manual keyboard + mouse steering for combat and emergencies (alongside point-and-click).
2. Multiple starter ships.
3. Elite-style jump range: depends on drive, ship mass, cargo and fuel.
4. Space stations, docking, trading.
5. Multiplayer.
6. Landing on planets; each planet as its own game server.
7. 5 world templates setting starting difficulty.
8. Player-hosted planets (rules, settings, graphics first; uploaded code only later, inside a strict sandbox).
9. Paid hosting.

## Design notes for later revisions (not built in Rev 1)

### Spaceports and exports — the one thing every planet server has in common
- Every planet, whether custom-hosted or on a world template, has exactly one **export place**. It is also the planet's **spaceport**: the only place where a ship lands from space and takes off again.
- The export place exchanges goods obtained on the planet for **CC (cosmic credits)**, the currency spent in space while flying the ship.
- **Every planet produces something and every planet must export something.** A planet with nothing to export is not allowed. World templates and host customisation set *what* and *how much*, never *whether*.
- Design consequences to keep in mind when Rev 2+ adds planets: the spaceport is the hand-off point between the planet game (per-server) and the space game (shared), so planet-side goods and space-side CC meet only there; landing and take-off are the same location, so one spaceport position per planet is enough in the data model.

## Rev 2 — Manual steering and a first weapon

Rev 1 is complete (see "Done means" below). Rev 2 adds hands-on flying alongside point-and-click, plus a basic cannon so there is something to do with the left mouse button. No enemies, no damage model, no planets yet.

### Controls (Carl's spec, 2026-10-17)
- **Keyboard steering, independent of the mouse.** Arrow keys and WASD do the same thing:
  - W / Up: throttle up toward cruise speed. S / Down: throttle down to a stop (no reverse in Rev 2).
  - A / Left and D / Right: turn (yaw) left and right.
  - Q / E: roll left and right (optional, cheap to add, can be dropped).
- **Mouse turning only while the right mouse button is held.** Moving the mouse with RMB down turns the ship's nose (yaw and pitch). Releasing RMB stops mouse turning; the mouse alone never steers.
- **Left mouse button fires the weapon.** Hold to keep firing at a fixed rate.

### Defaults filled in by Claude (change if wrong)
- **Point-and-click still works.** Clicking a star, planet or its label starts the autopilot exactly as in Rev 1. Left-clicking empty space fires the weapon. Any steering input (keys or RMB turning) cancels the autopilot and hands control to the player.
- **Flight feel.** The ship accelerates and decelerates smoothly rather than snapping to speed. Turn rate is a ship stat alongside cruise speed and jump range, so later hulls can handle differently.
- **Camera.** Stays behind the ship and follows its nose. Mouse wheel still zooms. The Rev 1 left-drag camera orbit is removed, since left-drag would now fire.
- **Weapon.** One fixed forward cannon: glowing voxel bolts with a short lifetime and a cooldown, pooled so firing never allocates. No ammo, no heat, no sound yet.
- **Practice targets.** A handful of drifting voxel asteroids near the starting system's planet that break apart when hit, so firing has feedback. Purely cosmetic; they respawn. Can be cut if time is short.
- **Jumps and saving.** Unchanged. Charge-up locks steering as before. Velocity is not saved; the ship resumes at rest.
- **HUD.** Adds a throttle/speed readout, a small crosshair while RMB is held, and a one-line hint of the keys.

### Architecture rule
Keyboard and mouse live in a new input layer beside `PointAndClick` and produce intents (throttle, yaw, pitch, roll, fire). `Ship` grows a manual-control path next to its flyTo path; it still never reads input directly.

### Done means (Rev 2)
- Player can take off from the autopilot with WASD or arrows, turn with RMB-held mouse, throttle up and down, and fly around the star and planet.
- LMB fires bolts that travel and expire; hitting a practice asteroid breaks it.
- Clicking a body still autopilots there; steering input cancels it.
- Jumps, galaxy map, login and resume all still pass the Rev 1 checks.

## Done means
- A new player can sign up, log in, see their ship in the starting system, click to fly, jump to the planet, open the galaxy map, jump to another star with the full animation, log out, log back in on another device, and resume in the same place.
- The connectivity check passes for the generated galaxy.
