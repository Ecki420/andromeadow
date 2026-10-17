/**
 * Input layer for point-and-click: turns a left click into a pick intent and the
 * wheel into zoom. Nothing else. Steering lives in ManualControls; the ship never
 * sees a mouse.
 */
export interface PointerIntents {
  /** A click (not a drag). ndc = normalised device coords, -1..1. */
  onPick(ndcX: number, ndcY: number): void;
  onZoom(delta: number): void;
}

export class PointAndClick {
  enabled = true;
  private down: { x: number; y: number; moved: number } | null = null;
  private last = { x: 0, y: 0 };

  constructor(
    private readonly el: HTMLElement,
    private readonly intents: PointerIntents,
  ) {
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerup", this.onUp);
    el.addEventListener("pointerleave", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled || e.button !== 0) return;
    this.down = { x: e.clientX, y: e.clientY, moved: 0 };
    this.last = { x: e.clientX, y: e.clientY };
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.down) return;
    this.down.moved += Math.abs(e.clientX - this.last.x) + Math.abs(e.clientY - this.last.y);
    this.last = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.down) return;
    const wasClick = this.down.moved < 6;
    this.down = null;
    if (!this.enabled || !wasClick || e.type === "pointerleave") return;
    const rect = this.el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.intents.onPick(x, y);
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    this.intents.onZoom(e.deltaY);
  };
}
