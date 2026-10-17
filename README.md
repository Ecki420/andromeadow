# Andromeadow — Rev 1

Browser-based 3D voxel galaxy: one ship, about 50 star systems, point-and-click
flight, in-system and star-to-star jumps, position saved to the player's account.
The build brief is `CLAUDE.md`.

## Run it

```
npm install
npm run dev
```

Open http://localhost:5173. Requires Node 22 or newer.

Other scripts:

- `npm run check` — TypeScript type check
- `npm test` — galaxy generator tests (determinism, connectivity rule)
- `npm run build` — production bundle in `dist/`

## Saves: local stub vs Supabase

With no `.env` the game uses a **local stub**: accounts and saves live in the
browser's localStorage. Any email and a 6+ character password work. This is for
development only and is not secure.

To switch to Supabase:

1. Create a free project at supabase.com.
2. In the SQL editor, run `supabase/schema.sql` once. It creates `player_saves`
   with row-level security so each player can only read and write their own row.
3. Copy `.env.example` to `.env` and fill in the project URL and anon key from
   Project Settings → API.
4. Restart `npm run dev`. The console logs `backend: supabase` on boot.

**Current state (16 Oct 2026):** the project "Andromeadow (Game)" is set up and
`.env` points at it. Email confirmation is turned **off** in the dashboard
(Authentication → Sign In / Providers → Confirm email) because Supabase's
built-in mailer allows only a few emails per hour. Turn it back on before
anyone outside the team plays. Supabase also rejects made-up email domains, so
test accounts need a real domain such as gmail.com. One test account exists:
`andromeadow.rev1.test@gmail.com`.

## Layout

```
src/config.ts            every tunable default (star count, seed, jump timings)
src/galaxy/              seeded generator, names, connectivity check (+ tests)
src/system/              one loaded star system: voxel star, planet, labels
src/ship/                ship data (swappable) and the movement layer
src/input/               point-and-click → intents; no movement logic here
src/jump/                jump state machine and the hyperspace tunnel
src/map/                 galaxy map (instanced stars, range shell, links)
src/save/                Backend interface, local stub, Supabase implementation
src/ui/                  HUD, login, map panel, jump overlay
src/game/Game.ts         orchestrator: scenes, loop, saving
supabase/schema.sql      the one table Rev 1 needs
```

## Controls

Point-and-click (Rev 1):

- Click a body, its floating label, or its entry in the system panel: autopilot there at cruise speed.
- **Jump to target** appears when the target is further than the one-minute approach distance.
- **Galaxy map**: gold is the current star, cyan stars are within jump range. Select one and press Jump.

Manual flight (Rev 2):

- **W / Up** throttle up, **S / Down** throttle down. **A / Left** and **D / Right** turn. **Q / E** roll.
- Hold the **right mouse button** and move the mouse to steer the nose. A crosshair shows while it is held.
- **Left mouse button** fires the cannon. Clicking on a body still autopilots there instead.
- Any steering input takes the ship off the autopilot at its current speed.
- Wheel zooms the chase camera, which follows the ship's nose.
- A few drifting asteroids near each planet break apart when hit and come back a little later.

## Design notes kept for later revisions

- The ship is a data record in `src/ship/ShipData.ts`; more hulls are new entries.
- Movement (`Ship.ts`) takes a target point and never reads input. A manual
  steering layer can drive the same position and heading.
- Jump range is one config value today. The generator's connectivity check runs
  against whatever range is passed, so a per-ship range later only needs the
  check moved to the ship's value.
- Only the current system is ever built; the galaxy is a list of ids, names
  and positions.
