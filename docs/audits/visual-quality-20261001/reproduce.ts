/** Read-only audit of the baseline scene; no GPU or external communication. */
import { writeFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { createGameScene } from "../../../client/src/game/scene";
import { attackTimingFor } from "../../../client/src/game/rules";

async function main() {
  let realNow = 0;
  const originalNow = Object.getOwnPropertyDescriptor(performance, "now");
  Object.defineProperty(performance, "now", {
    configurable: true,
    value: () => realNow,
  });
  const bus = new EventTarget();
  Object.assign(bus, { AudioContext: undefined, setTimeout, clearTimeout });
  Object.assign(globalThis, { window: bus });
  const values = new Map<string, string>([["yamabushi-effects", "minimal"]]);
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
  const engine = new NullEngine({
    renderWidth: 402,
    renderHeight: 874,
    textureSize: 512,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
  const handle = await createGameScene(engine, "lite");
  const scene = handle.scene;
  const event = (name: string, detail = {}) =>
    bus.dispatchEvent(new CustomEvent(name, { detail }));
  const advance = (ms: number) => {
    const n = Math.ceil(ms / (1000 / 60));
    for (let i = 0; i < n; i++) {
      realNow += ms / n;
      scene.onBeforeRenderObservable.notifyObservers(scene);
    }
  };
  const start = () => {
    event("yamabushi-start", {
      mode: "ten",
      difficulty: "apprentice",
      seed: 123,
    });
    advance(1000);
  };
  const mesh = (name: string) => {
    const m = scene.getMeshByName(name);
    if (!m) throw new Error(`Missing baseline mesh ${name}`);
    m.computeWorldMatrix(true);
    return m;
  };
  const box = (name: string) => {
    const b = mesh(name).getBoundingInfo().boundingBox;
    return { min: b.minimumWorld.asArray(), max: b.maximumWorld.asArray() };
  };
  const floorTopAt = (x: number, z: number) => {
    let top = 0;
    for (let i = 0; i < 8; i++) {
      const b = box(`stone_step_${i}`);
      if (x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2])
        top = Math.max(top, b.max[1]);
    }
    return top;
  };
  start();
  const terrain = [
    "attack_warning_line",
    "enemy_attack_area",
    "player_foot_attack_zone_-1",
    "player_foot_attack_zone_0",
    "player_foot_attack_zone_1",
    "left_zori",
    "right_zori",
  ].map(name => {
    const m = mesh(name),
      b = box(name),
      center = m.getAbsolutePosition();
    const floorTop = floorTopAt(center.x, center.z);
    return {
      name,
      bounds: b,
      floorTopAtCenter: floorTop,
      topBelowFloor: b.max[1] < floorTop,
      minBelowFloorBy: Math.max(0, floorTop - b.min[1]),
    };
  });
  const keyboard = [];
  for (const key of ["a", "ArrowLeft", "Shift"]) {
    start();
    if (key !== "Shift") {
      event("yamabushi-dodge", { direction: 1 });
      advance(400);
    }
    const beforeX = scene.getTransformNodeByName("yamabushi_procedural_root")!
      .position.x;
    const e = new Event("keydown");
    Object.assign(e, { key, repeat: false });
    bus.dispatchEvent(e);
    advance(400);
    keyboard.push({
      key,
      beforeX,
      afterX: scene.getTransformNodeByName("yamabushi_procedural_root")!
        .position.x,
    });
  }
  start();
  for (let i = 0; i < 700 && handle.getState().enemyPhase !== "攻撃"; i++)
    advance(1000 / 60);
  advance(220);
  const spear = mesh("wraith_spear_l"),
    tip = mesh("wraith_spear_tip_l");
  const localShaftEnd = spear.position.z - (1.15 * spear.scaling.z) / 2;
  const spearAlignment = {
    extensionScale: spear.scaling.z,
    shaftLocalFrontZ: localShaftEnd,
    tipLocalCenterZ: tip.position.z,
    difference: Math.abs(localShaftEnd - tip.position.z),
  };

  start();
  while (handle.getState().enemyPhase !== "予備" && realNow < 60000)
    advance(1000 / 60);
  advance(620 * 1.35 + 230 - 150);
  event("yamabushi-guard");
  for (let i = 0; i < 80 && !handle.getState().counterReady; i++)
    advance(1000 / 60);
  for (let i = 0; i < 40 && handle.getState().attackPhase === "待機"; i++) {
    event("yamabushi-slash");
    if (handle.getState().attackPhase === "待機") advance(1000 / 60);
  }
  const hpBefore = handle.getState().enemyHp;
  advance(80);
  const hp80 = handle.getState().enemyHp;
  advance(20);
  const counterSample = {
    hpBefore,
    hp80,
    hp100: handle.getState().enemyHp,
    bladeLocalZAngleAt100Ms: mesh("katana").rotation.z,
    normalizedHitProgress:
      attackTimingFor("counter").startup / attackTimingFor("counter").total,
    drawPoseEndsAtProgress: 0.24,
  };
  const enemyMaterial = [
    "wraith_body_shadow",
    "eye_l",
    "beast_fang_l",
    "human_crest",
    "bird_wing_l",
    "monument_base",
  ].map(name => ({ name, material: mesh(name).material?.name }));
  const duplicateTorii = {
    crossbeams: scene.meshes.filter(m => m.name === "torii_crossbeam").length,
    upperbeams: scene.meshes.filter(m => m.name === "torii_upperbeam").length,
  };
  const playerRoot = scene.getTransformNodeByName("yamabushi_procedural_root")!;
  const playerFacing = Vector3.TransformNormal(
    new Vector3(0, 0, -1),
    playerRoot.computeWorldMatrix(true)
  ).normalize();
  const towardEnemy = scene
    .getMeshByName("mountain_wraith")!
    .position.subtract(playerRoot.position)
    .normalize();
  const facing = {
    frontBasedOnEyeCoordinates: "local -Z",
    facingVector: playerFacing.asArray(),
    towardEnemy: towardEnemy.asArray(),
    dot: Vector3.Dot(playerFacing, towardEnemy),
    note: "Geometry direction only; perceived orientation needs a rendered view.",
  };
  const evidence = {
    baselineCommit: "14f17c89da689aa71e54813ee49c362347b691a2",
    method:
      "Babylon.js 9.20.1 NullEngine; bounds and live scene events, no rendered-pixel assertions",
    terrain,
    keyboard,
    spearAlignment,
    counterSample,
    enemyMaterial,
    duplicateTorii,
    facing,
  };
  const output = new URL("./geometry-evidence.json", import.meta.url);
  writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
  handle.dispose();
  engine.dispose();
  if (originalNow) Object.defineProperty(performance, "now", originalNow);
  else delete (performance as any).now;
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
