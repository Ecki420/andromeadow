import { test } from "node:test";
import assert from "node:assert/strict";
import { components, distance, generateGalaxy, isConnected, neighboursOf } from "./generator.ts";
import { CONFIG } from "../config.ts";

test("default galaxy has the configured star count and unique names", () => {
  const g = generateGalaxy();
  assert.equal(g.systems.length, CONFIG.starCount);
  const names = new Set(g.systems.map((s) => s.name));
  assert.equal(names.size, g.systems.length);
  assert.ok(g.systems[CONFIG.startingSystemIndex], "starting system exists");
});

test("generation is deterministic for the fixed seed", () => {
  const a = generateGalaxy();
  const b = generateGalaxy();
  assert.deepEqual(a, b);
});

test("connectivity rule: every star reachable from every other star", () => {
  const g = generateGalaxy();
  assert.ok(isConnected(g));
  assert.equal(components(g).length, 1);
  for (const s of g.systems) {
    assert.ok(neighboursOf(g, s.index).length >= 1, `${s.name} has at least one star in range`);
  }
});

test("connectivity is enforced even when the jump range is far too small", () => {
  const g = generateGalaxy({ seed: 42, starCount: 30, jumpRange: 8 });
  assert.ok(isConnected(g));
  for (const s of g.systems) {
    const nearest = Math.min(...g.systems.filter((o) => o !== s).map((o) => distance(o.position, s.position)));
    assert.ok(nearest <= g.jumpRange, `${s.name}: nearest star ${nearest.toFixed(1)} within range ${g.jumpRange}`);
  }
});

test("different seeds give different layouts", () => {
  const a = generateGalaxy({ seed: 1 });
  const b = generateGalaxy({ seed: 2 });
  assert.notDeepEqual(
    a.systems.map((s) => s.position),
    b.systems.map((s) => s.position),
  );
});
