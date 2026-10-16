import type { Backend, UserInfo } from "../save/types.ts";

export interface MapSelection {
  name: string;
  distance: number;
  reachable: boolean;
  isCurrent: boolean;
}

export interface JumpOverlay {
  phase: "charging" | "tunnel";
  kind: "star" | "system";
  label: string;
  remaining: number;
  progress: number;
}

/** All DOM. The game talks to this through plain setters and callbacks. */
export class UI {
  onToggleMap: (() => void) | null = null;
  onJumpToTarget: (() => void) | null = null;
  onMapJump: (() => void) | null = null;
  onLogout: (() => void) | null = null;

  private readonly root: HTMLElement;
  private readonly refs: Record<string, HTMLElement> = {};

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div id="login" class="panel hidden">
        <h1>Andromeadow</h1>
        <div class="muted" data-ref="loginNote"></div>
        <form data-ref="loginForm">
          <input type="email" name="email" placeholder="email" autocomplete="username" required />
          <input type="password" name="password" placeholder="password" autocomplete="current-password" required minlength="6" />
          <div class="error" data-ref="loginError"></div>
          <div class="row">
            <button class="btn primary" type="submit" data-ref="signIn">Sign in</button>
            <button class="btn" type="button" data-ref="signUp">Create account</button>
          </div>
        </form>
      </div>

      <div id="hud-system" class="panel hidden" data-ref="hudSystem">
        <h2>Current system</h2>
        <div class="mono" data-ref="systemName" style="font-size:16px;color:var(--gold)"></div>
        <div class="muted mono" data-ref="systemBodies"></div>
      </div>

      <div id="hud-account" class="panel hidden row" data-ref="hudAccount">
        <span class="muted mono" data-ref="email"></span>
        <button class="btn ghost" data-ref="logout">Log out</button>
      </div>

      <div id="hud-flight" class="panel hidden" data-ref="hudFlight">
        <h2>Flight</h2>
        <div class="status" data-ref="status"></div>
        <div class="row">
          <button class="btn primary" data-ref="jumpTarget">Jump to target</button>
          <button class="btn" data-ref="toggleMap">Galaxy map</button>
        </div>
      </div>

      <div id="hud-help" class="panel hidden" data-ref="hudHelp">
        click a body or its label: fly there<br/>
        drag: look around &middot; wheel: zoom<br/>
        galaxy map: jump between stars
      </div>

      <div id="map-panel" class="panel hidden" data-ref="mapPanel">
        <h1>Galaxy map</h1>
        <div class="muted">Gold: current star &middot; Cyan: within jump range</div>
        <div class="selection" data-ref="mapSelection">Select a star</div>
        <div class="row" style="justify-content:center">
          <button class="btn primary" data-ref="mapJump" disabled>Jump</button>
          <button class="btn" data-ref="mapClose">Close map</button>
        </div>
      </div>

      <div id="jump-overlay" class="hidden" data-ref="jumpOverlay">
        <div class="big" data-ref="jumpBig"></div>
        <div class="sub" data-ref="jumpSub"></div>
        <div class="bar"><div data-ref="jumpBar"></div></div>
      </div>

      <div id="flash" data-ref="flash"></div>
    `;
    root.querySelectorAll<HTMLElement>("[data-ref]").forEach((el) => {
      this.refs[el.dataset.ref as string] = el;
    });

    this.ref("toggleMap").addEventListener("click", () => this.onToggleMap?.());
    this.ref("mapClose").addEventListener("click", () => this.onToggleMap?.());
    this.ref("jumpTarget").addEventListener("click", () => this.onJumpToTarget?.());
    this.ref("mapJump").addEventListener("click", () => this.onMapJump?.());
    this.ref("logout").addEventListener("click", () => this.onLogout?.());
  }

  private ref(name: string): HTMLElement {
    const el = this.refs[name];
    if (!el) throw new Error(`UI ref missing: ${name}`);
    return el;
  }

  /** Shows the login panel and resolves once the backend accepts a sign-in or sign-up. */
  showLogin(backend: Backend): Promise<UserInfo> {
    const panel = this.root.querySelector<HTMLElement>("#login") as HTMLElement;
    const form = this.ref("loginForm") as HTMLFormElement;
    const error = this.ref("loginError");
    this.ref("loginNote").textContent =
      backend.kind === "local"
        ? "Local dev save: accounts live in this browser only."
        : "Sign in with your Andromeadow account.";
    panel.classList.remove("hidden");

    return new Promise((resolve) => {
      const submit = async (mode: "in" | "up") => {
        const data = new FormData(form);
        const email = String(data.get("email") ?? "");
        const password = String(data.get("password") ?? "");
        error.textContent = "";
        if (!form.reportValidity()) return;
        try {
          const user = mode === "in" ? await backend.signIn(email, password) : await backend.signUp(email, password);
          panel.classList.add("hidden");
          resolve(user);
        } catch (err) {
          error.textContent = err instanceof Error ? err.message : String(err);
        }
      };
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        void submit("in");
      });
      this.ref("signUp").addEventListener("click", () => void submit("up"));
    });
  }

  showHud(email: string): void {
    this.ref("email").textContent = email;
    ["hudSystem", "hudAccount", "hudFlight", "hudHelp"].forEach((r) => this.ref(r).classList.remove("hidden"));
  }

  /** Lists the system's bodies as targets; clicking one is the same as clicking it in the scene. */
  setSystem(name: string, bodies: { kind: string; name: string; select: () => void }[]): void {
    this.ref("systemName").textContent = name;
    const list = this.ref("systemBodies");
    list.innerHTML = "";
    bodies.forEach((b) => {
      const btn = document.createElement("button");
      btn.className = "body-link";
      btn.textContent = `${b.kind}: ${b.name}`;
      btn.addEventListener("click", b.select);
      list.appendChild(btn);
    });
  }

  setStatus(text: string): void {
    this.ref("status").textContent = text;
  }

  setJumpTargetEnabled(enabled: boolean, label?: string): void {
    const btn = this.ref("jumpTarget") as HTMLButtonElement;
    btn.disabled = !enabled;
    btn.textContent = label ? `Jump to ${label}` : "Jump to target";
  }

  setMapOpen(open: boolean): void {
    this.ref("mapPanel").classList.toggle("hidden", !open);
    this.ref("hudFlight").classList.toggle("hidden", open);
    this.ref("hudHelp").classList.toggle("hidden", open);
    (this.ref("toggleMap") as HTMLButtonElement).textContent = open ? "Close map" : "Galaxy map";
  }

  setMapSelection(sel: MapSelection | null): void {
    const btn = this.ref("mapJump") as HTMLButtonElement;
    const text = this.ref("mapSelection");
    if (!sel) {
      text.textContent = "Select a star";
      btn.disabled = true;
      return;
    }
    const d = sel.distance.toFixed(1);
    if (sel.isCurrent) text.textContent = `${sel.name} — you are here`;
    else if (sel.reachable) text.textContent = `${sel.name} — ${d} ly — in range`;
    else text.textContent = `${sel.name} — ${d} ly — out of range`;
    btn.disabled = !sel.reachable || sel.isCurrent;
  }

  setJumpOverlay(o: JumpOverlay | null): void {
    const overlay = this.ref("jumpOverlay");
    if (!o) {
      overlay.classList.add("hidden");
      return;
    }
    overlay.classList.remove("hidden");
    const big = this.ref("jumpBig");
    const sub = this.ref("jumpSub");
    const bar = this.ref("jumpBar");
    if (o.phase === "charging") {
      big.textContent = o.kind === "star" ? "Charging jump drive" : "Aligning";
      sub.textContent = `${o.label} · ${o.remaining.toFixed(1)}s`;
    } else {
      big.textContent = o.kind === "star" ? "Hyperspace" : "Short jump";
      sub.textContent = `Destination: ${o.label}`;
    }
    bar.style.width = `${Math.round(o.progress * 100)}%`;
  }

  flash(): void {
    const el = this.ref("flash");
    el.classList.add("on");
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("on")));
  }
}
