import { generateGalaxy } from "./galaxy/generator.ts";
import { createBackend } from "./save/backend.ts";
import { UI } from "./ui/hud.ts";
import { Game } from "./game/Game.ts";

async function boot(): Promise<void> {
  const canvas = document.getElementById("view") as HTMLCanvasElement;
  const root = document.getElementById("ui") as HTMLElement;
  const ui = new UI(root);

  const backend = await createBackend();
  console.info(`[andromeadow] backend: ${backend.kind}`);

  let user = await backend.currentUser();
  if (!user) user = await ui.showLogin(backend);

  const galaxy = generateGalaxy();
  const save = await backend.loadSave(user.id);
  console.info(`[andromeadow] ${galaxy.systems.length} systems; save: ${save ? save.systemId : "new player"}`);

  const game = new Game(canvas, ui, galaxy, backend, user, save);
  game.start();
  // Debug handle: `andromeadow.snapshot()` in the browser console shows the live save state.
  (window as unknown as { andromeadow: Game }).andromeadow = game;
}

boot().catch((err) => {
  console.error(err);
  const root = document.getElementById("ui");
  if (root) root.innerHTML = `<div class="panel" style="left:16px;top:16px;color:var(--danger)">Failed to start: ${String(err)}</div>`;
});
