import { COMBAT_FLOOR_Y } from "./arena";
import { attackTimingFor } from "./rules";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3, Quaternion, Matrix } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

/**
 * 画像・テクスチャ・外部モデルを使わず、Babylon.jsの基本形状と関節の
 * 親子関係だけで動かす山伏。ゲームの状態を姿勢へ変換する場所もここに
 * 集め、scene.tsが個々の関節を直接操作しなくて済むようにする。
 */
export type PlayerMotionKind =
  | "idle"
  | "spawn"
  | "dodge"
  | "attack"
  | "sheath"
  | "guard"
  | "parry"
  | "hit"
  | "defeat"
  | "victory";

export type PlayerAttackKind =
  | "normal"
  | "counter"
  | "guard-break"
  | "finisher";

export type PlayerMotionSample = {
  kind: PlayerMotionKind;
  progress: number;
  timeSeconds: number;
  direction?: -1 | 1;
  attackKind?: PlayerAttackKind;
  hitProgress?: number;
  hitDirection?: -1 | 1;
  guardBroken?: boolean;
  counterReady?: boolean;
  reducedMotion?: boolean;
};

export type ProceduralCharacterMaterials = Record<string, StandardMaterial>;

type Joint = TransformNode;

type Segment = {
  joint: Joint;
  mesh: Mesh;
};

export type ProceduralPlayer = {
  root: TransformNode;
  blade: Mesh;
  torso: Mesh;
  leftArm: Joint;
  rightArm: Joint;
  leftLeg: Joint;
  rightLeg: Joint;
  head: Mesh;
  hair: Mesh;
  neckCloth: Mesh;
  prayer: Mesh;
  sash: Mesh;
  scabbard: Mesh;
  applyMotion: (sample: PlayerMotionSample) => void;
};

const BASE_ROOT_Y = COMBAT_FLOOR_Y + 0.37;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smooth(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function easeOut(value: number): number {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * clamp01(amount);
}

function pivot(
  scene: Scene,
  name: string,
  parent: Joint,
  position: Vector3
): Joint {
  const node = new TransformNode(name, scene);
  node.parent = parent;
  node.position.copyFrom(position);
  return node;
}

function part(
  scene: Scene,
  name: string,
  size: Vector3,
  parent: Joint,
  position: Vector3,
  material: StandardMaterial
): Mesh {
  const mesh = MeshBuilder.CreateBox(
    name,
    { width: size.x, height: size.y, depth: size.z },
    scene
  );
  mesh.parent = parent;
  mesh.position.copyFrom(position);
  mesh.material = material;
  return mesh;
}

function segment(
  scene: Scene,
  name: string,
  parent: Joint,
  position: Vector3,
  length: number,
  width: number,
  depth: number,
  material: StandardMaterial,
  direction: 1 | -1
): Segment {
  const joint = pivot(scene, `${name}_joint`, parent, position);
  const mesh = part(
    scene,
    name,
    new Vector3(width, length, depth),
    joint,
    new Vector3(0, (length / 2) * direction, 0),
    material
  );
  return { joint, mesh };
}

function sphere(
  scene: Scene,
  name: string,
  diameter: number,
  parent: Joint,
  position: Vector3,
  material: StandardMaterial,
  segments = 10
): Mesh {
  const mesh = MeshBuilder.CreateSphere(name, { diameter, segments }, scene);
  mesh.parent = parent;
  mesh.position.copyFrom(position);
  mesh.material = material;
  return mesh;
}

function setRotation(node: Joint | Mesh, x = 0, y = 0, z = 0) {
  node.rotation.set(x, y, z);
}

function resetPose(player: BuiltPlayer) {
  const {
    root,
    pelvis,
    spine,
    headJoint,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftHand,
    rightHand,
    leftThigh,
    rightThigh,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    staffRoot,
    staff,
    blade,
    guard,
    scabbard,
    torso,
    head,
    hair,
    topknot,
    headband,
    neckCloth,
    prayer,
    sash,
    sashTail,
    leftFoot,
    rightFoot,
    leftSleeve,
    rightSleeve,
    leftForearm,
    rightForearm,
  } = player;

  root.position.y = BASE_ROOT_Y;
  root.scaling.setAll(1);
  setRotation(root);
  pelvis.position.set(0, 0.46, 0);
  setRotation(pelvis);
  spine.position.set(0, 0.52, 0);
  setRotation(spine);
  setRotation(headJoint);
  leftShoulder.rotationQuaternion = null;
  leftElbow.rotationQuaternion = null;
  leftShoulder.position.set(-0.49, 0.82, 0);
  rightShoulder.position.set(0.49, 0.82, 0);
  setRotation(leftShoulder);
  setRotation(rightShoulder);
  setRotation(leftElbow);
  setRotation(rightElbow);
  setRotation(leftHand);
  setRotation(rightHand);
  setRotation(leftThigh);
  setRotation(rightThigh);
  setRotation(leftKnee);
  setRotation(rightKnee);
  setRotation(leftAnkle);
  setRotation(rightAnkle);
  setRotation(staffRoot, 0, 0, -0.1);
  setRotation(staff, 0, 0, 0);
  setRotation(blade, 0, 0, -0.65);
  setRotation(guard, 0, Math.PI / 2, 0);
  setRotation(scabbard, 0, 0, -0.72);
  setRotation(torso);
  setRotation(head);
  setRotation(hair);
  setRotation(topknot);
  setRotation(headband);
  setRotation(neckCloth);
  setRotation(prayer);
  setRotation(sash);
  setRotation(sashTail);
  setRotation(leftFoot);
  setRotation(rightFoot);
  setRotation(leftSleeve);
  setRotation(rightSleeve);
  setRotation(leftForearm);
  setRotation(rightForearm);
  leftSleeve.scaling.setAll(1);
  rightSleeve.scaling.setAll(1);
  leftForearm.scaling.setAll(1);
  rightForearm.scaling.setAll(1);
  blade.position.set(0.04, 0.7, -0.04);
  guard.position.set(0.04, 0.11, -0.04);
  torso.position.y = 0.42;
  head.position.y = 0.22;
  hair.position.y = 0.45;
  neckCloth.position.y = 0.02;
  prayer.position.set(-0.19, 0.08, -0.28);
  sash.rotation.z = 0;
  sashTail.rotation.z = 0;
}

type BuiltPlayer = {
  root: Joint;
  pelvis: Joint;
  spine: Joint;
  headJoint: Joint;
  leftShoulder: Joint;
  rightShoulder: Joint;
  leftElbow: Joint;
  rightElbow: Joint;
  leftHand: Joint;
  rightHand: Joint;
  leftThigh: Joint;
  rightThigh: Joint;
  leftKnee: Joint;
  rightKnee: Joint;
  leftAnkle: Joint;
  rightAnkle: Joint;
  staffRoot: Joint;
  staff: Mesh;
  blade: Mesh;
  grip: Mesh;
  guard: Mesh;
  scabbard: Mesh;
  torso: Mesh;
  head: Mesh;
  hair: Mesh;
  topknot: Mesh;
  headband: Mesh;
  neckCloth: Mesh;
  prayer: Mesh;
  sash: Mesh;
  sashTail: Mesh;
  leftFoot: Mesh;
  rightFoot: Mesh;
  leftSleeve: Mesh;
  rightSleeve: Mesh;
  leftForearm: Mesh;
  rightForearm: Mesh;
};

function createBuiltPlayer(
  scene: Scene,
  materials: ProceduralCharacterMaterials
): BuiltPlayer {
  const root = new TransformNode("yamabushi_procedural_root", scene);
  root.position.set(0, BASE_ROOT_Y, 0);

  const pelvis = pivot(
    scene,
    "yamabushi_pelvis",
    root,
    new Vector3(0, 0.46, 0)
  );
  const spine = pivot(
    scene,
    "yamabushi_spine",
    pelvis,
    new Vector3(0, 0.52, 0)
  );
  const torso = part(
    scene,
    "samurai_kimono",
    new Vector3(0.82, 0.86, 0.52),
    spine,
    new Vector3(0, 0.42, 0),
    materials.indigo
  );
  const chestFold = part(
    scene,
    "kimono_chest_fold",
    new Vector3(0.16, 0.68, 0.56),
    spine,
    new Vector3(0.08, 0.49, -0.03),
    materials.cream
  );
  chestFold.rotation.z = -0.16;

  const sash = part(
    scene,
    "obi_sash",
    new Vector3(0.88, 0.16, 0.58),
    pelvis,
    new Vector3(0, 0.18, -0.01),
    materials.leather
  );
  const sashTail = part(
    scene,
    "obi_tail",
    new Vector3(0.14, 0.42, 0.1),
    pelvis,
    new Vector3(-0.35, -0.03, 0.18),
    materials.vermilion
  );
  sashTail.rotation.z = -0.12;
  part(
    scene,
    "obi_knot",
    new Vector3(0.22, 0.24, 0.12),
    pelvis,
    new Vector3(-0.38, 0.21, 0.24),
    materials.vermilion
  );
  const hakama = MeshBuilder.CreateCylinder(
    "hakama",
    { height: 0.58, diameterTop: 0.72, diameterBottom: 1.0, tessellation: 6 },
    scene
  );
  hakama.parent = pelvis;
  hakama.position.y = -0.1;
  hakama.material = materials.indigo;

  const leftThighSegment = segment(
    scene,
    "left_thigh",
    root,
    new Vector3(-0.2, 0.49, 0),
    0.36,
    0.2,
    0.26,
    materials.gaiter,
    -1
  );
  const rightThighSegment = segment(
    scene,
    "right_thigh",
    root,
    new Vector3(0.2, 0.49, 0),
    0.36,
    0.2,
    0.26,
    materials.gaiter,
    -1
  );
  const leftKnee = pivot(
    scene,
    "left_knee",
    leftThighSegment.joint,
    new Vector3(0, -0.36, 0)
  );
  const rightKnee = pivot(
    scene,
    "right_knee",
    rightThighSegment.joint,
    new Vector3(0, -0.36, 0)
  );
  const leftLower = segment(
    scene,
    "left_shin",
    leftKnee,
    new Vector3(0, 0, 0),
    0.42,
    0.17,
    0.23,
    materials.gaiter,
    -1
  );
  const rightLower = segment(
    scene,
    "right_shin",
    rightKnee,
    new Vector3(0, 0, 0),
    0.42,
    0.17,
    0.23,
    materials.gaiter,
    -1
  );
  const leftAnkle = pivot(
    scene,
    "left_ankle",
    leftLower.joint,
    new Vector3(0, -0.42, 0)
  );
  const rightAnkle = pivot(
    scene,
    "right_ankle",
    rightLower.joint,
    new Vector3(0, -0.42, 0)
  );
  const leftFoot = part(
    scene,
    "left_zori",
    new Vector3(0.3, 0.08, 0.48),
    leftAnkle,
    new Vector3(0, -0.04, -0.03),
    materials.wood
  );
  const rightFoot = part(
    scene,
    "right_zori",
    new Vector3(0.3, 0.08, 0.48),
    rightAnkle,
    new Vector3(0, -0.04, -0.03),
    materials.wood
  );

  const leftShoulder = pivot(
    scene,
    "left_shoulder",
    spine,
    new Vector3(-0.49, 0.82, 0)
  );
  const rightShoulder = pivot(
    scene,
    "right_shoulder",
    spine,
    new Vector3(0.49, 0.82, 0)
  );
  const leftUpper = segment(
    scene,
    "left_upper_sleeve",
    leftShoulder,
    new Vector3(0, 0, 0),
    0.4,
    0.22,
    0.25,
    materials.indigo,
    -1
  );
  const rightUpper = segment(
    scene,
    "right_upper_sleeve",
    rightShoulder,
    new Vector3(0, 0, 0),
    0.4,
    0.22,
    0.25,
    materials.indigo,
    -1
  );
  const leftElbow = pivot(
    scene,
    "left_elbow",
    leftUpper.joint,
    new Vector3(0, -0.4, 0)
  );
  const rightElbow = pivot(
    scene,
    "right_elbow",
    rightUpper.joint,
    new Vector3(0, -0.4, 0)
  );
  const leftForearm = segment(
    scene,
    "left_forearm",
    leftElbow,
    new Vector3(0, 0, 0),
    0.38,
    0.18,
    0.22,
    materials.indigo,
    -1
  );
  const rightForearm = segment(
    scene,
    "right_forearm",
    rightElbow,
    new Vector3(0, 0, 0),
    0.38,
    0.18,
    0.22,
    materials.indigo,
    -1
  );
  const leftHand = pivot(
    scene,
    "left_hand",
    leftForearm.joint,
    new Vector3(0, -0.38, 0)
  );
  const rightHand = pivot(
    scene,
    "right_hand",
    rightForearm.joint,
    new Vector3(0, -0.38, 0)
  );
  sphere(
    scene,
    "left_hand_shape",
    0.13,
    leftHand,
    new Vector3(0, 0, -0.02),
    materials.skin,
    8
  );
  sphere(
    scene,
    "right_hand_shape",
    0.13,
    rightHand,
    new Vector3(0, 0, -0.02),
    materials.skin,
    8
  );

  const headJoint = pivot(
    scene,
    "yamabushi_head_joint",
    spine,
    new Vector3(0, 0.86, 0)
  );
  const head = sphere(
    scene,
    "samurai_face",
    0.48,
    headJoint,
    new Vector3(0, 0.22, -0.02),
    materials.skin,
    12
  );
  const hat = MeshBuilder.CreateCylinder(
    "yamabushi_hat",
    { height: 0.22, diameterTop: 0.18, diameterBottom: 0.9, tessellation: 10 },
    scene
  );
  hat.parent = headJoint;
  hat.position.y = 0.61;
  hat.material = materials.wood;
  const hair = sphere(
    scene,
    "chonmage_hair",
    0.52,
    headJoint,
    new Vector3(0, 0.45, 0.02),
    materials.hair,
    8
  );
  hair.scaling.set(0.92, 0.58, 0.92);
  const topknot = MeshBuilder.CreateCylinder(
    "topknot",
    { height: 0.22, diameterTop: 0.14, diameterBottom: 0.22, tessellation: 8 },
    scene
  );
  topknot.parent = headJoint;
  topknot.position.set(0, 0.68, 0.02);
  topknot.material = materials.hair;
  const headband = part(
    scene,
    "hachimaki",
    new Vector3(0.5, 0.06, 0.5),
    headJoint,
    new Vector3(0, 0.32, -0.02),
    materials.vermilion
  );
  const neckCloth = part(
    scene,
    "neck_cloth",
    new Vector3(0.42, 0.16, 0.42),
    headJoint,
    new Vector3(0, 0.02, 0),
    materials.cream
  );
  const eyeL = sphere(
    scene,
    "samurai_eye_l",
    0.035,
    headJoint,
    new Vector3(-0.11, 0.25, -0.22),
    materials.hair,
    6
  );
  const eyeR = sphere(
    scene,
    "samurai_eye_r",
    0.035,
    headJoint,
    new Vector3(0.11, 0.25, -0.22),
    materials.hair,
    6
  );
  eyeL.scaling.set(1, 0.55, 0.5);
  eyeR.scaling.set(1, 0.55, 0.5);

  const staffRoot = pivot(
    scene,
    "staff_root",
    root,
    new Vector3(-0.72, 0.08, 0.05)
  );
  const staff = MeshBuilder.CreateCylinder(
    "staff",
    { height: 1.9, diameter: 0.07, tessellation: 8 },
    scene
  );
  staff.parent = staffRoot;
  staff.position.y = 0.95;
  staff.material = materials.wood;
  const scabbard = part(
    scene,
    "katana_scabbard",
    new Vector3(0.1, 1.18, 0.1),
    pelvis,
    new Vector3(0.28, 0.48, 0.22),
    materials.wood
  );
  scabbard.rotation.z = -0.72;
  const blade = part(
    scene,
    "katana",
    new Vector3(0.085, 1.45, 0.09),
    rightHand,
    new Vector3(0.04, 0.7, -0.04),
    materials.steel
  );
  blade.rotation.z = -0.65;
  const guard = MeshBuilder.CreateTorus(
    "tsuba",
    { diameter: 0.2, thickness: 0.035, tessellation: 16 },
    scene
  );
  guard.parent = rightHand;
  guard.position.set(0.04, 0.11, -0.04);
  guard.rotation.y = Math.PI / 2;
  guard.material = materials.gold;
  const handle = part(
    scene,
    "katana_grip",
    new Vector3(0.11, 0.25, 0.11),
    rightHand,
    new Vector3(0.04, 0, -0.02),
    materials.leather
  );
  handle.metadata = { weaponGrip: true };
  const prayer = MeshBuilder.CreateTorus(
    "prayer_beads",
    { diameter: 0.28, thickness: 0.025, tessellation: 12 },
    scene
  );
  prayer.parent = headJoint;
  prayer.position.set(-0.19, 0.08, -0.28);
  prayer.rotation.x = Math.PI / 2;
  prayer.material = materials.vermilion;

  return {
    root,
    pelvis,
    spine,
    headJoint,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftHand,
    rightHand,
    leftThigh: leftThighSegment.joint,
    rightThigh: rightThighSegment.joint,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    staffRoot,
    staff,
    blade,
    grip: handle,
    guard,
    scabbard,
    torso,
    head,
    hair,
    topknot,
    headband,
    neckCloth,
    prayer,
    sash,
    sashTail,
    leftFoot,
    rightFoot,
    leftSleeve: leftUpper.mesh,
    rightSleeve: rightUpper.mesh,
    leftForearm: leftForearm.mesh,
    rightForearm: rightForearm.mesh,
  };
}

function applyIdle(player: BuiltPlayer, time: number) {
  const breath = Math.sin(time * 2.2) * 0.018;
  const sway = Math.sin(time * 1.25) * 0.025;
  player.spine.position.y = 0.52 + breath;
  player.spine.rotation.y = sway;
  player.spine.rotation.z = Math.sin(time * 1.1) * 0.012;
  player.headJoint.rotation.y = -sway * 0.65;
  player.leftShoulder.rotation.z = 0.16;
  player.rightShoulder.rotation.z = -0.16;
  player.leftElbow.rotation.z = -0.04;
  player.rightElbow.rotation.z = 0.04;
  player.leftForearm.rotation.z = 0.02;
  player.rightForearm.rotation.z = -0.02;
  player.leftThigh.rotation.z = 0.02;
  player.rightThigh.rotation.z = -0.02;
  player.staffRoot.rotation.z = -0.1 + Math.sin(time * 1.4) * 0.01;
  player.sash.rotation.z = sway * 0.4;
  player.sashTail.rotation.z = -0.12 + sway * 0.7;
  player.prayer.rotation.y = Math.sin(time * 1.6) * 0.12;
  player.blade.rotation.z = -0.65;
}

function applyGuard(player: BuiltPlayer, time: number) {
  const breath = Math.sin(time * 4.4) * 0.012;
  player.root.scaling.y = 0.95 + breath;
  player.pelvis.position.y = 0.41;
  player.pelvis.rotation.z = -0.02;
  player.spine.position.y = 0.5;
  player.spine.rotation.y = 0.04;
  player.spine.rotation.z = 0.035;
  player.headJoint.rotation.y = -0.04;
  player.leftShoulder.rotation.z = 0.46;
  player.rightShoulder.rotation.z = -0.58;
  player.leftShoulder.rotation.y = 0.22;
  player.rightShoulder.rotation.y = -0.34;
  player.leftElbow.rotation.z = -0.44;
  player.rightElbow.rotation.z = 0.52;
  player.leftForearm.rotation.z = 0.1;
  player.rightForearm.rotation.z = -0.12;
  player.leftThigh.rotation.z = -0.045;
  player.rightThigh.rotation.z = 0.045;
  player.leftKnee.rotation.z = 0.08;
  player.rightKnee.rotation.z = -0.08;
  player.blade.rotation.z = -0.18;
  player.sash.rotation.z = -0.02;
  player.sashTail.rotation.z = -0.18;
}

function applyDodge(player: BuiltPlayer, progress: number, direction: -1 | 1) {
  const t = smooth(progress);
  const arc = Math.sin(clamp01(progress) * Math.PI);
  player.root.rotation.y = direction * (0.22 + arc * 0.18);
  player.root.rotation.z = -direction * arc * 0.12;
  player.root.scaling.y = 1 - arc * 0.12;
  player.pelvis.position.y = 0.46 - arc * 0.06;
  player.pelvis.rotation.z = -direction * arc * 0.08;
  player.spine.position.y = 0.52 - arc * 0.02;
  player.spine.rotation.z = -direction * arc * 0.11;
  player.spine.rotation.y = direction * arc * 0.12;
  player.headJoint.rotation.y = -direction * arc * 0.2;
  player.leftThigh.rotation.z = direction * arc * 0.2;
  player.rightThigh.rotation.z = -direction * arc * 0.15;
  player.leftKnee.rotation.z = -direction * arc * 0.18;
  player.rightKnee.rotation.z = direction * arc * 0.14;
  player.leftShoulder.rotation.z = 0.5 + direction * arc * 0.3;
  player.rightShoulder.rotation.z = -0.5 + direction * arc * 0.22;
  player.leftElbow.rotation.z = -0.34 - direction * arc * 0.15;
  player.rightElbow.rotation.z = 0.4 + direction * arc * 0.22;
  player.blade.rotation.z = -0.65 + direction * (0.5 + arc * 0.25);
  player.sash.rotation.z = direction * arc * 0.2;
  player.sashTail.rotation.z = -0.12 - direction * arc * 0.45;
  player.prayer.rotation.y = direction * arc * 0.7;
  player.staffRoot.rotation.z = -0.1 - direction * arc * 0.12;
  player.leftFoot.rotation.z = direction * t * 0.06;
  player.rightFoot.rotation.z = -direction * t * 0.06;
}

function applyAttack(
  player: BuiltPlayer,
  progress: number,
  kind: PlayerAttackKind,
  time: number,
  direction: -1 | 1
) {
  const p = clamp01(progress);
  const timing = attackTimingFor(kind);
  const elapsed = p * timing.total;
  const startupEnd = timing.startup / timing.total;
  const activeEnd = (timing.startup + timing.active) / timing.total;
  const draw =
    smooth(elapsed / (timing.startup * 0.45)) *
    (1 - easeOut((elapsed - timing.startup - timing.active) / timing.recovery));
  const swing = smooth(
    (elapsed - timing.startup * 0.45) /
      (timing.startup * 0.55 + timing.active * 0.5)
  );
  const recover = easeOut(
    (elapsed - timing.startup - timing.active) / timing.recovery
  );
  const isHeavy = kind === "guard-break";
  const isCounter = kind === "counter";
  const isFinisher = kind === "finisher";

  player.pelvis.position.y = 0.46 - draw * (isHeavy ? 0.06 : 0.025);
  player.pelvis.rotation.z = -direction * draw * (isHeavy ? 0.04 : 0.02);
  player.spine.position.y = 0.52 - draw * (isHeavy ? 0.03 : 0.01);
  player.spine.rotation.y = direction * (0.04 + swing * 0.14);
  player.spine.rotation.z =
    -direction * (0.02 + swing * (isHeavy ? 0.14 : 0.08));
  player.headJoint.rotation.y = direction * (0.03 + swing * 0.16);

  player.leftThigh.rotation.z = direction * (0.02 + swing * 0.11);
  player.rightThigh.rotation.z = -direction * (0.02 + swing * 0.18);
  player.leftKnee.rotation.z = -direction * swing * 0.12;
  player.rightKnee.rotation.z = direction * swing * 0.2;
  player.leftFoot.rotation.z = -direction * swing * 0.07;
  player.rightFoot.rotation.z = direction * swing * 0.08;

  const rightDraw = isHeavy ? -1.48 : isCounter ? -0.92 : -1.32;
  const rightActive = isHeavy ? 1.45 : isFinisher ? 1.55 : 1.24;
  const bladeAngle =
    p < startupEnd * 0.45
      ? lerp(-0.65, rightDraw, draw)
      : p < activeEnd
        ? lerp(rightDraw, rightActive, swing)
        : lerp(rightActive, -0.65, recover);
  player.blade.rotation.z = bladeAngle;
  player.guard.rotation.z = bladeAngle;
  player.scabbard.rotation.z = -0.72 + draw * 0.08 - recover * 0.04;

  player.rightShoulder.rotation.z = lerp(
    -0.16,
    isHeavy ? -0.92 : isCounter ? -0.72 : -0.84,
    draw
  );
  player.rightShoulder.rotation.y = lerp(0, isHeavy ? -0.28 : -0.18, draw);
  player.rightElbow.rotation.z = lerp(
    0.04,
    isHeavy ? 0.86 : isCounter ? 0.62 : 0.74,
    draw
  );
  player.rightForearm.rotation.z = lerp(
    -0.02,
    isHeavy ? -0.58 : isCounter ? -0.44 : -0.52,
    draw
  );
  player.rightHand.rotation.y = lerp(0, -0.12, draw);
  player.leftShoulder.rotation.z = lerp(
    0.16,
    isHeavy ? 0.58 : isCounter ? 0.42 : 0.48,
    draw
  );
  player.leftShoulder.rotation.y = lerp(0, 0.16, draw);
  player.leftElbow.rotation.z = lerp(-0.04, -0.42, draw);
  player.leftForearm.rotation.z = lerp(0.02, 0.28, draw);
  player.leftHand.rotation.y = lerp(0, 0.1, draw);

  const impactPulse = Math.sin(Math.min(1, p * 1.4) * Math.PI);
  player.root.rotation.y = direction * (0.03 + impactPulse * 0.08);
  player.root.rotation.z = -direction * impactPulse * 0.035;
  player.root.scaling.y = 1 - impactPulse * (isHeavy ? 0.04 : 0.02);
  player.sash.rotation.z = -direction * (0.06 + impactPulse * 0.16);
  player.sashTail.rotation.z = -0.12 - direction * (0.22 + impactPulse * 0.36);
  player.prayer.rotation.y = direction * (0.1 + impactPulse * 0.6);
  player.staffRoot.rotation.z = -0.1 + direction * impactPulse * 0.12;
  player.headJoint.rotation.z = -direction * impactPulse * 0.04;
  player.neckCloth.rotation.z = direction * impactPulse * 0.16;
  player.hair.rotation.z = direction * impactPulse * 0.12;

  if (p > activeEnd) {
    const breath = Math.sin(time * 9) * 0.012 * (1 - recover);
    player.spine.position.y -= breath;
  }
}

function applySheath(player: BuiltPlayer, progress: number, time: number) {
  const p = easeOut(progress);
  const settling = Math.sin(time * 8) * (1 - p);
  player.root.rotation.y = -0.025 * (1 - p);
  player.spine.rotation.z = -0.04 * (1 - p);
  player.rightShoulder.rotation.z = lerp(-0.48, -0.16, p);
  player.rightElbow.rotation.z = lerp(0.46, 0.04, p);
  player.rightForearm.rotation.z = lerp(-0.3, -0.02, p);
  player.leftShoulder.rotation.z = lerp(0.38, 0.16, p);
  player.leftElbow.rotation.z = lerp(-0.28, -0.04, p);
  player.leftForearm.rotation.z = lerp(0.16, 0.02, p);
  player.blade.rotation.z = lerp(-0.28, -0.65, p);
  player.guard.rotation.z = player.blade.rotation.z;
  player.sash.rotation.z = settling * 0.2;
  player.sashTail.rotation.z = -0.12 + settling * 0.4;
  player.prayer.rotation.y = settling * 0.65;
}

function applyParry(player: BuiltPlayer, progress: number, direction: -1 | 1) {
  const p = clamp01(progress);
  const impact = Math.sin(p * Math.PI);
  player.root.rotation.y = direction * (0.08 + impact * 0.12);
  player.root.rotation.z = -direction * impact * 0.08;
  player.root.scaling.y = 1 - impact * 0.05;
  player.pelvis.position.y = 0.43;
  player.spine.rotation.z = -direction * (0.04 + impact * 0.12);
  player.spine.rotation.y = direction * (0.08 + impact * 0.16);
  player.headJoint.rotation.y = -direction * impact * 0.12;
  player.leftShoulder.rotation.z = 0.52 + direction * impact * 0.12;
  player.rightShoulder.rotation.z = -0.68 + direction * impact * 0.16;
  player.leftElbow.rotation.z = -0.46;
  player.rightElbow.rotation.z = 0.68;
  player.leftForearm.rotation.z = 0.3;
  player.rightForearm.rotation.z = -0.32;
  player.blade.rotation.z = -0.18 + direction * impact * 0.62;
  player.sash.rotation.z = direction * impact * 0.2;
  player.sashTail.rotation.z = -0.12 - direction * impact * 0.45;
  player.prayer.rotation.y = direction * impact * 0.8;
}

function applyHit(player: BuiltPlayer, progress: number, direction: -1 | 1) {
  const p = clamp01(progress);
  const recoil = p < 0.35 ? easeOut(p / 0.35) : 1 - smooth((p - 0.35) / 0.65);
  player.root.rotation.y = direction * recoil * 0.18;
  player.root.rotation.z = direction * recoil * 0.06;
  player.root.scaling.y = 1 - recoil * 0.08;
  player.pelvis.position.y = 0.46 - recoil * 0.08;
  player.spine.rotation.z = direction * recoil * 0.18;
  player.spine.rotation.y = -direction * recoil * 0.08;
  player.headJoint.rotation.z = direction * recoil * 0.12;
  player.leftShoulder.rotation.z = 0.16 + direction * recoil * 0.22;
  player.rightShoulder.rotation.z = -0.16 + direction * recoil * 0.26;
  player.leftElbow.rotation.z = -0.04 - direction * recoil * 0.16;
  player.rightElbow.rotation.z = 0.04 - direction * recoil * 0.18;
  player.blade.rotation.z = -0.65 + direction * recoil * 0.3;
  player.sash.rotation.z = -direction * recoil * 0.25;
  player.sashTail.rotation.z = -0.12 + direction * recoil * 0.45;
  player.prayer.rotation.y = -direction * recoil * 0.7;
}

function applyDefeat(player: BuiltPlayer, progress: number) {
  const p = easeOut(progress);
  player.root.rotation.z = -0.42 * p;
  player.root.rotation.y = 0.12 * p;
  player.root.scaling.y = 1 - 0.2 * p;
  player.pelvis.position.y = 0.46 - 0.18 * p;
  player.spine.position.y = 0.52 - 0.08 * p;
  player.spine.rotation.z = -0.2 * p;
  player.headJoint.rotation.z = -0.32 * p;
  player.leftShoulder.rotation.z = 0.16 + 0.28 * p;
  player.rightShoulder.rotation.z = -0.16 - 0.34 * p;
  player.leftElbow.rotation.z = -0.04 + 0.18 * p;
  player.rightElbow.rotation.z = 0.04 - 0.2 * p;
  player.leftThigh.rotation.z = 0.02 - 0.12 * p;
  player.rightThigh.rotation.z = -0.02 + 0.18 * p;
  player.blade.rotation.z = -0.65 + 0.56 * p;
  player.sash.rotation.z = 0.32 * p;
  player.sashTail.rotation.z = -0.12 + 0.62 * p;
  player.prayer.rotation.y = -0.8 * p;
}

function applyVictory(player: BuiltPlayer, progress: number, time: number) {
  const p = smooth(progress);
  const breath = Math.sin(time * 3) * 0.015;
  player.root.rotation.y = Math.sin(time * 1.5) * 0.04;
  player.pelvis.position.y = 0.46 + breath;
  player.spine.position.y = 0.52 + breath;
  player.spine.rotation.z = -0.04 * p;
  player.headJoint.rotation.y = -0.06 * p;
  player.leftShoulder.rotation.z = lerp(0.16, 0.3, p);
  player.rightShoulder.rotation.z = lerp(-0.16, -0.42, p);
  player.leftElbow.rotation.z = lerp(-0.04, -0.2, p);
  player.rightElbow.rotation.z = lerp(0.04, 0.34, p);
  player.blade.rotation.z = lerp(-0.65, -0.92, p);
  player.sash.rotation.z = Math.sin(time * 2.2) * 0.08;
  player.sashTail.rotation.z = -0.12 + Math.sin(time * 2.4) * 0.1;
  player.prayer.rotation.y = Math.sin(time * 1.8) * 0.25;
}

function applySpawn(player: BuiltPlayer, progress: number, time: number) {
  const p = easeOut(progress);
  player.root.position.y = BASE_ROOT_Y + (1 - p) * 0.72;
  player.root.scaling.set(0.82 + p * 0.18, 0.72 + p * 0.28, 0.82 + p * 0.18);
  player.root.rotation.z = (1 - p) * 0.18;
  player.pelvis.position.y = 0.46 + Math.sin(p * Math.PI) * 0.05;
  player.spine.position.y = 0.52;
  player.spine.rotation.z = (1 - p) * -0.08;
  player.headJoint.rotation.y = (1 - p) * 0.18;
  player.blade.rotation.z = lerp(-1.05, -0.65, p);
  player.sash.rotation.z = Math.sin(time * 8) * (1 - p) * 0.25;
  player.sashTail.rotation.z = -0.12 + Math.sin(time * 8.5) * (1 - p) * 0.5;
  player.prayer.rotation.y = (1 - p) * 1.2;
}

type PoseValue = {
  node: Joint | Mesh;
  rotation: Vector3;
  position: Vector3;
  scaling: Vector3;
};
const secondaryHistory = new WeakMap<
  BuiltPlayer,
  { angle: number; time: number; lag: number }
>();
const poseHistory = new WeakMap<
  BuiltPlayer,
  {
    kind: PlayerMotionKind;
    time: number;
    changedAt: number;
    previous: PoseValue[];
    from: PoseValue[];
  }
>();
function poseValues(player: BuiltPlayer): PoseValue[] {
  return Object.values(player).map(node => ({
    node,
    rotation: node.rotation.clone(),
    position: node.position.clone(),
    scaling: node.scaling.clone(),
  }));
}
function applyMotion(player: BuiltPlayer, sample: PlayerMotionSample) {
  resetPose(player);
  const progress = clamp01(sample.progress);
  const time = sample.timeSeconds;
  const decorativeTime = sample.reducedMotion ? 0 : time;
  const direction = sample.direction === -1 ? -1 : 1;

  switch (sample.kind) {
    case "spawn":
      applySpawn(player, progress, decorativeTime);
      break;
    case "dodge":
      applyDodge(player, progress, direction);
      break;
    case "attack":
      applyAttack(
        player,
        progress,
        sample.attackKind ?? "normal",
        time,
        direction
      );
      break;
    case "sheath":
      applySheath(player, progress, decorativeTime);
      break;
    case "guard":
      applyGuard(player, decorativeTime);
      break;
    case "parry":
      applyParry(player, progress, direction);
      break;
    case "hit":
      applyHit(player, progress, direction);
      break;
    case "defeat":
      applyDefeat(player, progress);
      break;
    case "victory":
      applyVictory(player, progress, decorativeTime);
      break;
    case "idle":
    default:
      applyIdle(player, decorativeTime);
      break;
  }
  let history = poseHistory.get(player);
  if (history && time >= history.time) {
    if (history.kind !== sample.kind) {
      history.from = history.previous;
      history.changedAt = time;
    }
    const amount = smooth(
      (time - history.changedAt) / (sample.kind === "attack" ? 0.045 : 0.065)
    );
    if (amount < 1)
      history.from.forEach(({ node, rotation, position, scaling }) => {
        const x = node.position.x,
          z = node.position.z;
        node.rotation.copyFrom(Vector3.Lerp(rotation, node.rotation, amount));
        node.position.copyFrom(Vector3.Lerp(position, node.position, amount));
        node.scaling.copyFrom(Vector3.Lerp(scaling, node.scaling, amount));
        if (node === player.root) {
          node.position.x = x;
          node.position.z = z;
        }
      });
    history.kind = sample.kind;
    history.time = time;
    history.previous = poseValues(player);
  } else {
    history = {
      kind: sample.kind,
      time,
      changedAt: time - 1,
      previous: poseValues(player),
      from: [],
    };
    poseHistory.set(player, history);
  }
  // Final display pass: effects cannot move the gameplay lane/root.
  if (sample.guardBroken) {
    player.pelvis.position.y -= 0.12;
    player.spine.rotation.x += 0.25;
    player.headJoint.rotation.x += 0.18;
  }
  if (sample.counterReady && sample.kind === "idle") {
    player.rightShoulder.rotation.z = -0.65;
    player.rightElbow.rotation.z = 0.6;
  }
  if (
    sample.hitProgress !== undefined &&
    sample.kind !== "hit" &&
    sample.kind !== "defeat"
  ) {
    const pulse = Math.sin(clamp01(sample.hitProgress) * Math.PI);
    player.spine.rotation.z +=
      (sample.hitDirection ?? direction) * pulse * 0.18;
    player.headJoint.rotation.z +=
      (sample.hitDirection ?? direction) * pulse * 0.12;
  }
  const secondary = secondaryHistory.get(player);
  if (secondary && time > secondary.time && !sample.reducedMotion) {
    const dt = Math.min(0.1, time - secondary.time);
    const velocity =
      (player.blade.rotation.z - secondary.angle) / Math.max(0.001, dt);
    const target = Math.max(-0.16, Math.min(0.16, -velocity * 0.008));
    secondary.lag += (target - secondary.lag) * (1 - Math.exp(-dt * 12));
    player.hair.rotation.z += secondary.lag * 0.45;
    player.neckCloth.rotation.z += secondary.lag * 0.7;
    player.sashTail.rotation.z += secondary.lag;
    player.prayer.rotation.y += secondary.lag * 0.65;
    secondary.angle = player.blade.rotation.z;
    secondary.time = time;
  } else
    secondaryHistory.set(player, {
      angle: player.blade.rotation.z,
      time,
      lag: 0,
    });
  // The mesh faces local -Z; the combat forward vector is world +Z.
  player.root.rotation.y += Math.PI;
  // The blade's origin is its centre, so derive its centre from the grip.
  const angle = player.blade.rotation.z;
  player.blade.position.set(
    0.04 - Math.sin(angle) * 0.85,
    Math.cos(angle) * 0.85,
    -0.02
  );
  player.guard.position.set(
    0.04 - Math.sin(angle) * 0.13,
    Math.cos(angle) * 0.13,
    -0.02
  );
  player.guard.rotation.set(0, 0, angle);
  player.grip.rotation.z = angle;
  // The left arm uses a two-bone display IK solution during two-handed poses.
  // It never changes the gameplay root or the right-hand weapon transform.
  if (["guard", "parry", "attack"].includes(sample.kind)) {
    player.root.computeWorldMatrix(true);
    player.rightHand.computeWorldMatrix(true);
    player.leftShoulder.computeWorldMatrix(true);
    const targetWorld = Vector3.TransformCoordinates(
      new Vector3(0.04 + Math.sin(angle) * 0.1, -Math.cos(angle) * 0.1, -0.02),
      player.rightHand.getWorldMatrix()
    );
    const parentMatrix = player.spine.computeWorldMatrix(true);
    const target = Vector3.TransformCoordinates(
      targetWorld,
      Matrix.Invert(parentMatrix)
    );
    const origin = player.leftShoulder.position;
    const delta = target.subtract(origin);
    // A small clavicle translation keeps both bones within their reach.
    if (delta.length() > 0.779) {
      origin.addInPlace(delta.normalizeToNew().scale(delta.length() - 0.779));
      delta.copyFrom(target.subtract(origin));
    }
    const distance = Math.min(0.779, Math.max(0.03, delta.length()));
    const along = delta.normalize();
    let bend = Vector3.Cross(along, new Vector3(0, 0, 1));
    if (bend.lengthSquared() < 0.001) bend = new Vector3(1, 0, 0);
    bend.normalize();
    const projection =
      (distance * distance + 0.4 * 0.4 - 0.38 * 0.38) / (2 * distance);
    const height = Math.sqrt(Math.max(0, 0.4 * 0.4 - projection * projection));
    const upper = along.scale(projection).add(bend.scale(height));
    const shoulderQ = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(
      new Vector3(0, -1, 0),
      upper.normalizeToNew(),
      shoulderQ
    );
    player.leftShoulder.rotationQuaternion = shoulderQ;
    player.leftShoulder.computeWorldMatrix(true);
    const lowerWorld = targetWorld.subtract(
      player.leftElbow.computeWorldMatrix(true).getTranslation()
    );
    const lowerLocal = Vector3.TransformNormal(
      lowerWorld,
      Matrix.Invert(player.leftShoulder.getWorldMatrix())
    ).normalize();
    const elbowQ = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(new Vector3(0, -1, 0), lowerLocal, elbowQ);
    player.leftElbow.rotationQuaternion = elbowQ;
    player.leftForearm.rotation.setAll(0);
    player.leftHand.rotation.setAll(0);
  }
  // Keep the lowest supporting sole on the common floor for every pose.
  player.root.computeWorldMatrix(true);
  const sole = Math.min(
    ...[player.leftFoot, player.rightFoot].map(foot => {
      foot.computeWorldMatrix(true);
      return foot.getBoundingInfo().boundingBox.minimumWorld.y;
    })
  );
  const lift = sample.kind === "spawn" ? (1 - easeOut(progress)) * 0.72 : 0;
  player.root.position.y += COMBAT_FLOOR_Y + lift - sole;
}

export function makeProceduralPlayer(
  scene: Scene,
  materials: ProceduralCharacterMaterials
): ProceduralPlayer {
  const built = createBuiltPlayer(scene, materials);
  resetPose(built);
  return {
    root: built.root,
    blade: built.blade,
    torso: built.torso,
    leftArm: built.leftShoulder,
    rightArm: built.rightShoulder,
    leftLeg: built.leftThigh,
    rightLeg: built.rightThigh,
    head: built.head,
    hair: built.hair,
    neckCloth: built.neckCloth,
    prayer: built.prayer,
    sash: built.sash,
    scabbard: built.scabbard,
    applyMotion: sample => applyMotion(built, sample),
  };
}
