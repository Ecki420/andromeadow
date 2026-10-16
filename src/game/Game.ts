import * as THREE from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { CONFIG } from "../config.ts";
import type { Galaxy, StarSystem } from "../galaxy/types.ts";
import type { Backend, PlayerSave, UserInfo } from "../save/types.ts";
import { DEFAULT_SHIP_ID, getShip } from "../ship/ShipData.ts";
import { Ship } from "../ship/Ship.ts";
import { SystemInstance, buildStarfield, type Body } from "../system/SystemInstance.ts";
import { PointAndClick } from "../input/PointAndClick.ts";
import { CameraRig } from "./CameraRig.ts";
import { JumpController } from "../jump/JumpController.ts";
import { Tunnel } from "../jump/Tunnel.ts";
import { GalaxyMap } from "../map/GalaxyMap.ts";
import type { UI } from "../ui/hud.ts";

/**
 * Orchestrates everything: one renderer, the current system, the ship, input,
 * jumps, the galaxy map and saving. Rendering switches between three scenes:
 * the system, the tunnel, and the map.
 */
export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly systemLabels: CSS2DRenderer;
  private readonly mapLabels: CSS2DRenderer;
  private readonly scene = new THREE.Scene();
  private readonly rig: CameraRig;
  private readonly ship: Ship;
  private readonly input: PointAndClick;
  private readonly jump = new JumpController();
  private readonly tunnel: Tunnel;
  private readonly map: GalaxyMap;
  private readonly raycaster = new THREE.Raycaster();

  private system: SystemInstance | null = null;
  private currentIndex: number;
  private target: Body | null = null;
  private lastFrame = 0;
  private dirty = false;
  private lastSaveAt = 0;
  private saving: Promise<void> | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ui: UI,
    private readonly galaxy: Galaxy,
    private readonly backend: Backend,
    private readonly user: UserInfo,
    save: PlayerSave | null,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.systemLabels = makeLabelRenderer("labels-system");
    this.mapLabels = makeLabelRenderer("labels-map");

    this.scene.background = new THREE.Color(0x02040a);
    this.scene.add(buildStarfield());

    const aspect = window.innerWidth / window.innerHeight;
    this.rig = new CameraRig(aspect);
    this.tunnel = new Tunnel(aspect);
    this.map = new GalaxyMap(galaxy, canvas, aspect);

    // Ship: from the save, or the fixed starting position for a new player.
    this.ship = new Ship(getShip(save?.shipId ?? DEFAULT_SHIP_ID));
    this.scene.add(this.ship.object);
    this.ship.onArrive = () => {
      this.dirty = true;
      void this.saveNow();
      this.refreshTargetButton();
    };

    const startIndex = save ? this.indexOfSystem(save.systemId) : CONFIG.startingSystemIndex;
    this.currentIndex = startIndex;
    this.buildSystem(startIndex);
    if (save) {
      this.ship.teleport(
        new THREE.Vector3(save.position.x, save.position.y, save.position.z),
        new THREE.Vector3(save.heading.x, save.heading.y, save.heading.z),
      );
    } else {
      this.ship.teleport(new THREE.Vector3(0, 0, CONFIG.newPlayerSpawnDistance), new THREE.Vector3(0, 0, -1));
      // A new player gets a save row straight away, so "resume" works even before they move.
      void this.saveNow();
    }

    this.input = new PointAndClick(canvas, {
      onPick: (x, y) => this.pick(x, y),
      onOrbit: (dx, dy) => this.rig.orbit(dx, dy),
      onZoom: (d) => this.rig.zoom(d),
    });

    this.jump.onPhase = (phase, req) => {
      if (phase === "tunnel") this.tunnel.intensity = req.kind === "star" ? 1 : 0.4;
      if (phase === "arriving") this.ui.flash();
      if (phase === "idle") {
        this.ui.setJumpOverlay(null);
        this.input.enabled = true;
      }
      this.updateLabelVisibility();
    };

    this.map.onSelect = (index) => this.showMapSelection(index);

    ui.onToggleMap = () => this.toggleMap();
    ui.onJumpToTarget = () => this.beginInSystemJump();
    ui.onMapJump = () => this.beginStarJump();
    ui.onLogout = () => void this.logout();
    ui.showHud(user.email);
    this.refreshTargetButton();

    window.addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void this.saveNow();
    });
    window.addEventListener("pagehide", () => void this.saveNow());
  }

  start(): void {
    this.lastFrame = performance.now();
    requestAnimationFrame(this.frame);
  }

  // ---- systems -----------------------------------------------------------

  get currentSystem(): StarSystem {
    const s = this.galaxy.systems[this.currentIndex];
    if (!s) throw new Error(`No system at index ${this.currentIndex}`);
    return s;
  }

  private indexOfSystem(id: string): number {
    const found = this.galaxy.systems.find((s) => s.id === id);
    return found ? found.index : CONFIG.startingSystemIndex;
  }

  private buildSystem(index: number): void {
    this.system?.dispose();
    this.system = new SystemInstance(this.galaxy.systems[index] as StarSystem, (body) => this.flyToBody(body));
    this.scene.add(this.system.group);
    this.currentIndex = index;
    this.target = null;
    this.ui.setSystem(
      this.system.system.name,
      this.system.bodies.map((b) => ({ kind: b.kind, name: b.name, select: () => this.flyToBody(b) })),
    );
    this.refreshTargetButton();
  }

  /** Runs during the tunnel. Yields a frame so the tunnel is on screen before the swap. */
  private async swapSystem(index: number): Promise<void> {
    await nextFrame();
    this.buildSystem(index);
    await nextFrame();
  }

  // ---- flying ------------------------------------------------------------

  private pick(ndcX: number, ndcY: number): void {
    if (!this.system || this.jump.busy) return;
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.rig.camera);
    const hits = this.raycaster.intersectObjects(this.system.clickable, true);
    const first = hits[0];
    if (!first) return;
    const body = this.system.bodyFor(first.object);
    if (body) this.flyToBody(body);
  }

  private stopDistanceFor(body: Body): number {
    return body.radius * 1.8 + 30;
  }

  private get approachDistance(): number {
    return this.ship.data.cruiseSpeed * CONFIG.approachSeconds;
  }

  private flyToBody(body: Body): void {
    if (this.jump.busy || this.map.isOpen) return;
    this.target = body;
    this.ship.flyTo(body.position, this.stopDistanceFor(body), body.name);
    this.dirty = true;
    this.refreshTargetButton();
  }

  /** Jump button is offered when the target is further away than the post-jump approach distance. */
  private refreshTargetButton(): void {
    const body = this.target;
    if (!body || this.jump.busy) {
      this.ui.setJumpTargetEnabled(false);
      return;
    }
    const dist = this.ship.position.distanceTo(body.position) - this.stopDistanceFor(body);
    const worthIt = dist > this.approachDistance * 1.15;
    this.ui.setJumpTargetEnabled(worthIt, body.name);
  }

  // ---- jumps -------------------------------------------------------------

  private beginInSystemJump(): void {
    const body = this.target;
    if (!body || this.jump.busy) return;
    this.input.enabled = false;
    this.jump.begin({
      kind: "system",
      label: body.name,
      onArrive: () => this.arriveAt(body),
    });
  }

  private beginStarJump(): void {
    const index = this.map.selected;
    if (index === null || index === this.currentIndex || !this.map.isReachable(index) || this.jump.busy) return;
    const dest = this.galaxy.systems[index];
    if (!dest) return;
    const origin = this.currentSystem;
    this.closeMap();
    this.input.enabled = false;
    this.ship.halt();
    this.jump.begin({
      kind: "star",
      label: dest.name,
      load: () => this.swapSystem(index),
      onArrive: () => {
        // Arrive on the side of the destination star that faces where we came from.
        const dir = new THREE.Vector3(
          origin.position.x - dest.position.x,
          origin.position.y - dest.position.y,
          origin.position.z - dest.position.z,
        );
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
        dir.normalize();
        const star = this.system?.bodies.find((b) => b.kind === "star");
        if (star) this.placeForApproach(star, dir);
      },
    });
  }

  /** Both jump types end here: cruise-speed x approachSeconds from the target, then fly the rest. */
  private arriveAt(body: Body): void {
    const dir = this.ship.position.clone().sub(body.position);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    this.placeForApproach(body, dir);
  }

  private placeForApproach(body: Body, fromDirection: THREE.Vector3): void {
    const stop = this.stopDistanceFor(body);
    const position = body.position.clone().addScaledVector(fromDirection, stop + this.approachDistance);
    this.ship.teleport(position, fromDirection.clone().negate());
    this.rig.resetBehind();
    this.target = body;
    this.ship.flyTo(body.position, stop, body.name);
    this.dirty = true;
    void this.saveNow();
    this.refreshTargetButton();
  }

  // ---- map ---------------------------------------------------------------

  private toggleMap(): void {
    if (this.map.isOpen) this.closeMap();
    else this.openMap();
  }

  private openMap(): void {
    if (this.jump.busy) return;
    this.map.show(this.currentIndex);
    this.input.enabled = false;
    this.ui.setMapOpen(true);
    this.ui.setMapSelection(null);
    this.updateLabelVisibility();
  }

  private closeMap(): void {
    this.map.hide();
    this.input.enabled = !this.jump.busy;
    this.ui.setMapOpen(false);
    this.updateLabelVisibility();
  }

  private showMapSelection(index: number | null): void {
    if (index === null) {
      this.ui.setMapSelection(null);
      return;
    }
    const s = this.galaxy.systems[index];
    if (!s) return;
    this.ui.setMapSelection({
      name: s.name,
      distance: this.map.distanceTo(index),
      reachable: this.map.isReachable(index),
      isCurrent: index === this.currentIndex,
    });
  }

  private updateLabelVisibility(): void {
    const inTunnel = this.jump.phase === "tunnel";
    this.systemLabels.domElement.classList.toggle("hidden", this.map.isOpen || inTunnel);
    this.mapLabels.domElement.classList.toggle("hidden", !this.map.isOpen);
  }

  // ---- saving ------------------------------------------------------------

  /** What would be saved right now. Exposed for debugging and tests. */
  snapshot(): PlayerSave {
    return this.buildSave();
  }

  private buildSave(): PlayerSave {
    return {
      shipId: this.ship.data.id,
      systemId: this.currentSystem.id,
      position: { x: this.ship.position.x, y: this.ship.position.y, z: this.ship.position.z },
      heading: { x: this.ship.heading.x, y: this.ship.heading.y, z: this.ship.heading.z },
      updatedAt: new Date().toISOString(),
    };
  }

  async saveNow(): Promise<void> {
    if (this.saving) return this.saving;
    this.dirty = false;
    this.lastSaveAt = performance.now();
    this.saving = this.backend
      .storeSave(this.user.id, this.buildSave())
      .catch((err) => console.error("Save failed", err))
      .finally(() => {
        this.saving = null;
      });
    return this.saving;
  }

  private async logout(): Promise<void> {
    await this.saveNow();
    await this.backend.signOut();
    window.location.reload();
  }

  // ---- loop --------------------------------------------------------------

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.systemLabels.setSize(w, h);
    this.mapLabels.setSize(w, h);
    this.rig.resize(w / h);
    this.tunnel.resize(w / h);
    this.map.resize(w / h);
  }

  private frame = (now: number): void => {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    this.jump.update(dt);

    if (this.map.isOpen) {
      this.map.update();
      this.renderer.render(this.map.scene, this.map.camera);
      this.mapLabels.render(this.map.scene, this.map.camera);
    } else if (this.jump.phase === "tunnel") {
      this.tunnel.update(dt);
      this.renderer.render(this.tunnel.scene, this.tunnel.camera);
    } else {
      if (!this.jump.busy) this.ship.update(dt);
      this.rig.update(this.ship, dt);
      this.renderer.render(this.scene, this.rig.camera);
      this.systemLabels.render(this.scene, this.rig.camera);
    }

    this.updateHud();

    // Periodic save while under way, so a crash mid-flight loses at most a few seconds.
    if (this.ship.travelling && now - this.lastSaveAt > CONFIG.autosaveSeconds * 1000) void this.saveNow();

    requestAnimationFrame(this.frame);
  };

  private updateHud(): void {
    const req = this.jump.current;
    if (req && (this.jump.phase === "charging" || this.jump.phase === "tunnel")) {
      this.ui.setJumpOverlay({
        phase: this.jump.phase,
        kind: req.kind,
        label: req.label,
        remaining: this.jump.remaining,
        progress: this.jump.progress,
      });
    }
    const t = this.ship.flightTarget;
    if (t) {
      const eta = this.ship.etaSeconds();
      const dist = Math.round(this.ship.remainingDistance());
      this.ui.setStatus(`Cruising to ${t.label} · ${dist} u · ETA ${formatSeconds(eta)}`);
      if (this.target && Math.floor(performance.now() / 500) % 2 === 0) this.refreshTargetButton();
    } else {
      this.ui.setStatus(`Holding position · ${this.ship.data.name}`);
    }
  }
}

function makeLabelRenderer(id: string): CSS2DRenderer {
  const r = new CSS2DRenderer();
  r.setSize(window.innerWidth, window.innerHeight);
  r.domElement.id = id;
  r.domElement.className = "labels";
  const ui = document.getElementById("ui");
  document.body.insertBefore(r.domElement, ui);
  return r;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function formatSeconds(s: number): string {
  if (!isFinite(s)) return "--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`;
}
