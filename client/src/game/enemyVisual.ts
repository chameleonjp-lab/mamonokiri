import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { COMBAT_FLOOR_Y } from "./arena";

export const ENEMY_VISUAL_NAMES = [
  "影面",
  "角岩",
  "鳴壺",
  "逆鉾",
  "霧猿",
  "鉄輪",
  "骨灯",
  "牙嶺",
  "鎧熊",
  "沼喰",
  "百眼",
  "鬼将",
  "白面",
  "天狗鴉",
  "鶴骸",
  "石門王",
  "巨仏",
] as const;
export type EnemyVisualSample = {
  time: number;
  lane: number;
  windup: number;
  strike: number;
  recover: number;
  attacking: boolean;
  followUp: boolean;
  phase: 1 | 2;
  staggered: boolean;
  defeated: boolean;
  defeatProgress?: number;
};

/** Display-only rig. AttackPlan and the combat clock remain the sole authority. */
export function createEnemyVisual(
  scene: Scene,
  root: Mesh,
  materials: Record<string, StandardMaterial>
) {
  const rig = new TransformNode("enemy_articulated_display", scene);
  rig.parent = root;
  const torso = new TransformNode("enemy_torso_joint", scene);
  torso.parent = rig;
  const head = new TransformNode("enemy_head_joint", scene);
  head.parent = torso;
  const arms = [-1, 1].map(side => {
    const shoulder = new TransformNode(`enemy_shoulder_${side}`, scene);
    shoulder.parent = torso;
    const elbow = new TransformNode(`enemy_elbow_${side}`, scene);
    elbow.parent = shoulder;
    return { side, shoulder, elbow };
  });
  let name = "影面";
  let meshes: Mesh[] = [];
  let supports: Mesh[] = [];
  function block(
    id: string,
    size: number[],
    pos: number[],
    parent: TransformNode,
    material: string
  ) {
    const m = MeshBuilder.CreateBox(
      id,
      { width: size[0], height: size[1], depth: size[2] },
      scene
    );
    m.parent = parent;
    m.position.set(pos[0], pos[1], pos[2]);
    m.material = materials[material];
    meshes.push(m);
    return m;
  }
  function cone(
    id: string,
    width: number,
    height: number,
    pos: number[],
    parent: TransformNode,
    material: string
  ) {
    const m = MeshBuilder.CreateCylinder(
      id,
      { height, diameterTop: 0.03, diameterBottom: width, tessellation: 6 },
      scene
    );
    m.parent = parent;
    m.position.set(pos[0], pos[1], pos[2]);
    m.material = materials[material];
    meshes.push(m);
    return m;
  }
  function ring(
    id: string,
    diameter: number,
    pos: number[],
    parent: TransformNode,
    material: string
  ) {
    const m = MeshBuilder.CreateTorus(
      id,
      { diameter, thickness: 0.09, tessellation: 12 },
      scene
    );
    m.parent = parent;
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.x = Math.PI / 2;
    m.material = materials[material];
    meshes.push(m);
    return m;
  }
  function configure(nextName: string) {
    name = nextName;
    meshes.forEach(mesh => mesh.dispose());
    meshes = [];
    supports = [];
    torso.position.set(0, 0.7, 0);
    head.position.set(0, 0.65, -0.12);
    const beast = name === "牙嶺" || name === "鎧熊";
    const bird = name === "天狗鴉" || name === "鶴骸";
    const monument = name === "石門王" || name === "巨仏";
    const slender = name === "白面" || name === "鶴骸";
    const width =
      name === "沼喰" ? 1.65 : name === "鎧熊" ? 1.35 : slender ? 0.55 : 0.95;
    block(
      `${name}_torso`,
      [width, beast ? 0.65 : 0.95, beast ? 1.35 : 0.65],
      [0, 0.3, 0],
      torso,
      beast ? "indigo" : "stone"
    );
    block(
      `${name}_face`,
      [slender ? 0.28 : 0.6, slender ? 0.75 : 0.42, 0.25],
      [0, 0.1, -0.25],
      head,
      name === "鬼将" ? "vermilion" : "cream"
    );
    for (const side of [-1, 1]) {
      block(
        `${name}_eye_${side}`,
        [0.08, 0.045, 0.045],
        [side * 0.13, 0.12, -0.4],
        head,
        "amber"
      );
      const foot = block(
        `${name}_support_${side}`,
        [beast ? 0.3 : 0.22, bird ? 0.6 : 0.4, beast ? 0.48 : 0.32],
        [side * width * 0.35, 0, 0],
        rig,
        monument ? "stone" : "iron"
      );
      supports.push(foot);
      if (beast)
        supports.push(
          block(
            `${name}_hind_${side}`,
            [0.28, 0.4, 0.38],
            [side * width * 0.35, 0, 0.62],
            rig,
            "iron"
          )
        );
    }
    arms.forEach(({ side, shoulder, elbow }) => {
      shoulder.position.set(side * width * 0.55, 0.65, 0);
      elbow.position.set(0, -0.42, 0);
      block(
        `${name}_upper_arm_${side}`,
        [beast ? 0.32 : 0.18, 0.42, 0.24],
        [0, -0.21, 0],
        shoulder,
        name === "骨灯" ? "cream" : "stone"
      );
      block(
        `${name}_forearm_${side}`,
        [bird ? 0.7 : 0.2, 0.5, 0.2],
        [0, -0.25, 0],
        elbow,
        bird ? "cream" : "iron"
      );
      if (name === "鉄輪")
        ring(
          `iron_attack_ring_${side}`,
          side < 0 ? 0.9 : 0.65,
          [0, -0.55, -0.12],
          elbow,
          "iron"
        );
      if (name === "逆鉾" || name === "鬼将" || name === "白面")
        block(
          `${name}_weapon_${side}`,
          [0.085, 1.25, 0.09],
          [0, -0.15, -0.2],
          elbow,
          "steel"
        );
      if (name === "巨仏")
        block(
          `buddha_palm_${side}`,
          [0.55, 0.65, 0.17],
          [0, -0.55, -0.25],
          elbow,
          "gold"
        );
    });
    if (name === "影面")
      block("split_mask", [0.07, 0.52, 0.08], [-0.08, 0.1, -0.42], head, "ink");
    if (name === "角岩")
      cone("rock_right_horn", 0.42, 0.9, [0.37, 0.53, 0], head, "stone");
    if (name === "鳴壺") {
      ring("vessel_mouth", 0.65, [0, 0.3, -0.4], head, "wood");
      block("vessel_neck", [0.4, 0.5, 0.35], [0, 0.1, 0], head, "stone");
    }
    if (name === "霧猿") {
      block(
        "ape_tail",
        [0.13, 0.9, 0.16],
        [0.15, 0.3, 0.45],
        torso,
        "indigo"
      ).rotation.x = 0.65;
      arms.forEach(a => (a.elbow.scaling.y = 1.3));
    } else arms.forEach(a => a.elbow.scaling.setAll(1));
    if (name === "骨灯") {
      block(
        "bone_lantern",
        [0.35, 0.65, 0.35],
        [0, 0.35, -0.37],
        torso,
        "amber"
      );
      for (const x of [-0.3, 0.3])
        block("bone_frame", [0.09, 1.1, 0.1], [x, 0.4, -0.42], torso, "cream");
    }
    if (beast) {
      head.position.y = 0.35;
      block("beast_jaw", [0.65, 0.23, 0.6], [0, -0.2, -0.35], head, "skin");
      for (const x of [-0.25, 0.25])
        cone(
          "beast_fang",
          0.15,
          0.55,
          [x, -0.25, -0.65],
          head,
          "cream"
        ).rotation.z = Math.PI;
    }
    if (name === "鎧熊")
      for (const x of [-0.62, 0.62])
        block("bear_armour", [0.45, 0.55, 0.65], [x, 0.7, 0], torso, "iron");
    if (name === "沼喰") {
      torso.scaling.set(1, 0.75, 1.2);
      block("swamp_mouth", [1.15, 0.2, 0.18], [0, -0.15, -0.35], head, "ink");
    } else torso.scaling.setAll(1);
    if (name === "百眼")
      for (let i = 0; i < 7; i++) {
        const a = (i * Math.PI * 2) / 7;
        block(
          "many_eye",
          [0.16, 0.12, 0.09],
          [Math.cos(a) * 0.55, Math.sin(a) * 0.5 + 0.2, -0.4],
          head,
          "amber"
        );
      }
    if (name === "鬼将") {
      cone("general_crest", 0.3, 0.65, [0, 0.6, 0], head, "gold");
      block("general_armour", [1.1, 0.22, 0.8], [0, 0.75, 0], torso, "iron");
    }
    if (bird) {
      cone(
        "bird_beak",
        0.2,
        slender ? 0.6 : 0.4,
        [0, 0, -0.55],
        head,
        "gold"
      ).rotation.x = -Math.PI / 2;
      if (slender)
        block("crane_neck", [0.18, 0.8, 0.18], [0, -0.2, 0], head, "cream");
    }
    if (name === "石門王") {
      for (const x of [-0.75, 0.75])
        block("gate_support", [0.3, 1.9, 0.4], [x, 0.6, 0], rig, "stone");
      block("gate_attack_beam", [2, 0.28, 0.55], [0, 0.5, 0], head, "stone");
      ring("gate_glyph", 0.75, [0, 0, -0.4], head, "gold");
    }
    if (name === "巨仏") {
      block("buddha_seat", [1.75, 0.45, 0.85], [0, 0, 0], rig, "stone");
      cone("buddha_crown", 0.6, 0.35, [0, 0.65, 0], head, "gold");
    }
    supports.push(
      ...meshes.filter(
        mesh => mesh.name === "gate_support" || mesh.name === "buddha_seat"
      )
    );
    meshes.forEach(m => {
      m.metadata = { enemyVisual: name };
    });
  }
  function apply(sample: EnemyVisualSample) {
    meshes.forEach(mesh => {
      mesh.visibility =
        1 - Math.min(1, Math.max(0, sample.defeatProgress ?? 0));
    });
    const monument = name === "石門王" || name === "巨仏";
    const bird = name === "天狗鴉" || name === "鶴骸";
    const side = sample.lane || 1;
    const strength = sample.phase === 2 ? 1.15 : 1;
    const load = sample.attacking
      ? sample.windup * (1 - sample.strike)
      : sample.followUp
        ? 0.7
        : 0;
    const swing = Math.sin(sample.strike * Math.PI) * (1 - sample.recover);
    rig.rotation.set(0, 0, 0);
    rig.position.set(
      0,
      0,
      monument ? (5.2 - root.position.z) / Math.max(0.01, root.scaling.z) : 0
    );
    torso.rotation.set(
      monument ? 0 : load * 0.12 - swing * 0.2,
      monument ? 0 : side * (load * -0.16 + swing * 0.22),
      monument ? 0 : side * load * -0.06
    );
    head.rotation.set(load * -0.12 + swing * 0.25, side * load * 0.18, 0);
    arms.forEach(({ side: armSide, shoulder, elbow }) => {
      const selected = sample.lane === 0 || sample.lane === armSide;
      const reserve = sample.followUp && !selected ? 0.65 : 0;
      shoulder.rotation.set(
        -(selected ? load * 0.6 + swing * 0.9 : reserve),
        0,
        armSide * (bird ? 0.45 + (1 - load) * 0.6 : 0.1)
      );
      elbow.rotation.set(
        (selected ? load * 0.55 - swing * 0.65 : reserve) * strength,
        0,
        bird ? armSide * load * 0.4 : 0
      );
    });
    if (sample.staggered) torso.rotation.z += side * 0.18;
    if (sample.defeated) {
      torso.rotation.z += side * 0.55;
      head.rotation.x += 0.4;
    }
    if (!sample.attacking && !monument)
      torso.position.y = 0.7 + Math.sin(sample.time * 0.002) * 0.015;
    else torso.position.y = 0.7 - (monument ? 0 : load * 0.07);
    // Supports stay on the common floor; airborne birds preserve their scripted lift.
    root.computeWorldMatrix(true);
    const minY = Math.min(
      ...supports.map(mesh => {
        mesh.computeWorldMatrix(true);
        return mesh.getBoundingInfo().boundingBox.minimumWorld.y;
      })
    );
    const airborne = bird ? Math.max(0, root.position.y - 0.2) : 0;
    rig.position.y +=
      (COMBAT_FLOOR_Y + airborne - minY) / Math.max(0.01, root.scaling.y);
  }
  configure(name);
  return { configure, apply, rig };
}
