import { afterEach, describe, expect, it, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import {
  makeProceduralPlayer,
  type PlayerAttackKind,
} from "./proceduralCharacter";
import { ENEMY_VISUAL_NAMES, createEnemyVisual } from "./enemyVisual";
import { createChapterVisual } from "./chapterVisual";
import { attackTimingFor, isPlayerInDangerLine } from "./rules";
import { createSceneHarness } from "./testing/sceneHarness";
import { createFrameTelemetry } from "./frameTelemetry";

function fixture() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const materials = Object.fromEntries(
    [
      "indigo",
      "cream",
      "leather",
      "vermilion",
      "gaiter",
      "wood",
      "skin",
      "hair",
      "steel",
      "gold",
      "stone",
      "iron",
      "amber",
      "ink",
    ].map(name => [name, new StandardMaterial(name, scene)])
  );
  return {
    engine,
    scene,
    materials,
    dispose() {
      scene.dispose();
      engine.dispose();
    },
  };
}
function bottom(mesh: Mesh) {
  mesh.computeWorldMatrix(true);
  return mesh.getBoundingInfo().boundingBox.minimumWorld.y;
}
const sample = {
  time: 1000,
  lane: -1,
  windup: 0.7,
  strike: 0,
  recover: 0,
  attacking: true,
  followUp: false,
  phase: 1 as const,
  staggered: false,
  defeated: false,
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("live visual geometry", () => {
  it.each([
    "normal",
    "counter",
    "guard-break",
    "finisher",
  ] as PlayerAttackKind[])(
    "keeps %s soles and the hilt connected at every phase",
    kind => {
      const f = fixture();
      const player = makeProceduralPlayer(f.scene, f.materials);
      const timing = attackTimingFor(kind);
      for (const lane of [-0.9, 0, 0.9])
        for (const ms of [
          0,
          timing.startup - 1,
          timing.startup,
          timing.startup + timing.active / 2,
          timing.total - 1,
        ]) {
          player.root.position.x = lane;
          player.applyMotion({
            kind: "attack",
            attackKind: kind,
            progress: ms / timing.total,
            timeSeconds: ms / 1000,
            direction: 1,
          });
          const feet = ["left_zori", "right_zori"].map(
            name => f.scene.getMeshByName(name)!
          );
          expect(Math.min(...feet.map(bottom))).toBeCloseTo(0, 5);
          expect(feet.every(foot => bottom(foot) >= -0.00001)).toBe(true);
          player.blade.computeWorldMatrix(true);
          const base = Vector3.TransformCoordinates(
            new Vector3(0, -0.725, 0),
            player.blade.getWorldMatrix()
          );
          const guard = f.scene.getMeshByName("tsuba")!;
          guard.computeWorldMatrix(true);
          expect(
            Vector3.Distance(base, guard.getAbsolutePosition())
          ).toBeLessThan(0.03);
          const forward = Vector3.TransformNormal(
            new Vector3(0, 0, -1),
            player.root.getWorldMatrix()
          ).normalize();
          expect(Vector3.Dot(forward, new Vector3(0, 0, 1))).toBeGreaterThan(
            0.8
          );
          const right = f.scene.getTransformNodeByName("right_hand")!;
          const left = f.scene.getTransformNodeByName("left_hand")!;
          right.computeWorldMatrix(true);
          left.computeWorldMatrix(true);
          const grip = Vector3.TransformCoordinates(
            new Vector3(
              0.04 + Math.sin(player.blade.rotation.z) * 0.1,
              -Math.cos(player.blade.rotation.z) * 0.1,
              -0.02
            ),
            right.getWorldMatrix()
          );
          expect(
            Vector3.Distance(left.getAbsolutePosition(), grip)
          ).toBeLessThan(0.015);
          expect(player.root.position.x).toBe(lane);
        }
      f.dispose();
    }
  );
  it.each([
    "idle",
    "dodge",
    "guard",
    "parry",
    "hit",
    "defeat",
    "victory",
    "sheath",
  ] as const)("keeps support points above the floor for %s", kind => {
    const f = fixture();
    const player = makeProceduralPlayer(f.scene, f.materials);
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      player.applyMotion({
        kind,
        progress,
        timeSeconds: progress + 1,
        direction: -1,
      });
      const feet = ["left_zori", "right_zori"].map(
        name => f.scene.getMeshByName(name)!
      );
      expect(Math.min(...feet.map(bottom))).toBeCloseTo(0, 5);
      expect(feet.every(foot => bottom(foot) >= -0.00001)).toBe(true);
    }
    f.dispose();
  });
  it("detects a weapon reparented away from its grip", () => {
    const f = fixture();
    const player = makeProceduralPlayer(f.scene, f.materials);
    player.blade.parent = player.root;
    player.applyMotion({
      kind: "attack",
      attackKind: "counter",
      progress: 90 / 440,
      timeSeconds: 0.09,
    });
    player.blade.computeWorldMatrix(true);
    const bladeBase = Vector3.TransformCoordinates(
      new Vector3(0, -0.725, 0),
      player.blade.getWorldMatrix()
    );
    const guard = f.scene.getMeshByName("tsuba")!;
    guard.computeWorldMatrix(true);
    expect(
      Vector3.Distance(bladeBase, guard.getAbsolutePosition())
    ).toBeGreaterThan(0.1);
    f.dispose();
  });
  it("has already begun the counter's returning swing at 90ms", () => {
    const f = fixture();
    const p = makeProceduralPlayer(f.scene, f.materials);
    p.applyMotion({
      kind: "attack",
      attackKind: "counter",
      progress: 40 / 440,
      timeSeconds: 0.04,
    });
    const draw = p.blade.rotation.z;
    p.applyMotion({
      kind: "attack",
      attackKind: "counter",
      progress: 90 / 440,
      timeSeconds: 0.09,
    });
    expect(p.blade.rotation.z).toBeGreaterThan(draw + 0.5);
    f.dispose();
  });
  it.each(ENEMY_VISUAL_NAMES)(
    "articulates %s and keeps supports on the floor through both phases",
    name => {
      const f = fixture();
      const root = new Mesh("enemy", f.scene);
      root.position.y = 0.2;
      const rig = createEnemyVisual(f.scene, root, f.materials);
      rig.configure(name);
      for (const phase of [1, 2] as const)
        for (const lane of [-1, 0, 1])
          for (const strike of [0, 0.5, 1]) {
            rig.apply({ ...sample, lane, phase, strike });
            const supports = f.scene.meshes.filter(
              m =>
                m.name.includes("_support_") ||
                m.name.includes("_hind_") ||
                m.name === "gate_support" ||
                m.name === "buddha_seat"
            );
            expect(Math.min(...supports.map(bottom))).toBeCloseTo(0, 5);
            expect(
              f.scene.meshes.filter(m => m.metadata?.enemyVisual === name)
                .length
            ).toBeGreaterThan(8);
            expect(rig.rig.rotation.y).toBe(0);
          }
      f.dispose();
    }
  );
  it("replaces enemy parts without accumulating meshes or materials", () => {
    const f = fixture();
    const root = new Mesh("enemy", f.scene);
    const rig = createEnemyVisual(f.scene, root, f.materials);
    const materials = f.scene.materials.length;
    for (let i = 0; i < 5; i++)
      for (const name of ENEMY_VISUAL_NAMES) rig.configure(name);
    expect(f.scene.meshes.length).toBeLessThan(40);
    expect(f.scene.materials.length).toBe(materials);
    f.dispose();
  });
  it("selects exactly one static chapter and retains its geometry", () => {
    const f = fixture();
    const setChapter = createChapterVisual(f.scene, f.materials);
    const count = f.scene.meshes.length;
    for (let chapter = 1; chapter <= 5; chapter++) {
      setChapter(chapter);
      const enabled = f.scene.meshes.filter(m => m.isEnabled());
      expect(enabled.length).toBe(8);
      expect(enabled.every(m => m.metadata.chapter === chapter)).toBe(true);
    }
    expect(f.scene.meshes.length).toBe(count);
    f.dispose();
  });
});

describe("real scene input and effects", () => {
  it("accepts left and right keyboard routes, but ignores IME, editable fields, repeats and menus", async () => {
    const h = await createSceneHarness();
    const key = (value: string, properties = {}) => {
      const e = new Event("keydown", { cancelable: true });
      Object.assign(e, {
        key: value,
        repeat: false,
        isComposing: false,
        ...properties,
      });
      window.dispatchEvent(e);
    };
    key("a");
    expect(h.state().actionReceipt).toBeUndefined();
    h.start();
    key("d", { isComposing: true });
    key("d", { repeat: true });
    expect(h.state().actionReceipt).toBeUndefined();
    const e = new Event("keydown");
    Object.assign(e, { key: "d", repeat: false, isComposing: false });
    Object.defineProperty(e, "target", { value: { closest: () => true } });
    window.dispatchEvent(e);
    expect(h.state().actionReceipt).toBeUndefined();
    key("ArrowRight");
    expect(h.state().actionReceipt).toMatchObject({
      accepted: true,
      action: "dodge",
    });
    h.advance(400);
    key("ArrowLeft");
    h.advance(400);
    expect(
      h.handle.scene.getTransformNodeByName("yamabushi_procedural_root")!
        .position.x
    ).toBeCloseTo(-0.9);
    h.dispose();
  });
  it("keeps the extended spear tip's rear connected to its shaft", async () => {
    const h = await createSceneHarness();
    h.start();
    while (h.state().enemyPhase !== "予備") h.advance(1000 / 60);
    h.advance(620 * 1.35 + 100);
    for (const side of ["l", "r"]) {
      const shaft = h.handle.scene.getMeshByName(`wraith_spear_${side}`)!;
      const tip = h.handle.scene.getMeshByName(`wraith_spear_tip_${side}`)!;
      expect(tip.position.z + 0.12).toBeCloseTo(
        shaft.position.z - (1.15 * shaft.scaling.z) / 2,
        8
      );
    }
    const floor = h.handle.scene.getMeshByName("mountain_floor")!;
    floor.computeWorldMatrix(true);
    for (const name of ["attack_warning_line", "enemy_attack_area"]) {
      expect(bottom(h.handle.scene.getMeshByName(name)!)).toBeGreaterThan(
        floor.getBoundingInfo().boundingBox.maximumWorld.y
      );
    }
    h.dispose();
  });
  it("uses the same damage boundaries in floor information", async () => {
    const h = await createSceneHarness();
    h.start();
    while (h.state().enemyPhase !== "予備") h.advance(1000 / 60);
    h.advance(200);
    for (const lane of [-1, 0, 1]) {
      const m = h.handle.scene.getMeshByName(
        `player_foot_attack_zone_${lane}`
      )!;
      expect((m.material as StandardMaterial).alpha > 0.2).toBe(
        isPlayerInDangerLine(lane * 0.9, -1, false, 0.8)
      );
    }
    h.dispose();
  });
  it("expires contact effects on gameplay time and clears them on restart", async () => {
    const h = await createSceneHarness();
    h.start();
    h.dispatch("yamabushi-effects", { level: "full" });
    h.dispatch("yamabushi-slash");
    h.advance(380);
    expect(h.handle.scene.getMeshByName("enemy_hit_flash")).not.toBeNull();
    h.dispatch("yamabushi-pause", { paused: true });
    h.advance(1000);
    expect(h.handle.scene.getMeshByName("enemy_hit_flash")).not.toBeNull();
    h.dispatch("yamabushi-restart", {
      mode: "ten",
      difficulty: "apprentice",
      seed: 123,
    });
    expect(h.handle.scene.getMeshByName("enemy_hit_flash")).toBeNull();
    h.dispose();
  });
  it("bounds telemetry storage and keeps CPU and frame intervals separate", () => {
    const t = createFrameTelemetry(100);
    for (let i = 0; i < 10000; i++) t.record(i * 16.67, i * 16.67 + 2);
    expect(t.snapshot()).toMatchObject({
      samples: 10000,
      cpuMs: { retained: 100, p95: 2 },
      gpuMs: null,
    });
    expect(t.snapshot().frameIntervalMs.p95).toBeCloseTo(16.67, 5);
    t.reset();
    expect(t.snapshot().samples).toBe(0);
  });
});
