// 墨霞の修験道：低ポリゴンの山伏と霧の石段。静けさを保ち、攻撃だけを朱で強調する。
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import "@babylonjs/core/Materials/standardMaterial";
import {
  PERFORMANCE_CONFIG,
  clampVolume,
  readAudioSettings,
  readPerformanceTier,
  SETTINGS_STORAGE_KEYS,
  type PerformanceTier,
} from "./config";
import {
  addChapterRewardEffect,
  applyDamage,
  attackTimingFor,
  bossPhaseForHealth,
  bossPoolForWave,
  canStartPlayerAction,
  chapterForWave,
  chapterRewardOptionsForDefeat,
  chooseNonRepeatingIndex,
  correctDodgeForLane,
  crossedComboMilestones,
  DIFFICULTY_CONFIG,
  defeatProgress,
  enemyAttackPlanFor,
  enemyPostureDamageFor,
  followUpLanesFor,
  modeLimitFor,
  nextSeed,
  normalEnemyPoolForWave,
  normalizeSeed,
  postureAfterGuard,
  recoverPosture,
  scoreForCombo,
  shiftActiveTimer,
  tutorialVariantIndex,
  type ChapterRewardKind,
  type Difficulty,
  type RunMode,
  type EnemyRole,
  type Lane,
  type PlayerAttackKind,
} from "./rules";

type State = {
  mode: RunMode;
  modeLimit: number;
  difficulty: Difficulty;
  seed: number;
  chapter: number;
  hp: number;
  playerPosture: number;
  playerPostureMax: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyPosture: number;
  enemyPostureMax: number;
  wave: number;
  remainingEnemies: number;
  boss: boolean;
  bossPhase: 1 | 2;
  bossDefeatPulse: number;
  enemyName: string;
  enemyEpithet: string;
  enemyFamily: string;
  enemyAttackStyle: EnemyAttackSide;
  enemyPhase: string;
  stance: string;
  attackPhase: string;
  message: string;
  defeated: boolean;
  combo: number;
  maxCombo: number;
  score: number;
  comboTime: number;
  defeatedCount: number;
  bossDefeats: number;
  parrySuccesses: number;
  correctDodges: number;
  hitsTaken: number;
  whiffs: number;
  playTimeMs: number;
  bestScore: number;
  isNewRecord: boolean;
  rewardPending: boolean;
  rewardChapter: number;
  rewardOptions: ReadonlyArray<{
    kind: ChapterRewardKind;
    label: string;
    description: string;
  }>;
  rewardEffects: ReadonlyArray<ChapterRewardKind>;
  climax: number;
  counterReady: boolean;
  counterPulse: number;
  paused: boolean;
  transitioning: boolean;
  tutorialStep: number;
};
export type GameHandle = { scene: Scene; dispose: () => void };

const VERMILION = new Color3(0.72, 0.17, 0.1);
const INK = new Color3(0.035, 0.045, 0.06);
const MIST = new Color3(0.22, 0.28, 0.32);

function mat(scene: Scene, name: string, color: Color3, emissive = 0) {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  m.specularColor = new Color3(0.08, 0.08, 0.08);
  m.emissiveColor = color.scale(emissive);
  return m;
}
function box(
  scene: Scene,
  name: string,
  size: Vector3,
  pos: Vector3,
  material: StandardMaterial,
) {
  const m = MeshBuilder.CreateBox(
    name,
    { width: size.x, height: size.y, depth: size.z },
    scene,
  );
  m.position = pos;
  m.material = material;
  return m;
}
function makePlayer(scene: Scene, materials: Record<string, StandardMaterial>) {
  const root = new Mesh("yamabushi_samurai", scene);
  root.position = new Vector3(0, 0.18, 0);
  const torso = box(
    scene,
    "samurai_kimono",
    new Vector3(0.82, 0.92, 0.52),
    new Vector3(0, 1.15, 0),
    materials.indigo,
  );
  torso.parent = root;
  const lapel = box(
    scene,
    "kimono_lapel",
    new Vector3(0.16, 0.72, 0.56),
    new Vector3(0.08, 1.25, -0.03),
    materials.cream,
  );
  lapel.rotation.z = -0.16;
  lapel.parent = root;
  const sash = box(
    scene,
    "obi_sash",
    new Vector3(0.88, 0.16, 0.58),
    new Vector3(0, 0.82, -0.01),
    materials.leather,
  );
  sash.parent = root;
  const knot = box(
    scene,
    "obi_knot",
    new Vector3(0.22, 0.24, 0.12),
    new Vector3(-0.38, 0.86, 0.24),
    materials.vermilion,
  );
  knot.parent = root;
  const hakama = MeshBuilder.CreateCylinder(
    "hakama",
    { height: 0.58, diameterTop: 0.72, diameterBottom: 1.0, tessellation: 6 },
    scene,
  );
  hakama.position = new Vector3(0, 0.46, 0);
  hakama.material = materials.indigo;
  hakama.parent = root;
  const leftLeg = box(
    scene,
    "left_leg",
    new Vector3(0.2, 0.54, 0.26),
    new Vector3(-0.2, 0.12, 0),
    materials.gaiter,
  );
  leftLeg.parent = root;
  const rightLeg = box(
    scene,
    "right_leg",
    new Vector3(0.2, 0.54, 0.26),
    new Vector3(0.2, 0.12, 0),
    materials.gaiter,
  );
  rightLeg.parent = root;
  const leftSandal = box(
    scene,
    "left_zori",
    new Vector3(0.3, 0.08, 0.48),
    new Vector3(-0.2, -0.16, -0.03),
    materials.wood,
  );
  leftSandal.parent = root;
  const rightSandal = box(
    scene,
    "right_zori",
    new Vector3(0.3, 0.08, 0.48),
    new Vector3(0.2, -0.16, -0.03),
    materials.wood,
  );
  rightSandal.parent = root;
  const head = MeshBuilder.CreateSphere(
    "samurai_face",
    { diameter: 0.48, segments: 12 },
    scene,
  );
  head.position = new Vector3(0, 1.9, -0.02);
  head.material = materials.skin;
  head.parent = root;
  const hair = MeshBuilder.CreateSphere(
    "chonmage_hair",
    { diameter: 0.52, segments: 8 },
    scene,
  );
  hair.scaling = new Vector3(0.92, 0.58, 0.92);
  hair.position = new Vector3(0, 2.13, 0.02);
  hair.material = materials.hair;
  hair.parent = root;
  const topknot = MeshBuilder.CreateCylinder(
    "topknot",
    { height: 0.22, diameterTop: 0.14, diameterBottom: 0.22, tessellation: 8 },
    scene,
  );
  topknot.position = new Vector3(0, 2.32, 0.02);
  topknot.material = materials.hair;
  topknot.parent = root;
  const headband = box(
    scene,
    "hachimaki",
    new Vector3(0.5, 0.06, 0.5),
    new Vector3(0, 2.0, -0.02),
    materials.vermilion,
  );
  headband.parent = root;
  const neckCloth = box(
    scene,
    "neck_cloth",
    new Vector3(0.42, 0.16, 0.42),
    new Vector3(0, 1.65, 0),
    materials.cream,
  );
  neckCloth.parent = root;
  const leftArm = box(
    scene,
    "left_sleeve",
    new Vector3(0.2, 0.72, 0.24),
    new Vector3(-0.52, 1.15, 0),
    materials.indigo,
  );
  leftArm.rotation.z = 0.16;
  leftArm.parent = root;
  const rightArm = box(
    scene,
    "right_sleeve",
    new Vector3(0.2, 0.72, 0.24),
    new Vector3(0.52, 1.15, 0),
    materials.indigo,
  );
  rightArm.rotation.z = -0.16;
  rightArm.parent = root;
  const staff = MeshBuilder.CreateCylinder(
    "staff",
    { height: 1.9, diameter: 0.07, tessellation: 8 },
    scene,
  );
  staff.position = new Vector3(-0.72, 1.05, 0.05);
  staff.rotation.z = -0.1;
  staff.material = materials.wood;
  staff.parent = root;
  const scabbard = box(
    scene,
    "katana_scabbard",
    new Vector3(0.1, 1.18, 0.1),
    new Vector3(0.28, 0.82, 0.22),
    materials.wood,
  );
  scabbard.rotation.z = -0.72;
  scabbard.parent = root;
  const blade = box(
    scene,
    "katana",
    new Vector3(0.07, 1.45, 0.08),
    new Vector3(0.68, 1.3, -0.08),
    materials.steel,
  );
  blade.rotation.z = -0.65;
  blade.parent = root;
  const guard = MeshBuilder.CreateTorus(
    "tsuba",
    { diameter: 0.2, thickness: 0.035, tessellation: 16 },
    scene,
  );
  guard.position = new Vector3(0.4, 1.73, -0.08);
  guard.rotation.y = Math.PI / 2;
  guard.material = materials.gold;
  guard.parent = root;
  const prayer = MeshBuilder.CreateTorus(
    "prayer_beads",
    { diameter: 0.28, thickness: 0.025, tessellation: 12 },
    scene,
  );
  prayer.position = new Vector3(-0.2, 1.62, -0.28);
  prayer.rotation.x = Math.PI / 2;
  prayer.material = materials.vermilion;
  prayer.parent = root;
  return {
    root,
    blade,
    torso,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    head,
    hair,
    neckCloth,
    prayer,
    sash,
    scabbard,
  };
}
type EnemyAttackSide = "left" | "right" | "alternate" | "wide" | "target";
type EnemyVariant = {
  name: string;
  epithet: string;
  family: string;
  role: EnemyRole;
  shape: number;
  attackSide: EnemyAttackSide;
  cooldown: number;
  notice: string;
  boss?: boolean;
};
const ENEMY_VARIANTS: EnemyVariant[] = [
  {
    name: "影面",
    epithet: "左薙の影",
    family: "左右教材型",
    role: "left-teacher",
    shape: 0,
    attackSide: "left",
    cooldown: 3000,
    notice: "左槍が赤く灯る。右へ避けよ。",
  },
  {
    name: "角岩",
    epithet: "右穿の角",
    family: "左右教材型",
    role: "right-teacher",
    shape: 1,
    attackSide: "right",
    cooldown: 3400,
    notice: "右槍が赤く灯る。左へ避けよ。",
  },
  {
    name: "鳴壺",
    epithet: "交互の壺",
    family: "交互攻撃型",
    role: "alternate",
    shape: 2,
    attackSide: "alternate",
    cooldown: 2700,
    notice: "左、右と交互に鳴る。次の槍を読め。",
  },
  {
    name: "逆鉾",
    epithet: "三手の異形",
    family: "型攻撃型",
    role: "pattern",
    shape: 3,
    attackSide: "alternate",
    cooldown: 3300,
    notice: "右、右、左。三手の型を覚えよ。",
  },
  {
    name: "霧猿",
    epithet: "狙い定める影",
    family: "追尾型",
    role: "tracking",
    shape: 4,
    attackSide: "target",
    cooldown: 3900,
    notice: "前半は追う。線が止まってから避けよ。",
  },
  {
    name: "鉄輪",
    epithet: "返す双輪",
    family: "二段攻撃型",
    role: "double",
    shape: 5,
    attackSide: "alternate",
    cooldown: 4300,
    notice: "一撃の反対へ二撃目が来る。動作を見よ。",
  },
  {
    name: "骨灯",
    epithet: "重圧の灯",
    family: "重量型",
    role: "heavy",
    shape: 6,
    attackSide: "target",
    cooldown: 4800,
    notice: "遅いが重い。受け流すか、線を外せ。",
  },
];
const BOSS_VARIANTS: EnemyVariant[] = [
  {
    name: "牙嶺",
    epithet: "月喰らいの獣",
    family: "獣型",
    role: "double",
    shape: 4,
    attackSide: "target",
    cooldown: 3200,
    notice: "低く距離を詰め、逆側へ牙を返す。",
    boss: true,
  },
  {
    name: "鎧熊",
    epithet: "鉄皮の荒王",
    family: "獣型",
    role: "heavy",
    shape: 5,
    attackSide: "target",
    cooldown: 4200,
    notice: "重い突進の後にも牙が返る。",
    boss: true,
  },
  {
    name: "沼喰",
    epithet: "深淵の異形",
    family: "モンスター型",
    role: "alternate",
    shape: 0,
    attackSide: "alternate",
    cooldown: 3000,
    notice: "危険域が外へ膨らむ。早く動きすぎるな。",
    boss: true,
  },
  {
    name: "百眼",
    epithet: "千穴の怪",
    family: "モンスター型",
    role: "tracking",
    shape: 1,
    attackSide: "target",
    cooldown: 3300,
    notice: "広がる眼光が狙いを追う。止まる瞬間を見よ。",
    boss: true,
  },
  {
    name: "鬼将",
    epithet: "赤面の武門",
    family: "人型",
    role: "pattern",
    shape: 3,
    attackSide: "left",
    cooldown: 3100,
    notice: "予告を一度返す。返した線が真である。",
    boss: true,
  },
  {
    name: "白面",
    epithet: "無音の剣客",
    family: "人型",
    role: "pattern",
    shape: 2,
    attackSide: "right",
    cooldown: 2900,
    notice: "静かなフェイント後の線を読め。",
    boss: true,
  },
  {
    name: "天狗鴉",
    epithet: "空駆ける嘴",
    family: "鳥型",
    role: "alternate",
    shape: 6,
    attackSide: "alternate",
    cooldown: 3000,
    notice: "横へ舞った位置から急降下する。",
    boss: true,
  },
  {
    name: "鶴骸",
    epithet: "白羽の亡霊",
    family: "鳥型",
    role: "tracking",
    shape: 4,
    attackSide: "target",
    cooldown: 3400,
    notice: "白羽の移動先を見て、降下線を外せ。",
    boss: true,
  },
  {
    name: "石門王",
    epithet: "割れ鳥居の主",
    family: "モニュメント型",
    role: "heavy",
    shape: 5,
    attackSide: "target",
    cooldown: 4500,
    notice: "動かず、地面を順に打つ。次の線を読め。",
    boss: true,
  },
  {
    name: "巨仏",
    epithet: "沈黙する座像",
    family: "モニュメント型",
    role: "heavy",
    shape: 0,
    attackSide: "target",
    cooldown: 5000,
    notice: "座したまま地を順に砕く。",
    boss: true,
  },
];

function makeEnemy(
  scene: Scene,
  materials: Record<string, StandardMaterial>,
  variant: EnemyVariant,
) {
  const root = new Mesh("mountain_wraith", scene);
  root.position = new Vector3(0, 0.2, 5.2);
  const body0 = MeshBuilder.CreatePolyhedron(
    "wraith_body_shadow",
    { type: 1, size: 1.45 },
    scene,
  );
  body0.position.y = 1.05;
  body0.scaling.y = 1.4;
  body0.material = materials.stone;
  body0.parent = root;
  const body1 = MeshBuilder.CreateCylinder(
    "wraith_body_rock",
    { height: 1.8, diameterTop: 0.72, diameterBottom: 1.28, tessellation: 6 },
    scene,
  );
  body1.position.y = 1.05;
  body1.material = materials.stone;
  body1.parent = root;
  const body2 = MeshBuilder.CreateSphere(
    "wraith_body_vessel",
    { diameter: 1.35, segments: 8 },
    scene,
  );
  body2.position.y = 1.05;
  body2.scaling.y = 1.18;
  body2.material = materials.stone;
  body2.parent = root;
  const body3 = MeshBuilder.CreateBox(
    "wraith_body_spear",
    { width: 1.1, height: 1.9, depth: 0.9 },
    scene,
  );
  body3.position.y = 1.05;
  body3.rotation.z = 0.08;
  body3.material = materials.stone;
  body3.parent = root;
  const body4 = MeshBuilder.CreateTorus(
    "wraith_body_mist",
    { diameter: 1.5, thickness: 0.38, tessellation: 8 },
    scene,
  );
  body4.position.y = 1.05;
  body4.rotation.x = Math.PI / 2;
  body4.material = materials.stone;
  body4.parent = root;
  const body5 = MeshBuilder.CreateCylinder(
    "wraith_body_ring",
    { height: 1.35, diameterTop: 1.38, diameterBottom: 0.86, tessellation: 8 },
    scene,
  );
  body5.position.y = 1.05;
  body5.material = materials.stone;
  body5.parent = root;
  const body6 = MeshBuilder.CreatePolyhedron(
    "wraith_body_lantern",
    { type: 2, size: 1.45 },
    scene,
  );
  body6.position.y = 1.05;
  body6.scaling.y = 1.2;
  body6.material = materials.stone;
  body6.parent = root;
  const bodies = [body0, body1, body2, body3, body4, body5, body6];
  bodies.forEach((body, index) => {
    body.isVisible = index === variant.shape;
  });
  const body = bodies[variant.shape];
  const eyeL = MeshBuilder.CreateSphere(
    "eye_l",
    { diameter: 0.1, segments: 6 },
    scene,
  );
  eyeL.position = new Vector3(-0.22, 1.35, -0.6);
  eyeL.material = materials.amber;
  eyeL.parent = root;
  const eyeR = eyeL.clone("eye_r")!;
  eyeR.position.x = 0.22;
  eyeR.parent = root;
  const blade = box(
    scene,
    "wraith_blade",
    new Vector3(0.12, 1.25, 0.12),
    new Vector3(0.68, 1.05, -0.1),
    materials.iron,
  );
  blade.rotation.z = -0.7;
  blade.parent = root;
  const spearL = box(
    scene,
    "wraith_spear_l",
    new Vector3(0.09, 0.09, 1.15),
    new Vector3(-0.72, 1.08, -0.62),
    materials.iron,
  );
  spearL.parent = root;
  const spearR = box(
    scene,
    "wraith_spear_r",
    new Vector3(0.09, 0.09, 1.15),
    new Vector3(0.72, 1.08, -0.62),
    materials.iron,
  );
  spearR.parent = root;
  const spearTipL = MeshBuilder.CreateCylinder(
    "wraith_spear_tip_l",
    { height: 0.24, diameterTop: 0, diameterBottom: 0.18, tessellation: 4 },
    scene,
  );
  spearTipL.rotation.x = Math.PI / 2;
  spearTipL.position = new Vector3(-0.72, 1.08, -1.28);
  spearTipL.material = materials.iron;
  spearTipL.parent = root;
  const spearTipR = spearTipL.clone("wraith_spear_tip_r")!;
  spearTipR.position.x = 0.72;
  spearTipR.parent = root;
  return {
    root,
    body,
    bodies,
    eyes: [eyeL, eyeR],
    blade,
    spears: [spearL, spearR],
    spearTips: [spearTipL, spearTipR],
  };
}
function announce(state: State) {
  window.dispatchEvent(new CustomEvent("yamabushi-state", { detail: state }));
}

export async function createGameScene(
  engine: Engine,
  canvas: HTMLCanvasElement,
  initialPerformanceTier: PerformanceTier = readPerformanceTier(
    localStorage.getItem(SETTINGS_STORAGE_KEYS.performance),
  ),
): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.06, 0.075, 0.09, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.045;
  scene.fogColor = MIST;
  let performanceTier = initialPerformanceTier;
  const applyPerformanceTier = (tier: PerformanceTier) => {
    performanceTier = tier;
    scene.fogEnabled = PERFORMANCE_CONFIG[tier].fogEnabled;
    scene.fogDensity = 0.045;
  };
  applyPerformanceTier(performanceTier);
  const camera = new FreeCamera("camera", new Vector3(7.6, 5.2, -8.5), scene);
  camera.setTarget(new Vector3(0, 1.05, 2.2));
  camera.attachControl(canvas, true);
  camera.speed = 0.15;
  camera.minZ = 0.1;
  const light = new HemisphericLight(
    "moonlight",
    new Vector3(-0.2, 1, -0.4),
    scene,
  );
  light.intensity = 0.72;
  light.diffuse = new Color3(0.62, 0.7, 0.78);
  light.groundColor = new Color3(0.05, 0.06, 0.07);
  const materials = {
    ink: mat(scene, "ink", INK),
    enemyGlow: mat(scene, "enemy_glow", new Color3(0.92, 0.48, 0.62), 0.42),
    bossGlow: mat(scene, "boss_glow", new Color3(0.62, 0.04, 0.22), 0.72),
    spearReady: mat(scene, "spear_ready", VERMILION, 0.95),
    indigo: mat(scene, "indigo", new Color3(0.09, 0.12, 0.18)),
    skin: mat(scene, "skin", new Color3(0.46, 0.31, 0.23)),
    gaiter: mat(scene, "gaiter", new Color3(0.75, 0.73, 0.65)),
    wood: mat(scene, "wood", new Color3(0.28, 0.16, 0.1)),
    steel: mat(scene, "steel", new Color3(0.68, 0.73, 0.75), 0.16),
    vermilion: mat(scene, "vermilion", VERMILION, 0.28),
    stone: mat(scene, "stone", new Color3(0.12, 0.14, 0.16)),
    amber: mat(scene, "amber", new Color3(0.95, 0.45, 0.12), 0.8),
    iron: mat(scene, "iron", new Color3(0.22, 0.24, 0.25)),
    cream: mat(scene, "cream", new Color3(0.82, 0.76, 0.64)),
    leather: mat(scene, "leather", new Color3(0.22, 0.09, 0.05)),
    hair: mat(scene, "hair", new Color3(0.025, 0.02, 0.018)),
    gold: mat(scene, "gold", new Color3(0.72, 0.45, 0.13), 0.14),
  };
  const ground = box(
    scene,
    "mountain_floor",
    new Vector3(22, 0.3, 30),
    new Vector3(0, -0.15, 5),
    materials.stone,
  );
  for (let i = 0; i < 8; i++)
    box(
      scene,
      `stone_step_${i}`,
      new Vector3(6.4 - i * 0.15, 0.28, 1.2),
      new Vector3(0, i * 0.12, i * 1.15 - 0.6),
      materials.stone,
    );
  for (const x of [-3.3, 3.3]) {
    box(
      scene,
      "torii_pillar",
      new Vector3(0.38, 4.2, 0.38),
      new Vector3(x, 2.1, 9),
      materials.wood,
    );
    box(
      scene,
      "torii_crossbeam",
      new Vector3(7.5, 0.32, 0.42),
      new Vector3(0, 4, 9),
      materials.wood,
    );
    box(
      scene,
      "torii_upperbeam",
      new Vector3(8.2, 0.25, 0.5),
      new Vector3(0, 4.45, 9),
      materials.vermilion,
    );
  }
  const player = makePlayer(scene, materials);
  const attackAreaMaterial = mat(
    scene,
    "attack_area_red",
    new Color3(0.95, 0.04, 0.03),
    0.9,
  );
  attackAreaMaterial.alpha = 0.24;
  const attackArea = box(
    scene,
    "enemy_attack_area",
    new Vector3(1.65, 0.025, 2.3),
    new Vector3(0, 0.025, 2.35),
    attackAreaMaterial,
  );
  attackArea.isVisible = false;
  const zoneMaterials = [-1, 0, 1].map((lane) =>
    mat(scene, `foot_zone_${lane}`, new Color3(1, 0.03, 0.02), 0.9),
  );
  const footZones = [-1, 0, 1].map((lane, index) => {
    const zone = box(
      scene,
      `player_foot_attack_zone_${lane}`,
      new Vector3(0.78, 0.03, 1.45),
      new Vector3(lane * 0.92, 0.045, 0.02),
      zoneMaterials[index],
    );
    zone.isVisible = false;
    return zone;
  });
  const updateFootZones = (visible: boolean, targetLane: number) => {
    footZones.forEach((zone, index) => {
      zone.isVisible = visible;
      zone.position.x = player.root.position.x + (index - 1) * 0.92;
      zone.material = zoneMaterials[index];
      const pulse =
        0.84 + 0.16 * (0.5 + 0.5 * Math.sin(performance.now() * 0.035));
      zoneMaterials[index].alpha = visible
        ? index - 1 === targetLane
          ? 0.78 * pulse
          : 0.055
        : 0.11;
    });
  };
  let slashProjectile: Mesh | null = null;
  let slashImpactAt = 0;
  let slashDirection = 1;
  let slashAngle = 0;
  let slashBaseAngle = 0;
  let slashPower = 1;
  let slashScale = 1;
  let previousBladeAngle = -0.65;
  let slashTargetX = 0;
  let slashTargetZ = 5.2;
  let currentVariant = ENEMY_VARIANTS[0];
  const enemy = makeEnemy(scene, materials, currentVariant);
  const guardRingMaterial = mat(
    scene,
    "enemy_guard_ring",
    new Color3(0.28, 0.72, 1),
    0.9,
  );
  const guardRing = MeshBuilder.CreateTorus(
    "enemy_guard_ring",
    { diameter: 1.5, thickness: 0.06, tessellation: 24 },
    scene,
  );
  guardRing.position.y = 0.82;
  guardRing.rotation.x = Math.PI / 2;
  guardRing.material = guardRingMaterial;
  guardRing.parent = enemy.root;
  guardRing.isVisible = false;
  const warningLine = box(
    scene,
    "attack_warning_line",
    new Vector3(1.25, 0.026, 0.07),
    new Vector3(0, 0.04, 2.4),
    materials.vermilion,
  );
  warningLine.isVisible = false;
  const laneMaterials = {
    left: mat(scene, "lane_left", new Color3(0.28, 0.72, 0.92), 0.55),
    center: mat(scene, "lane_center", new Color3(0.95, 0.55, 0.18), 0.65),
    right: mat(scene, "lane_right", new Color3(0.76, 0.28, 0.78), 0.55),
  };
  const cameraHome = camera.position.clone();
  let shakeUntil = 0;
  let hitStopUntil = 0;
  let dangerLane = 0;
  const triggerImpact = (direction: number, strength = 0.08) => {
    if (effectLevel === "minimal") return;
    const now = performance.now();
    const duration = effectLevel === "reduced" ? 110 : 220;
    shakeUntil = now + duration;
    hitStopUntil = now + (effectLevel === "reduced" ? 35 : 75);
    window.dispatchEvent(
      new CustomEvent("yamabushi-impact", { detail: { direction, strength } }),
    );
  };
  const showBossReward = () => {
    if (effectLevel === "minimal") return;
    const rewardMaterial = mat(
      scene,
      `boss_reward_${performance.now()}`,
      new Color3(1, 0.78, 0.36),
      0.92,
    );
    const beams = [0, 1, 2, 3].map((index) => {
      const beam = box(
        scene,
        `boss_reward_beam_${index}`,
        new Vector3(1.6, 0.045, 0.045),
        new Vector3(enemy.root.position.x, 1.35, enemy.root.position.z - 0.9),
        index % 2 ? rewardMaterial : materials.gaiter,
      );
      beam.rotation.z = (index * Math.PI) / 4;
      beam.scaling.x = 0.35;
      return beam;
    });
    window.setTimeout(() => {
      beams.forEach((beam) => beam.dispose());
      rewardMaterial.dispose();
    }, 1250);
  };
  const showCounterHit = (direction: number) => {
    if (effectLevel === "minimal") return;
    const counterMaterial = mat(
      scene,
      `counter_fx_${performance.now()}`,
      new Color3(0.42, 0.86, 1),
      0.95,
    );
    const wave = box(
      scene,
      "counter_wave",
      new Vector3(1.7, 0.06, 0.06),
      new Vector3(enemy.root.position.x, 1.38, enemy.root.position.z - 0.9),
      counterMaterial,
    );
    const spark = box(
      scene,
      "counter_spark",
      new Vector3(0.8, 0.04, 0.04),
      new Vector3(enemy.root.position.x, 1.18, enemy.root.position.z - 0.92),
      materials.steel,
    );
    wave.rotation.z = direction * 0.34;
    spark.rotation.z = -direction * 0.82;
    wave.scaling.x = 0.6;
    spark.scaling.x = 0.7;
    window.dispatchEvent(
      new CustomEvent("yamabushi-counter", { detail: { direction } }),
    );
    window.setTimeout(
      () => {
        wave.dispose();
        spark.dispose();
        counterMaterial.dispose();
      },
      effectLevel === "reduced" ? 140 : 260,
    );
  };
  const showGuardBreak = (direction: number) => {
    if (effectLevel === "minimal") return;
    const breakMaterial = mat(
      scene,
      `guard_break_${performance.now()}`,
      new Color3(1, 0.64, 0.18),
      0.98,
    );
    const breakA = box(
      scene,
      "guard_break_a",
      new Vector3(1.9, 0.06, 0.06),
      new Vector3(enemy.root.position.x, 1.36, enemy.root.position.z - 0.82),
      breakMaterial,
    );
    const breakB = box(
      scene,
      "guard_break_b",
      new Vector3(1.45, 0.045, 0.045),
      new Vector3(enemy.root.position.x, 1.12, enemy.root.position.z - 0.8),
      materials.gaiter,
    );
    breakA.rotation.z = direction * 0.42;
    breakB.rotation.z = -direction * 0.68;
    window.setTimeout(() => {
      breakA.dispose();
      breakB.dispose();
      breakMaterial.dispose();
    }, 300);
  };
  const showGuardSpark = (direction = 1) => {
    recoilUntil = performance.now() + 190;
    recoilDirection = direction < 0 ? -1 : 1;
    playParrySound(1, direction);
    if (effectLevel === "minimal") return;
    const guardMaterial = mat(
      scene,
      `guard_fx_${performance.now()}`,
      new Color3(0.55, 0.82, 1),
      0.95,
    );
    const sparkA = box(
      scene,
      "guard_spark_a",
      new Vector3(0.7, 0.04, 0.04),
      new Vector3(player.root.position.x, 1.38, player.root.position.z - 0.65),
      guardMaterial,
    );
    const sparkB = box(
      scene,
      "guard_spark_b",
      new Vector3(0.48, 0.03, 0.03),
      new Vector3(player.root.position.x, 1.12, player.root.position.z - 0.68),
      materials.steel,
    );
    sparkA.rotation.z = -0.55;
    sparkB.rotation.z = 0.78;
    window.setTimeout(() => {
      sparkA.dispose();
      sparkB.dispose();
      guardMaterial.dispose();
    }, 220);
  };
  const showEnemyHit = (
    playerX: number,
    playerZ: number,
    direction: number,
    impactAngle = direction * 0.42,
    impactScale = 1,
  ) => {
    triggerImpact(direction, 0.045);
    if (effectLevel === "minimal") return;
    const fxMaterial = mat(
      scene,
      `hit_fx_${performance.now()}`,
      new Color3(0.95, 0.3, 0.12),
      0.8,
    );
    const flash = box(
      scene,
      "enemy_hit_flash",
      new Vector3(1.25, 0.08, 0.05),
      new Vector3(enemy.root.position.x, 1.3, enemy.root.position.z - 0.75),
      fxMaterial,
    );
    flash.scaling.setAll(
      Math.max(1.2, enemy.root.scaling.x * 1.8 * impactScale),
    );
    flash.rotation.z = impactAngle;
    const sparkA = box(
      scene,
      "enemy_hit_spark_a",
      new Vector3(0.55, 0.035, 0.035),
      new Vector3(enemy.root.position.x, 1.45, enemy.root.position.z - 0.82),
      materials.gaiter,
    );
    const sparkB = box(
      scene,
      "enemy_hit_spark_b",
      new Vector3(0.4, 0.03, 0.03),
      new Vector3(enemy.root.position.x, 1.12, enemy.root.position.z - 0.8),
      materials.steel,
    );
    sparkA.scaling.setAll(Math.max(1, impactScale));
    sparkB.scaling.setAll(Math.max(1, impactScale * 0.9));
    sparkA.rotation.z = -direction * 0.7;
    sparkB.rotation.z = direction * 0.9;
    enemy.root.scaling = new Vector3(
      (boss ? 1.38 : 1) * 1.12,
      (boss ? 1.38 : 1) * 1.12,
      (boss ? 1.38 : 1) * 1.12,
    );
    window.setTimeout(() => {
      flash.dispose();
      sparkA.dispose();
      sparkB.dispose();
      fxMaterial.dispose();
      if (enemyHp > 0) enemy.root.scaling.setAll(boss ? 1.38 : 1);
    }, 180);
  };
  const chapterTitles = [
    "霧ノ峠",
    "岩戸の回廊",
    "天狗の稜線",
    "無明の奥宮",
    "修験成就",
  ];
  const makeRunSeed = () =>
    normalizeSeed((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  let mode: RunMode = "fifty";
  let modeLimit = modeLimitFor(mode);
  let difficulty: Difficulty = "standard";
  let runSeed = makeRunSeed();
  let encounterRandomSeed = runSeed;
  let combatRandomSeed = normalizeSeed(runSeed ^ 0x9e3779b9);
  const nextEncounterRandom = () => {
    const next = nextSeed(encounterRandomSeed);
    encounterRandomSeed = next.seed;
    return next.value;
  };
  const nextCombatRandom = () => {
    const next = nextSeed(combatRandomSeed);
    combatRandomSeed = next.seed;
    return next.value;
  };
  let defeatedCount = 0;
  let bossDefeats = 0;
  let parrySuccesses = 0;
  let correctDodges = 0;
  let hitsTaken = 0;
  let whiffs = 0;
  let activePlayTimeMs = 0;
  let enemyHitTaken = false;
  let bestScore = 0;
  let isNewRecord = false;
  let recordSaved = false;
  let rewardPending = false;
  let rewardChapter = 0;
  let rewardOptions: ReadonlyArray<{
    kind: ChapterRewardKind;
    label: string;
    description: string;
  }> = [];
  let rewardEffects: ChapterRewardKind[] = [];
  let rewardEffectStartWave = 0;
  let rewardEffectEndWave = 0;
  let pendingDefeatWave = 0;
  let hp = 100;
  const playerPostureMax = 100;
  let playerPosture = playerPostureMax;
  let enemyHp = 100;
  let enemyMaxHp = 100;
  let enemyPostureMax = 80;
  let enemyPosture = enemyPostureMax;
  let enemyStaggerUntil = 0;
  let playerGuardBrokenUntil = 0;
  let wave = 1;
  let boss = false;
  let bossPhase: 1 | 2 = 1;
  let bossAttack = false;
  let bossDefeatPulse = 0;
  let enemyTargetX = 0;
  let enemyMoveAt = 0;
  let spearAttackSide = 0;
  let feintLane = 0;
  let feintApplied = false;
  let lastTelegraphedLane: Lane = 0;
  let enemyAttackCount = 0;
  let attackUntil = 0;
  let playerAttackStartedAt = 0;
  let playerAttackKind: PlayerAttackKind | null = null;
  let guardBreakImpactAt = 0;
  let guardUntil = 0;
  let guardStartedAt = 0;
  let lastEnemyStrike = 0;
  let counterUntil = 0;
  let counterPulse = 0;
  let message = "第1試練。左槍の予告を見て、右へ避けよ。";
  let paused = false;
  let pauseStartedAt = 0;
  let effectLevel =
    (localStorage.getItem(SETTINGS_STORAGE_KEYS.effectsLevel) as
      "full" | "reduced" | "minimal" | null) ?? "full";
  let defeated = false;
  let transitioning = false;
  let transitionRemaining = 0;
  let combo = 0;
  let maxCombo = 0;
  let comboMilestone = 0;
  let score = 0;
  let comboExpiresAt = 0;
  let climax = 0;
  const bestRecordKey = () => `yamabushi-best-${mode}-${difficulty}`;
  const loadBestScore = () => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(bestRecordKey()) ?? "null",
      ) as { score?: number } | null;
      return Number.isFinite(saved?.score) ? Math.max(0, saved?.score ?? 0) : 0;
    } catch {
      return 0;
    }
  };
  const rewardEffectActive = (kind: ChapterRewardKind) =>
    rewardEffects.includes(kind) &&
    wave >= rewardEffectStartWave &&
    wave <= rewardEffectEndWave;
  const scoreMultiplier = () =>
    rewardEffectActive("score-multiplier") ? 1.15 : 1;
  const parryWindow = () =>
    DIFFICULTY_CONFIG[difficulty].parryWindow +
    (rewardEffectActive("parry-window") ? 45 : 0);
  const enemyCooldown = () =>
    currentVariant.cooldown * DIFFICULTY_CONFIG[difficulty].cooldownMultiplier;
  const saveBestRecord = () => {
    if (recordSaved) return;
    const previousBest = loadBestScore();
    bestScore = previousBest;
    isNewRecord = score > previousBest;
    if (isNewRecord) {
      bestScore = score;
      try {
        localStorage.setItem(
          bestRecordKey(),
          JSON.stringify({
            score,
            maxCombo,
            defeatedCount,
            bossDefeats,
            seed: runSeed,
            playTimeMs: Math.round(activePlayTimeMs),
          }),
        );
      } catch {
        // Private browsing or a full storage quota must not stop the result screen.
      }
    }
    recordSaved = true;
  };
  let tutorialStep = tutorialVariantIndex(wave) ?? 0;
  let warningDuration = 620;
  let enemyAttackDuration = warningDuration + 260 + 470;
  let dodgeDirection = 1;
  let dodgeStartAt = 0;
  let dodgeUntil = 0;
  let dodgeFromX = 0;
  let dodgeFromZ = 0;
  let enemyAttackAt = 0;
  let enemyAttackHit = false;
  let enemyGuardUntil = 0;
  let nextGuardAt = performance.now() + 2600;
  let queuedAttackLanes: Lane[] = [];
  let forcedAttackReadyAt = 0;
  let lastNormalVariantIndex = 0;
  let lastBossVariantIndex = -1;
  const COMBO_WINDOW = 4200;
  const DODGE_DURATION = 360;
  const DODGE_SAFE_START = 120;
  const DODGE_SAFE_END = 300;
  let sheathUntil = 0;
  let recoilUntil = 0;
  let recoilDirection = 1;
  let lastFootstepAt = 0;
  let lastEnemyFootstepAt = 0;
  let previousEnemyX = 0;
  let nextAmbientAt = performance.now() + 1600;
  let audioContext: AudioContext | null = null;
  const getAudioContext = () => {
    const AudioCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return null;
    audioContext ??= new AudioCtor();
    if (audioContext.state === "suspended") void audioContext.resume();
    return audioContext;
  };
  const storedAudioSettings = readAudioSettings(localStorage);
  let masterVolume = storedAudioSettings.masterVolume;
  let effectsVolume = storedAudioSettings.effectsVolume;
  let ambientVolume = storedAudioSettings.ambientVolume;
  let audioMuted = storedAudioSettings.muted;
  type AudioCategory = "effects" | "ambient";
  const playTone = (
    frequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    pan = 0,
    category: AudioCategory = "effects",
  ) => {
    if (audioMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    const categoryVolume =
      category === "ambient" ? ambientVolume : effectsVolume;
    const scaledVolume = volume * masterVolume * categoryVolume;
    if (scaledVolume <= 0.0001) return;
    const start = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), start);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(35, endFrequency),
      start + duration,
    );
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.min(0.14, scaledVolume),
      start + 0.008,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  };
  const playSlashSound = (power: number) =>
    playTone(
      240 + power * 170,
      92,
      0.19 + power * 0.07,
      0.035 + power * 0.035,
      "sawtooth",
    );
  const playParrySound = (power = 1, direction = 1) => {
    const pan = direction < 0 ? -0.68 : 0.68;
    playTone(
      620 + power * 110,
      1450 + power * 180,
      0.11,
      0.09 + power * 0.025,
      "triangle",
      pan,
    );
    window.setTimeout(
      () =>
        playTone(
          980 + power * 130,
          440,
          0.08,
          0.045 + power * 0.02,
          "square",
          pan * 0.7,
        ),
      28,
    );
  };
  const playFootstep = (power = 0.6) =>
    playTone(82 + power * 18, 45, 0.11, 0.025 + power * 0.02, "sine");
  const enemyFootstepProfile = () => {
    switch (currentVariant.family) {
      case "獣型":
        return {
          frequency: 48,
          end: 28,
          duration: 0.24,
          volume: 0.07,
          type: "sine" as OscillatorType,
        };
      case "モンスター型":
        return {
          frequency: 58,
          end: 31,
          duration: 0.2,
          volume: 0.06,
          type: "triangle" as OscillatorType,
        };
      case "人型":
        return {
          frequency: 78,
          end: 42,
          duration: 0.13,
          volume: 0.038,
          type: "sine" as OscillatorType,
        };
      case "鳥型":
        return {
          frequency: 122,
          end: 64,
          duration: 0.09,
          volume: 0.025,
          type: "triangle" as OscillatorType,
        };
      case "モニュメント型":
        return {
          frequency: 39,
          end: 24,
          duration: 0.3,
          volume: 0.085,
          type: "sine" as OscillatorType,
        };
      default:
        return {
          frequency: 60,
          end: 34,
          duration: 0.16,
          volume: 0.045,
          type: "sine" as OscillatorType,
        };
    }
  };
  const playEnemyStepForVariant = (intensity = 1) => {
    const profile = enemyFootstepProfile();
    playTone(
      profile.frequency + intensity * 5,
      profile.end,
      profile.duration,
      profile.volume * intensity,
      profile.type,
    );
  };
  const playAmbientPulse = () => {
    if (ambientVolume <= 0.01) return;
    playTone(128, 74, 0.8, 0.012, "sine", -0.25, "ambient");
    window.setTimeout(() => {
      if (ambientVolume > 0.01)
        playTone(176, 92, 0.62, 0.009, "triangle", 0.32, "ambient");
    }, 180);
  };
  const launchPlayerSlash = (now: number, direction: number) => {
    if (slashProjectile) return;
    const slashMaterial = mat(
      scene,
      `flying_slash_${now}`,
      new Color3(0.95, 0.88, 0.7),
      1,
    );
    const arcPath = Array.from({ length: 13 }, (_, index) => {
      const t = index / 12;
      const x = (t - 0.5) * 1.7;
      const y = 0.34 + Math.sin(t * Math.PI) * 0.62;
      return new Vector3(x, y, 0);
    });
    slashProjectile = MeshBuilder.CreateTube(
      "flying_slash_arc",
      { path: arcPath, radius: 0.055, tessellation: 8 },
      scene,
    );
    slashProjectile.position = new Vector3(
      player.root.position.x,
      0.7,
      player.root.position.z - 0.45,
    );
    slashProjectile.material = slashMaterial;
    slashDirection = direction;
    slashBaseAngle = player.blade.rotation.z * 0.42 + direction * 0.18;
    slashAngle = slashBaseAngle;
    slashScale = 0.84 + slashPower * 0.34;
    slashProjectile.rotation.z = slashAngle;
    slashProjectile.scaling.set(
      slashScale * 1.18,
      slashScale,
      slashScale * 0.72,
    );
    slashImpactAt = now + attackTimingFor("normal").startup + 60;
    slashTargetX = enemy.root.position.x;
    slashTargetZ = enemy.root.position.z;
    message = "飛刃、霧を裂く。振り終わりまで動けない。";
    announce(state());
  };
  const enemyMoveLimit = () =>
    Math.min(
      1.25,
      Math.max(
        0.7,
        (engine.getRenderWidth() / Math.max(1, engine.getRenderHeight())) * 0.5,
      ),
    );
  const setEnemyVariant = (variant: EnemyVariant) => {
    enemy.body = enemy.bodies[variant.shape];
    enemy.bodies.forEach((body, index) => {
      body.isVisible = index === variant.shape;
    });
  };
  const setEnemyGlow = (isBoss: boolean) => {
    const glow = isBoss ? materials.bossGlow : materials.enemyGlow;
    enemy.bodies.forEach((body) => {
      body.material = glow;
    });
    enemy.eyes.forEach((eye) => {
      eye.material = glow;
    });
  };
  const setSpearState = (ready: boolean, extension = 0, activeSide = 0) => {
    const shaftMaterial = ready ? materials.spearReady : materials.iron;
    enemy.spears.forEach((spear, index) => {
      const side = index === 0 ? -1 : 1;
      const active = activeSide === 0 || side === activeSide;
      const amount = active ? extension : 0;
      spear.material = ready && active ? shaftMaterial : materials.iron;
      spear.scaling.z = 1 + amount * 1.8;
      spear.position.z = -0.62 - amount * 0.55;
      spear.position.x = side * 0.72;
    });
    enemy.spearTips.forEach((tip, index) => {
      const side = index === 0 ? -1 : 1;
      const active = activeSide === 0 || side === activeSide;
      const amount = active ? extension : 0;
      tip.material = ready && active ? shaftMaterial : materials.iron;
      tip.position.z = -1.28 - amount * 1.1;
      tip.position.x = side * 0.72;
    });
  };
  const state = (): State => {
    const stateNow = performance.now();
    const attackElapsed = enemyAttackAt ? stateNow - enemyAttackAt : 99999;
    const enemyPhase =
      enemyStaggerUntil > stateNow
        ? "大崩れ"
        : enemyGuardUntil > stateNow
          ? "防御"
          : !enemyAttackAt
            ? "巡回"
            : attackElapsed < warningDuration
              ? "予備"
              : attackElapsed < warningDuration + 260
                ? "攻撃"
                : attackElapsed <= enemyAttackDuration
                  ? "復帰"
                  : "巡回";
    let attackPhase = "待機";
    if (playerAttackKind && attackUntil > stateNow) {
      const timing = attackTimingFor(playerAttackKind);
      const elapsed = stateNow - playerAttackStartedAt;
      attackPhase =
        elapsed < timing.startup
          ? "振り始め"
          : elapsed < timing.startup + timing.active
            ? "命中"
            : "振り終わり";
    }

    return {
      mode,
      modeLimit,
      difficulty,
      seed: runSeed,
      chapter: chapterForWave(wave),
      hp,
      playerPosture,
      playerPostureMax,
      enemyHp,
      enemyMaxHp,
      enemyPosture,
      enemyPostureMax,
      wave,
      remainingEnemies: Math.max(0, modeLimit - wave + (enemyHp > 0 ? 1 : 0)),
      boss,
      bossPhase,
      bossDefeatPulse,
      enemyName: currentVariant.name,
      enemyEpithet: currentVariant.epithet,
      enemyFamily: currentVariant.family,
      enemyAttackStyle: enemyAttackAt
        ? bossAttack
          ? "wide"
          : dangerLane < 0
            ? "left"
            : dangerLane > 0
              ? "right"
              : "target"
        : currentVariant.attackSide,
      enemyPhase,
      stance:
        playerGuardBrokenUntil > stateNow
          ? "崩れ"
          : guardUntil > stateNow
            ? "防御"
            : attackUntil > stateNow
              ? "抜刀"
              : "静止",
      attackPhase,
      message,
      defeated,
      combo,
      maxCombo,
      score,
      comboTime: combo
        ? Math.max(0, comboExpiresAt - stateNow) / COMBO_WINDOW
        : 0,
      defeatedCount,
      bossDefeats,
      parrySuccesses,
      correctDodges,
      hitsTaken,
      whiffs,
      playTimeMs: Math.round(activePlayTimeMs),
      bestScore,
      isNewRecord,
      rewardPending,
      rewardChapter,
      rewardOptions,
      rewardEffects,
      climax,
      counterReady: counterUntil > stateNow,
      counterPulse,
      paused,
      transitioning,
      tutorialStep,
    };
  };

  bestScore = loadBestScore();
  paused = true;
  pauseStartedAt = performance.now();
  player.root.position.x = -0.9;
  dodgeFromX = player.root.position.x;
  dodgeFromZ = player.root.position.z;
  setEnemyVariant(currentVariant);
  setEnemyGlow(false);
  announce(state());
  const spawnNextEnemy = () => {
    wave += 1;
    boss = wave % 5 === 0;
    const tutorialIndex = tutorialVariantIndex(wave);
    tutorialStep = tutorialIndex === null ? 0 : wave;

    if (tutorialIndex !== null) {
      currentVariant = ENEMY_VARIANTS[tutorialIndex];
      lastNormalVariantIndex = tutorialIndex;
    } else {
      if (boss) {
        lastBossVariantIndex = chooseNonRepeatingIndex(
          bossPoolForWave(wave),
          lastBossVariantIndex,
          nextEncounterRandom(),
        );
        currentVariant = BOSS_VARIANTS[lastBossVariantIndex];
      } else {
        lastNormalVariantIndex = chooseNonRepeatingIndex(
          normalEnemyPoolForWave(wave),
          lastNormalVariantIndex,
          nextEncounterRandom(),
        );
        currentVariant = ENEMY_VARIANTS[lastNormalVariantIndex];
      }
    }

    setEnemyVariant(currentVariant);
    enemyMaxHp = boss ? 320 : 100;
    enemyHp = enemyMaxHp;
    enemyHitTaken = false;
    enemyPostureMax = boss ? 180 : 80;
    enemyPosture = enemyPostureMax;
    enemyStaggerUntil = 0;
    bossPhase = 1;
    defeated = false;
    transitioning = false;
    transitionRemaining = 0;
    bossAttack = false;
    enemyAttackAt = 0;
    enemyAttackHit = false;
    enemyAttackCount = 0;
    feintApplied = false;
    lastTelegraphedLane = 0;
    lastEnemyStrike = 0;
    attackUntil = 0;
    playerAttackStartedAt = 0;
    playerAttackKind = null;
    guardBreakImpactAt = 0;
    guardUntil = 0;
    guardStartedAt = 0;
    counterUntil = 0;
    dodgeUntil = 0;
    dodgeStartAt = 0;
    sheathUntil = 0;
    recoilUntil = 0;
    queuedAttackLanes = [];
    forcedAttackReadyAt = 0;
    const baseWarningDuration =
      wave === 3
        ? 980
        : wave <= 2
          ? 620
          : currentVariant.role === "heavy"
            ? 780
            : boss
              ? 620
              : 480;
    warningDuration = Math.round(
      baseWarningDuration * DIFFICULTY_CONFIG[difficulty].warningMultiplier,
    );
    enemyAttackDuration = warningDuration + 260 + 470;
    warningLine.isVisible = false;
    attackArea.isVisible = false;
    updateFootZones(false, 0);
    guardRing.isVisible = false;
    enemyGuardUntil = 0;
    nextGuardAt = performance.now() + 2200;
    enemy.root.scaling.setAll(boss ? 1.38 : 1);
    setEnemyGlow(boss);
    enemy.root.position.z = 5.2;
    enemy.root.position.y = 0.2;
    enemy.root.position.x = 0;
    enemyTargetX = 0;
    enemyMoveAt = performance.now() + 800;
    enemy.root.rotation.y = 0;
    enemy.blade.rotation.z = -0.7;
    setSpearState(false);
    if (tutorialIndex === 0) player.root.position.x = -0.9;
    else if (tutorialIndex === 1) player.root.position.x = 0.9;
    else if (tutorialIndex === 2) player.root.position.x = 0;
    dodgeFromX = player.root.position.x;
    dodgeFromZ = player.root.position.z;
    dodgeStartAt = 0;
    if (tutorialIndex === 0)
      message = "第1試練。左槍の予告を見て、右へ避けよ。";
    else if (tutorialIndex === 1)
      message = "第2試練。右槍の予告を見て、左へ避けよ。";
    else if (tutorialIndex === 2)
      message = "第3試練。直前に防御して受け流し、斬で反撃せよ。";
    else
      message = boss
        ? `${currentVariant.name}、来たる。構えの変化を見よ。`
        : currentVariant.notice;
    announce(state());
  };
  const pauseEvent = (event: Event) => {
    const nextPaused = Boolean(
      (event as CustomEvent<{ paused?: boolean }>).detail?.paused,
    );
    if (nextPaused === paused) {
      announce(state());
      return;
    }

    if (nextPaused) {
      paused = true;
      pauseStartedAt = performance.now();
      announce(state());
      return;
    }

    const now = performance.now();
    const delta = pauseStartedAt > 0 ? now - pauseStartedAt : 0;
    attackUntil = shiftActiveTimer(attackUntil, delta, pauseStartedAt);
    playerAttackStartedAt = shiftActiveTimer(playerAttackStartedAt, delta);
    guardBreakImpactAt = shiftActiveTimer(
      guardBreakImpactAt,
      delta,
      pauseStartedAt,
    );
    guardUntil = shiftActiveTimer(guardUntil, delta, pauseStartedAt);
    guardStartedAt = shiftActiveTimer(guardStartedAt, delta);
    lastEnemyStrike = shiftActiveTimer(lastEnemyStrike, delta);
    counterUntil = shiftActiveTimer(counterUntil, delta, pauseStartedAt);
    dodgeStartAt = shiftActiveTimer(dodgeStartAt, delta);
    dodgeUntil = shiftActiveTimer(dodgeUntil, delta, pauseStartedAt);
    enemyAttackAt = shiftActiveTimer(enemyAttackAt, delta);
    enemyGuardUntil = shiftActiveTimer(enemyGuardUntil, delta, pauseStartedAt);
    enemyStaggerUntil = shiftActiveTimer(
      enemyStaggerUntil,
      delta,
      pauseStartedAt,
    );
    playerGuardBrokenUntil = shiftActiveTimer(
      playerGuardBrokenUntil,
      delta,
      pauseStartedAt,
    );
    forcedAttackReadyAt = shiftActiveTimer(
      forcedAttackReadyAt,
      delta,
      pauseStartedAt,
    );
    nextGuardAt = shiftActiveTimer(nextGuardAt, delta, pauseStartedAt);
    enemyMoveAt = shiftActiveTimer(enemyMoveAt, delta, pauseStartedAt);
    comboExpiresAt = shiftActiveTimer(comboExpiresAt, delta, pauseStartedAt);
    sheathUntil = shiftActiveTimer(sheathUntil, delta, pauseStartedAt);
    recoilUntil = shiftActiveTimer(recoilUntil, delta, pauseStartedAt);
    slashImpactAt = shiftActiveTimer(slashImpactAt, delta, pauseStartedAt);
    shakeUntil = shiftActiveTimer(shakeUntil, delta, pauseStartedAt);
    hitStopUntil = shiftActiveTimer(hitStopUntil, delta, pauseStartedAt);
    nextAmbientAt = shiftActiveTimer(nextAmbientAt, delta, pauseStartedAt);
    paused = false;
    pauseStartedAt = 0;
    announce(state());
  };
  const rewardEvent = (event: Event) => {
    if (!rewardPending || pendingDefeatWave <= 0) return;
    const kind = (event as CustomEvent<{ kind?: ChapterRewardKind }>).detail
      ?.kind;
    if (!kind || !rewardOptions.some((option) => option.kind === kind)) return;

    rewardEffects = addChapterRewardEffect([], kind, 2);
    rewardEffectStartWave = pendingDefeatWave + 1;
    rewardEffectEndWave = Math.min(modeLimit, pendingDefeatWave + 10);
    if (kind === "heal") hp = Math.min(100, hp + 30);
    rewardPending = false;
    rewardOptions = [];
    rewardChapter = 0;
    pauseEvent(
      new CustomEvent("yamabushi-pause", { detail: { paused: false } }),
    );
    transitioning = true;
    transitionRemaining = boss ? 1400 : 700;
    message =
      "第" +
      chapterForWave(pendingDefeatWave + 1) +
      "章へ。" +
      (kind === "heal"
        ? "生命を整えた。"
        : kind === "parry-window"
          ? "見切りの間を得た。"
          : "得点の勢いを得た。");
    pendingDefeatWave = 0;
    announce(state());
  };
  const retireEvent = () => {
    if (defeated) return;
    transitioning = false;
    transitionRemaining = 0;
    defeated = true;
    paused = false;
    pauseStartedAt = 0;
    attackUntil = 0;
    playerAttackStartedAt = 0;
    playerAttackKind = null;
    guardBreakImpactAt = 0;
    guardUntil = 0;
    dodgeUntil = 0;
    counterUntil = 0;
    enemyAttackAt = 0;
    enemyGuardUntil = 0;
    queuedAttackLanes = [];
    forcedAttackReadyAt = 0;
    if (slashProjectile) {
      slashProjectile.dispose();
      slashProjectile = null;
    }
    warningLine.isVisible = false;
    attackArea.isVisible = false;
    updateFootZones(false, 0);
    setSpearState(false);
    rewardPending = false;
    rewardOptions = [];
    rewardChapter = 0;
    saveBestRecord();
    message = "修行を離れた。再起を選べる。";
    announce(state());
  };
  const effectsEvent = (event: Event) => {
    const next = (event as CustomEvent<{ level?: string }>).detail?.level;
    if (next === "full" || next === "reduced" || next === "minimal")
      effectLevel = next;
  };
  const audioEvent = (event: Event) => {
    const detail = (
      event as CustomEvent<{
        masterVolume?: number;
        effectsVolume?: number;
        ambientVolume?: number;
        muted?: boolean;
      }>
    ).detail;
    if (detail && typeof detail.masterVolume === "number")
      masterVolume = clampVolume(detail.masterVolume, masterVolume);
    if (detail && typeof detail.effectsVolume === "number")
      effectsVolume = clampVolume(detail.effectsVolume, effectsVolume);
    if (detail && typeof detail.ambientVolume === "number")
      ambientVolume = clampVolume(detail.ambientVolume, ambientVolume);
    if (detail && typeof detail.muted === "boolean") audioMuted = detail.muted;
  };
  const performanceEvent = (event: Event) => {
    const next = (event as CustomEvent<{ tier?: PerformanceTier }>).detail
      ?.tier;
    if (next === "high" || next === "balanced" || next === "lite")
      applyPerformanceTier(next);
  };
  const sideLimit = () =>
    Math.min(
      1.55,
      Math.max(
        0.82,
        (engine.getRenderWidth() / Math.max(1, engine.getRenderHeight())) *
          0.66,
      ),
    );
  const performDodge = (direction: number) => {
    const now = performance.now();
    if (
      paused ||
      defeated ||
      transitioning ||
      !canStartPlayerAction(now, [
        dodgeUntil,
        attackUntil,
        guardUntil,
        recoilUntil,
        playerGuardBrokenUntil,
      ])
    )
      return;
    dodgeDirection = direction < 0 ? -1 : 1;
    dodgeStartAt = now;
    dodgeUntil = now + DODGE_DURATION;
    dodgeFromX = player.root.position.x;
    dodgeFromZ = player.root.position.z;
    playFootstep(0.72);
    lastFootstepAt = now;
    message = dodgeDirection < 0 ? "左霞・身を沈める。" : "右閃・踏み流す。";
    announce(state());
  };
  const dodgeEvent = (event: Event) => {
    const direction = Number(
      (event as CustomEvent<{ direction?: number }>).detail?.direction ?? 1,
    );
    performDodge(direction);
  };
  const resolveEnemyDefeat = () => {
    if (enemyHp > 0 || transitioning || rewardPending || defeated) return;

    const defeatedWave = wave;
    const progress = defeatProgress(defeatedWave, modeLimit);
    const rewardMessages: string[] = [];

    defeatedCount += 1;
    if (boss) bossDefeats += 1;
    if (!enemyHitTaken) {
      score += Math.round((boss ? 600 : 220) * scoreMultiplier());
      rewardMessages.push("無傷撃破加算");
    }

    if (boss) {
      hp = Math.min(100, hp + 30);
      playerPosture = recoverPosture(playerPosture, 30, playerPostureMax);
      bossDefeatPulse += 1;
      rewardMessages.push("生命 +30・構え +30");
      showBossReward();
    }

    enemyAttackAt = 0;
    enemyAttackHit = false;
    enemyGuardUntil = 0;
    guardRing.isVisible = false;
    warningLine.isVisible = false;
    attackArea.isVisible = false;
    updateFootZones(false, 0);
    setSpearState(false);

    if (progress.chapterReward && progress.advances) {
      pendingDefeatWave = defeatedWave;
      rewardChapter = progress.chapterReward.chapter;
      rewardOptions = chapterRewardOptionsForDefeat(defeatedWave, modeLimit);
      rewardPending = rewardOptions.length > 0;
      paused = rewardPending;
      pauseStartedAt = rewardPending ? performance.now() : 0;
      message = "第" + rewardChapter + "章を越えた。次の章の修験を一つ選べ。";
      announce(state());
      return;
    }

    if (progress.advances) {
      transitioning = true;
      transitionRemaining = boss ? 1400 : 700;
      message =
        rewardMessages.length > 0
          ? currentVariant.name +
            "を断った。" +
            rewardMessages.join("。") +
            "。"
          : "敵影、断つ。次の気配を読む。";
    } else {
      if (whiffs === 0) {
        score += Math.round(350 * scoreMultiplier());
        rewardMessages.push("空振りなし加算");
      }
      defeated = true;
      saveBestRecord();
      message =
        rewardMessages.length > 0
          ? modeLimit + "体、すべて断つ。" + rewardMessages.join("。") + "。"
          : "敵影、断つ。";
    }
    announce(state());
  };
  const registerComboHit = (amount: number, now: number, points: number) => {
    const previousCombo = combo;
    combo += amount;
    maxCombo = Math.max(maxCombo, combo);
    const milestones = crossedComboMilestones(previousCombo, combo);
    if (milestones > 0) climax += milestones;
    comboExpiresAt = now + COMBO_WINDOW;
    score += scoreForCombo(points, combo, scoreMultiplier());
  };

  const clearEnemyAttackVisuals = () => {
    enemyAttackAt = 0;
    enemyAttackHit = false;
    warningLine.isVisible = false;
    attackArea.isVisible = false;
    updateFootZones(false, 0);
    setSpearState(false);
    enemy.root.position.z = 5.2;
    enemy.root.position.y = 0.2;
    enemy.root.rotation.y = 0;
    enemy.blade.rotation.z = -0.7;
  };

  const damageEnemyPosture = (kind: PlayerAttackKind, now: number) => {
    enemyPosture = Math.max(0, enemyPosture - enemyPostureDamageFor(kind));
    if (enemyPosture > 0 || enemyHp <= 0) return false;
    enemyStaggerUntil = now + (boss ? 2200 : 1800);
    enemyGuardUntil = 0;
    guardRing.isVisible = false;
    queuedAttackLanes = [];
    forcedAttackReadyAt = 0;
    clearEnemyAttackVisuals();
    return true;
  };

  const refreshBossPhase = (now: number) => {
    const nextPhase = boss ? bossPhaseForHealth(enemyHp, enemyMaxHp) : 1;
    if (nextPhase === bossPhase || enemyHp <= 0) return false;
    bossPhase = nextPhase;
    enemyStaggerUntil = Math.max(enemyStaggerUntil, now + 900);
    enemyGuardUntil = 0;
    guardRing.isVisible = false;
    queuedAttackLanes = [];
    forcedAttackReadyAt = 0;
    clearEnemyAttackVisuals();
    return true;
  };

  const beginPlayerAttack = (kind: PlayerAttackKind, now: number) => {
    const timing = attackTimingFor(kind);
    playerAttackKind = kind;
    playerAttackStartedAt = now;
    attackUntil = now + timing.total;
    sheathUntil = attackUntil;
    guardUntil = 0;
    dodgeUntil = 0;
    player.blade.rotation.z = -1.35;
    slashPower = Math.min(
      1.8,
      Math.max(
        0.65,
        Math.abs(player.blade.rotation.z - previousBladeAngle) / 0.7,
      ),
    );
    player.rightArm.rotation.z = -0.72;
    player.leftArm.rotation.z = 0.48;
    player.torso.rotation.z = -0.08;
  };

  const resolveGuardBreak = (now: number) => {
    if (!guardBreakImpactAt || now < guardBreakImpactAt) return;
    guardBreakImpactAt = 0;
    if (enemyHp <= 0 || transitioning || defeated) return;
    if (enemyGuardUntil <= now) {
      message = "防御崩しが空を切った。振り終わりは動けない。";
      announce(state());
      return;
    }

    enemyGuardUntil = 0;
    guardRing.isVisible = false;
    nextGuardAt = now + 2600;
    enemyHp = applyDamage(enemyHp, boss ? 6 : 8).hp;
    const direction = player.root.position.x <= enemy.root.position.x ? -1 : 1;
    showGuardBreak(direction);
    showEnemyHit(
      player.root.position.x,
      player.root.position.z,
      direction,
      direction * 0.5,
      1.15,
    );
    const staggered = damageEnemyPosture("guard-break", now);
    playerPosture = recoverPosture(playerPosture, 10, playerPostureMax);
    const phaseChanged = refreshBossPhase(now);
    message = !enemyHp
      ? "守りごと断つ。"
      : staggered
        ? "防御崩し。敵の構えが砕けた。強い一閃を。"
        : phaseChanged
          ? "防御を崩し、後半の型を引き出した。"
          : "防御を崩した。敵の構えを大きく削った。";
    registerComboHit(1, now, 180);
    if (!enemyHp) resolveEnemyDefeat();
    announce(state());
  };

  const resolvePlayerSlash = (
    now: number,
    direction: number,
    impactAngle = direction * 0.42,
    impactScale = 1,
  ) => {
    if (enemyHp <= 0 || transitioning || defeated) return;
    sheathUntil = now + 620;

    if (Math.abs(enemy.root.position.x - slashTargetX) > 0.72) {
      whiffs += 1;
      message = "空を斬った。残心を保て。";
      counterUntil = 0;
      announce(state());
      return;
    }

    if (enemyGuardUntil > now) {
      counterUntil = 0;
      recoilUntil = now + 620;
      attackUntil = Math.max(attackUntil, now + 620);
      sheathUntil = Math.max(sheathUntil, now + 620);
      recoilDirection = direction < 0 ? -1 : 1;
      enemyGuardUntil = 0;
      guardRing.isVisible = false;
      lastEnemyStrike = now - enemyCooldown() + 220;
      message = "通常斬撃を青輪に弾かれた。敵の反撃が来る。";
      announce(state());
      return;
    }

    enemyHp = applyDamage(enemyHp, boss ? 16 : 22).hp;
    const staggered = damageEnemyPosture("normal", now);
    playerPosture = recoverPosture(playerPosture, 7, playerPostureMax);
    const phaseChanged = refreshBossPhase(now);
    showEnemyHit(
      player.root.position.x,
      player.root.position.z,
      direction,
      impactAngle,
      impactScale,
    );
    message = !enemyHp
      ? "敵影、断つ。"
      : staggered
        ? "敵の構えが砕けた。大崩れの間に斬れ。"
        : phaseChanged
          ? "体力半ば。前半の型を組み合わせてくる。"
          : boss
            ? "飛刃命中。体力だけでなく構えも削れ。"
            : "飛刃命中。振り終わりに備えよ。";
    registerComboHit(1, now, 100);
    if (!enemyHp) resolveEnemyDefeat();
    announce(state());
  };
  const resetRun = (event: Event) => {
    const detail = (
      event as CustomEvent<{
        mode?: RunMode;
        difficulty?: Difficulty;
        seed?: number;
      }>
    ).detail;
    if (
      detail?.mode === "ten" ||
      detail?.mode === "twenty-five" ||
      detail?.mode === "fifty"
    ) {
      mode = detail.mode;
      modeLimit = modeLimitFor(mode);
    }
    if (
      detail?.difficulty === "apprentice" ||
      detail?.difficulty === "standard" ||
      detail?.difficulty === "dark"
    )
      difficulty = detail.difficulty;
    runSeed =
      Number.isFinite(detail?.seed) && detail?.seed !== undefined
        ? normalizeSeed(detail.seed)
        : makeRunSeed();
    encounterRandomSeed = runSeed;
    combatRandomSeed = normalizeSeed(runSeed ^ 0x9e3779b9);
    bestScore = loadBestScore();
    isNewRecord = false;
    recordSaved = false;
    getAudioContext();
    if (slashProjectile) {
      slashProjectile.dispose();
      slashProjectile = null;
    }

    hp = 100;
    playerPosture = playerPostureMax;
    enemyHp = 100;
    enemyMaxHp = 100;
    enemyPostureMax = 80;
    enemyPosture = enemyPostureMax;
    defeatedCount = 0;
    bossDefeats = 0;
    parrySuccesses = 0;
    correctDodges = 0;
    hitsTaken = 0;
    whiffs = 0;
    activePlayTimeMs = 0;
    enemyHitTaken = false;
    enemyStaggerUntil = 0;
    playerGuardBrokenUntil = 0;
    wave = 1;
    boss = false;
    bossPhase = 1;
    bossAttack = false;
    bossDefeatPulse = 0;
    enemyTargetX = 0;
    enemyMoveAt = performance.now() + 800;
    spearAttackSide = 0;
    feintLane = 0;
    feintApplied = false;
    lastTelegraphedLane = 0;
    enemyAttackCount = 0;
    attackUntil = 0;
    playerAttackStartedAt = 0;
    playerAttackKind = null;
    guardBreakImpactAt = 0;
    guardUntil = 0;
    guardStartedAt = 0;
    lastEnemyStrike = 0;
    counterUntil = 0;
    counterPulse = 0;
    defeated = false;
    transitioning = false;
    transitionRemaining = 0;
    combo = 0;
    maxCombo = 0;
    comboMilestone = 0;
    score = 0;
    comboExpiresAt = 0;
    climax = 0;
    rewardPending = false;
    rewardChapter = 0;
    rewardOptions = [];
    rewardEffects = [];
    rewardEffectStartWave = 0;
    rewardEffectEndWave = 0;
    pendingDefeatWave = 0;
    tutorialStep = 1;
    warningDuration = Math.round(
      620 * DIFFICULTY_CONFIG[difficulty].warningMultiplier,
    );
    enemyAttackDuration = warningDuration + 260 + 470;
    dodgeDirection = 1;
    dodgeStartAt = 0;
    dodgeUntil = 0;
    dodgeFromX = 0;
    dodgeFromZ = 0;
    enemyAttackAt = 0;
    enemyAttackHit = false;
    enemyGuardUntil = 0;
    nextGuardAt = performance.now() + 2600;
    queuedAttackLanes = [];
    forcedAttackReadyAt = 0;
    lastNormalVariantIndex = 0;
    lastBossVariantIndex = -1;
    sheathUntil = 0;
    recoilUntil = 0;
    slashImpactAt = 0;
    slashDirection = 1;
    slashAngle = 0;
    slashBaseAngle = 0;
    slashPower = 1;
    slashScale = 1;
    previousBladeAngle = -0.65;
    slashTargetX = 0;
    slashTargetZ = 5.2;
    shakeUntil = 0;
    hitStopUntil = 0;
    lastFootstepAt = 0;
    lastEnemyFootstepAt = 0;
    previousEnemyX = 0;
    nextAmbientAt = performance.now() + 1600;
    paused = false;
    pauseStartedAt = 0;
    currentVariant = ENEMY_VARIANTS[0];
    setEnemyVariant(currentVariant);
    setEnemyGlow(false);
    enemy.root.scaling.setAll(1);
    enemy.root.position.x = 0;
    enemy.root.position.z = 5.2;
    enemy.root.position.y = 0.2;
    enemy.root.rotation.y = 0;
    enemy.blade.rotation.z = -0.7;
    setSpearState(false);
    warningLine.isVisible = false;
    attackArea.isVisible = false;
    updateFootZones(false, 0);
    guardRing.isVisible = false;
    player.root.position.x = -0.9;
    player.root.position.z = 0;
    player.root.rotation.set(0, 0, 0);
    player.root.scaling.setAll(1);
    player.blade.rotation.z = -0.65;
    player.rightArm.rotation.z = -0.16;
    player.leftArm.rotation.z = 0.16;
    player.torso.rotation.z = 0;
    dodgeFromX = player.root.position.x;
    message = "第1試練。左槍の予告を見て、右へ避けよ。";
    announce(state());
  };

  const keydown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (event.repeat) return;
    if (key === "r") {
      resetRun(new CustomEvent("yamabushi-restart"));
      return;
    }
    if (paused || transitioning || defeated) return;
    const now = performance.now();

    if (key === "j") {
      if (
        slashProjectile ||
        enemyHp <= 0 ||
        !canStartPlayerAction(now, [
          attackUntil,
          guardUntil,
          dodgeUntil,
          recoilUntil,
          playerGuardBrokenUntil,
        ])
      )
        return;
      const direction =
        player.root.position.x <= enemy.root.position.x ? -1 : 1;

      if (enemyStaggerUntil > now && counterUntil <= now) {
        beginPlayerAttack("finisher", now);
        enemyStaggerUntil = 0;
        enemyPosture = Math.ceil(enemyPostureMax * 0.55);
        enemyHp = applyDamage(enemyHp, boss ? 38 : 44).hp;
        playerPosture = recoverPosture(playerPosture, 18, playerPostureMax);
        showCounterHit(direction);
        showEnemyHit(
          player.root.position.x,
          player.root.position.z,
          direction,
          direction * 0.58,
          1.35,
        );
        const phaseChanged = refreshBossPhase(now);
        message = !enemyHp
          ? "大崩れへ決め、敵影を断った。"
          : phaseChanged
            ? "崩れへ強撃。ボスが後半の型へ移る。"
            : "大崩れへ強撃。敵の構えが戻る前に次を読め。";
        registerComboHit(1, now, 260);
        if (!enemyHp) resolveEnemyDefeat();
        announce(state());
        return;
      }

      if (counterUntil > now && enemyHp > 0) {
        beginPlayerAttack("counter", now);
        counterUntil = 0;
        enemyHp = applyDamage(enemyHp, boss ? 30 : 34).hp;
        const staggered = damageEnemyPosture("counter", now);
        playerPosture = recoverPosture(playerPosture, 20, playerPostureMax);
        const phaseChanged = refreshBossPhase(now);
        showCounterHit(direction);
        showEnemyHit(
          player.root.position.x,
          player.root.position.z,
          direction,
          direction * 0.42,
          1.2,
        );
        message = !enemyHp
          ? "受け流しからの反撃で断った。"
          : staggered
            ? "反撃斬りで敵の構えを砕いた。"
            : phaseChanged
              ? "反撃斬り。ボスが後半の型へ移る。"
              : "受け流しからの反撃・" + (combo + 1) + "連撃。";
        counterPulse += 1;
        registerComboHit(1, now, 220);
        if (!enemyHp) resolveEnemyDefeat();
        announce(state());
        return;
      }

      if (enemyGuardUntil > now) {
        beginPlayerAttack("guard-break", now);
        counterUntil = 0;
        guardBreakImpactAt = now + attackTimingFor("guard-break").startup;
        playSlashSound(0.9);
        message = "防御崩しを溜める。遅い振り始めは無防備。";
        announce(state());
        return;
      }

      if (
        Vector3.Distance(player.root.position, enemy.root.position) < 6 &&
        enemyHp > 0
      ) {
        beginPlayerAttack("normal", now);
        playFootstep(Math.min(1.2, slashPower * 0.75));
        playSlashSound(slashPower);
        launchPlayerSlash(now, direction);
      }
    }

    if (key === "k") {
      if (
        !canStartPlayerAction(now, [
          guardUntil,
          attackUntil,
          dodgeUntil,
          recoilUntil,
          playerGuardBrokenUntil,
        ])
      )
        return;
      if (playerPosture <= 0) {
        message = "構えが尽きている。間を置くか、攻撃を当てて整えよ。";
        announce(state());
        return;
      }
      guardUntil = now + 520;
      guardStartedAt = now;
      player.root.scaling.y = 0.96;
      player.root.rotation.y = 0.04;
      player.rightArm.rotation.z = -0.58;
      player.rightArm.rotation.y = -0.34;
      player.leftArm.rotation.z = 0.46;
      player.leftArm.rotation.y = 0.22;
      player.blade.rotation.z = -0.18;
      player.torso.rotation.z = 0.035;
      player.leftLeg.rotation.z = -0.045;
      player.rightLeg.rotation.z = 0.045;
      message = "刃を中心へ。直前なら受け流しになる。";
      announce(state());
    }

    if (event.key === "Shift") performDodge(1);
  };
  window.addEventListener("keydown", keydown);
  window.addEventListener("yamabushi-dodge", dodgeEvent);
  window.addEventListener("yamabushi-pause", pauseEvent);
  window.addEventListener("yamabushi-reward", rewardEvent);
  window.addEventListener("yamabushi-effects", effectsEvent);
  window.addEventListener("yamabushi-audio", audioEvent);
  window.addEventListener("yamabushi-performance", performanceEvent);
  window.addEventListener("yamabushi-retire", retireEvent);
  window.addEventListener("yamabushi-restart", resetRun);
  window.addEventListener("yamabushi-start", resetRun);
  const observer = scene.onBeforeRenderObservable.add(() => {
    const now = performance.now();
    const dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    if (!paused && !defeated) activePlayTimeMs += dt * 1000;
    if (
      !paused &&
      !transitioning &&
      now > nextAmbientAt &&
      !enemyAttackAt &&
      enemyGuardUntil <= now &&
      !defeated
    ) {
      playAmbientPulse();
      nextAmbientAt = now + 5200;
    }
    const enemyStepDelta = Math.abs(enemy.root.position.x - previousEnemyX);
    if (
      !paused &&
      enemyStepDelta > 0.002 &&
      now - lastEnemyFootstepAt > 360 &&
      !enemyAttackAt &&
      enemyGuardUntil <= now
    ) {
      playEnemyStepForVariant(boss ? 1.2 : 0.82);
      lastEnemyFootstepAt = now;
    }
    previousEnemyX = enemy.root.position.x;
    const bladeVelocity =
      (player.blade.rotation.z - previousBladeAngle) / Math.max(0.001, dt);
    const bladeDelta = Math.abs(player.blade.rotation.z - previousBladeAngle);
    const bladeAngularSpeed = Math.min(
      1.8,
      bladeDelta / Math.max(0.001, dt) / 5.5,
    );
    previousBladeAngle = player.blade.rotation.z;
    if (attackUntil > now)
      slashPower = Math.max(
        slashPower,
        Math.min(1.8, 0.65 + bladeAngularSpeed),
      );
    if (paused || now < hitStopUntil) return;
    resolveGuardBreak(now);
    if (playerAttackKind && attackUntil <= now) {
      playerAttackKind = null;
      playerAttackStartedAt = 0;
    }
    if (
      playerPosture < playerPostureMax &&
      guardUntil <= now &&
      attackUntil <= now &&
      playerGuardBrokenUntil <= now
    ) {
      playerPosture = Math.min(playerPostureMax, playerPosture + dt * 6);
    }
    if (
      enemyStaggerUntil > 0 &&
      enemyStaggerUntil <= now &&
      enemyPosture === 0 &&
      enemyHp > 0
    ) {
      enemyStaggerUntil = 0;
      enemyPosture = Math.ceil(enemyPostureMax * 0.45);
      message = "敵が構えを立て直した。次の予告を読め。";
      announce(state());
    }
    if (transitioning) {
      if (combo > 0) comboExpiresAt += dt * 1000;
      transitionRemaining -= dt * 1000;
      if (transitionRemaining <= 0) spawnNextEnemy();
      return;
    }
    if (now < shakeUntil) {
      const pulse = (shakeUntil - now) / 220;
      camera.position.x = cameraHome.x + Math.sin(now * 0.11) * pulse * 0.08;
      camera.position.y = cameraHome.y + Math.cos(now * 0.13) * pulse * 0.04;
    } else {
      camera.position.x = cameraHome.x;
      camera.position.y = cameraHome.y;
    }
    if (dodgeUntil > now) {
      const progress = Math.min(1, (now - dodgeStartAt) / DODGE_DURATION);
      if (progress > 0.42 && lastFootstepAt <= dodgeStartAt) {
        playFootstep(0.58);
        lastFootstepAt = now;
      }
      const eased =
        progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const arc = Math.sin(progress * Math.PI);
      const direction = dodgeDirection;
      player.root.position.x = Math.max(
        -sideLimit(),
        Math.min(sideLimit(), dodgeFromX + direction * 0.85 * eased),
      );
      player.root.position.z = dodgeFromZ - arc * 0.28;
      player.root.rotation.y = direction * (0.22 + arc * 0.18);
      player.root.rotation.z = -direction * arc * 0.12;
      player.root.scaling.y = 1 - arc * 0.12;
      player.leftLeg.rotation.z = direction * arc * 0.18;
      player.rightLeg.rotation.z = -direction * arc * 0.14;
      player.leftArm.rotation.z = 0.5 + direction * arc * 0.3;
      player.rightArm.rotation.z = -0.5 + direction * arc * 0.22;
      player.torso.rotation.z = -direction * arc * 0.1;
      player.blade.rotation.z = -0.65 + direction * 0.5 + arc * 0.25;
    } else if (dodgeStartAt > 0 && dodgeUntil <= now) {
      player.root.position.z = dodgeFromZ;
      player.root.rotation.z = 0;
      player.root.scaling.y = 1;
      player.leftLeg.rotation.z = 0;
      player.rightLeg.rotation.z = 0;
      player.leftArm.rotation.z = 0.16;
      player.rightArm.rotation.z = -0.16;
      player.torso.rotation.z = 0;
      player.blade.rotation.z = -0.65;
      dodgeStartAt = 0;
    }
    if (slashProjectile && now < slashImpactAt) {
      const travelDuration = attackTimingFor("normal").startup + 60;
      const progress = Math.min(
        1,
        Math.max(0, (now - (slashImpactAt - travelDuration)) / travelDuration),
      );
      const travelProgress = 1 - Math.pow(1 - progress, 3);
      slashProjectile.position.x =
        player.root.position.x +
        (slashTargetX - player.root.position.x) * travelProgress;
      slashProjectile.position.z =
        player.root.position.z -
        0.45 +
        (slashTargetZ - player.root.position.z + 0.45) * travelProgress;
      slashAngle =
        slashBaseAngle +
        slashDirection * (0.12 + Math.sin(travelProgress * Math.PI) * 0.32);
      slashProjectile.rotation.z = slashAngle;
      const travelScale =
        (0.72 + travelProgress * 0.28) * (0.82 + slashPower * 0.2);
      slashProjectile.scaling.set(
        travelScale * 1.18,
        travelScale,
        travelScale * 0.72,
      );
    } else if (slashProjectile && now >= slashImpactAt) {
      const projectile = slashProjectile;
      slashProjectile = null;
      projectile.dispose();
      resolvePlayerSlash(now, slashDirection, slashAngle, slashScale);
    }
    if (!defeated && !transitioning && enemyHp > 0) {
      const attackElapsed = enemyAttackAt ? now - enemyAttackAt : 0;
      const hasQueuedAttack = queuedAttackLanes.length > 0;
      if (
        !enemyAttackAt &&
        enemyGuardUntil <= now &&
        enemyStaggerUntil <= now &&
        (hasQueuedAttack
          ? now >= forcedAttackReadyAt
          : now - lastEnemyStrike > enemyCooldown())
      ) {
        lastEnemyStrike = now;
        playEnemyStepForVariant(boss ? 1.45 : 1);
        enemyAttackAt = now;
        enemyTargetX = player.root.position.x;
        enemyAttackHit = false;
        enemyAttackCount += 1;
        const forcedLane = hasQueuedAttack ? queuedAttackLanes.shift() : null;
        const attackPlan =
          forcedLane === null || forcedLane === undefined
            ? enemyAttackPlanFor(
                currentVariant.role,
                enemyAttackCount,
                player.root.position.x,
                tutorialStep,
              )
            : {
                dangerLane: forcedLane,
                spearSide: forcedLane,
                isWide: false,
              };
        if (boss && currentVariant.family === "鳥型") {
          enemyTargetX =
            forcedLane !== null && forcedLane !== undefined
              ? forcedLane * enemyMoveLimit()
              : enemyAttackCount % 2 === 0
                ? -enemyMoveLimit()
                : enemyMoveLimit();
          attackPlan.dangerLane = enemyTargetX < 0 ? -1 : 1;
          attackPlan.spearSide = attackPlan.dangerLane;
        }
        bossAttack = attackPlan.isWide;
        spearAttackSide = attackPlan.spearSide;
        dangerLane = attackPlan.dangerLane;
        lastTelegraphedLane = dangerLane as Lane;
        feintApplied = false;
        if (forcedLane === null || forcedLane === undefined) {
          queuedAttackLanes = followUpLanesFor(
            currentVariant.role,
            currentVariant.family,
            dangerLane as Lane,
            bossPhase,
          );
        }
        feintLane =
          dangerLane === 0
            ? player.root.position.x < 0
              ? 1
              : -1
            : -dangerLane;
        warningLine.material = bossAttack
          ? laneMaterials.center
          : dangerLane < 0
            ? laneMaterials.left
            : dangerLane > 0
              ? laneMaterials.right
              : laneMaterials.center;
        warningLine.isVisible = true;
        warningLine.position.x = dangerLane * 0.9;
        warningLine.position.z = 2.4;
        warningLine.scaling.x = 0.75;
        attackArea.isVisible = true;
        attackArea.position.x = dangerLane * 0.9;
        attackArea.scaling.x = bossAttack
          ? 1.65
          : currentVariant.family === "モンスター型"
            ? 1.2
            : 1;
        attackAreaMaterial.alpha = bossAttack ? 0.34 : 0.24;
        const familyCue =
          currentVariant.family === "獣型"
            ? "獣影が距離を詰める。"
            : currentVariant.family === "モンスター型"
              ? "異形の範囲が膨らむ。"
              : currentVariant.family === "人型"
                ? "人の型、予告の後で変わる。"
                : currentVariant.family === "鳥型"
                  ? "翼が跳ねる。急降下に備えよ。"
                  : currentVariant.family === "モニュメント型"
                    ? "石門が地を覆う。広く退け。"
                    : "";
        message =
          forcedLane !== null && forcedLane !== undefined
            ? "追撃の予告。先ほどと別の危険線を見よ。"
            : boss
              ? `${familyCue} ${currentVariant.notice}`
              : currentVariant.notice;
        announce(state());
      }
      if (!enemyAttackAt || attackElapsed > enemyAttackDuration) {
        guardRing.isVisible = enemyGuardUntil > now;
        guardRing.scaling.setAll(1 + 0.08 * Math.sin(now * 0.012));
        if (
          enemyGuardUntil <= now &&
          enemyStaggerUntil <= now &&
          queuedAttackLanes.length === 0 &&
          tutorialStep === 0 &&
          now >= nextGuardAt &&
          enemyHp > 0
        ) {
          enemyGuardUntil = now + (boss ? 1050 : 780);
          nextGuardAt = now + (boss ? 3000 : 2200) + nextCombatRandom() * 1200;
          counterUntil = 0;
          message = "敵影が刃を伏せた。防御中。";
          announce(state());
        }
        if (
          enemyStaggerUntil <= now &&
          currentVariant.family !== "モニュメント型" &&
          now > enemyMoveAt
        ) {
          enemyTargetX = (nextCombatRandom() * 2 - 1) * enemyMoveLimit();
          enemyMoveAt = now + 850 + nextCombatRandom() * 1050;
        }
        if (enemyStaggerUntil <= now) {
          if (currentVariant.family === "モニュメント型") enemyTargetX = 0;
          enemy.root.position.x +=
            (enemyTargetX - enemy.root.position.x) * Math.min(1, dt * 2.4);
          enemy.root.rotation.y += dt * 0.25;
        }
        setSpearState(false);
        if (enemyGuardUntil > now) {
          enemy.blade.rotation.z = -0.35;
          enemy.root.rotation.y = Math.sin(now * 0.02) * 0.08;
        }
      }
      if (enemyAttackAt && attackElapsed <= enemyAttackDuration) {
        const windup = Math.min(1, attackElapsed / warningDuration);
        const strike = Math.max(
          0,
          Math.min(1, (attackElapsed - warningDuration) / 260),
        );
        const recover = Math.max(
          0,
          Math.min(1, (attackElapsed - warningDuration - 260) / 470),
        );
        if (attackElapsed < warningDuration) {
          if (
            currentVariant.role === "tracking" &&
            attackElapsed < warningDuration * 0.55
          ) {
            const trackedPlan = enemyAttackPlanFor(
              "tracking",
              enemyAttackCount,
              player.root.position.x,
            );
            const trackedLane = trackedPlan.dangerLane;
            dangerLane = trackedPlan.dangerLane;
            spearAttackSide = trackedPlan.spearSide;
            warningLine.position.x = dangerLane * 0.9;
            attackArea.position.x = dangerLane * 0.9;
            warningLine.material =
              dangerLane < 0
                ? laneMaterials.left
                : dangerLane > 0
                  ? laneMaterials.right
                  : laneMaterials.center;
            if (trackedLane !== lastTelegraphedLane) {
              lastTelegraphedLane = trackedLane;
              message = "追尾線が動いている。線が止まるまで待て。";
              announce(state());
            }
          }
          if (
            boss &&
            currentVariant.family === "人型" &&
            attackElapsed >= warningDuration * 0.55 &&
            !feintApplied
          ) {
            feintApplied = true;
            dangerLane = feintLane;
            spearAttackSide = dangerLane;
            lastTelegraphedLane = dangerLane as Lane;
            warningLine.position.x = dangerLane * 0.9;
            attackArea.position.x = dangerLane * 0.9;
            warningLine.material =
              dangerLane < 0
                ? laneMaterials.left
                : dangerLane > 0
                  ? laneMaterials.right
                  : laneMaterials.center;
            message = "予告が一度だけ返った。今見えている線が真。";
            announce(state());
          }
          warningLine.isVisible = true;
          if (attackElapsed >= 150) updateFootZones(true, dangerLane);
          else updateFootZones(false, 0);
          const blink = Math.floor(attackElapsed / 105) % 2 === 0;
          setSpearState(
            blink,
            0.12 + 0.04 * (0.5 + 0.5 * Math.sin(now * 0.03)),
            spearAttackSide,
          );
          attackArea.isVisible = blink || attackElapsed > 210;
          attackArea.scaling.x =
            currentVariant.family === "モンスター型"
              ? 1 + windup * (bossPhase === 2 ? 0.85 : 0.65)
              : bossAttack
                ? 1.65
                : 1;
          attackAreaMaterial.alpha =
            (blink ? 0.38 : 0.12) + (attackElapsed > 210 ? 0.14 : 0);
          warningLine.scaling.x =
            0.82 + 0.18 * (0.5 + 0.5 * Math.sin(now * 0.025));
          enemy.root.rotation.y = -0.18 * windup;
          enemy.blade.rotation.z = -0.7 - 0.55 * windup;
          if (boss && currentVariant.family === "鳥型") {
            enemy.root.position.x +=
              (enemyTargetX - enemy.root.position.x) * Math.min(1, dt * 5.5);
            enemy.root.position.y =
              0.2 + Math.sin(windup * Math.PI * 0.7) * 0.9;
          }
        } else if (attackElapsed < warningDuration + 260) {
          warningLine.isVisible = false;
          attackArea.isVisible = true;
          attackAreaMaterial.alpha = 0.52;
          setSpearState(
            true,
            bossAttack ? 3.25 : 3.25 * Math.min(1, strike * 1.2),
            spearAttackSide,
          );
          enemy.root.position.z =
            5.2 - (currentVariant.family === "獣型" ? 1.25 : 0.65) * strike;
          if (boss && currentVariant.family === "鳥型") {
            enemy.root.position.y = 1.05 - 0.85 * strike;
          }
          enemy.root.rotation.y = -0.18 + 0.5 * strike;
          enemy.blade.rotation.z = -1.25 + 2.35 * strike;
          if (attackElapsed > 460 && message !== "岩刃、振り抜く。") {
            message = "岩刃、振り抜く。";
            announce(state());
          }
        } else {
          attackArea.isVisible = recover < 0.55;
          attackAreaMaterial.alpha = Math.max(0, 0.52 * (1 - recover));
          setSpearState(false, Math.max(0, 1 - recover), spearAttackSide);
          enemy.root.position.z = 4.55 + 0.65 * recover;
          if (boss && currentVariant.family === "鳥型") {
            enemy.root.position.y = 0.2;
          }
          enemy.root.rotation.y = 0.32 * (1 - recover);
          enemy.blade.rotation.z = 1.1 - 1.8 * recover;
        }
        if (!enemyAttackHit && attackElapsed >= warningDuration + 230) {
          enemyAttackHit = true;
          const hitWidth =
            currentVariant.family === "モンスター型"
              ? bossPhase === 2
                ? 1.48
                : 1.3
              : 0.8;
          const inLine =
            bossAttack ||
            Math.abs(player.root.position.x - dangerLane * 0.9) < hitWidth;
          const isParryWindow =
            guardUntil >= now &&
            guardStartedAt > 0 &&
            now - guardStartedAt <= parryWindow();
          const dodgeElapsed = now - dodgeStartAt;
          const dodgeInSafety =
            dodgeUntil >= now &&
            dodgeElapsed >= DODGE_SAFE_START &&
            dodgeElapsed <= DODGE_SAFE_END;
          const dodgeSafe =
            dodgeInSafety &&
            (!inLine ||
              correctDodgeForLane(
                dodgeDirection as -1 | 1,
                dangerLane as -1 | 0 | 1,
                bossAttack,
              ));

          if (inLine && isParryWindow) {
            showGuardSpark(dangerLane || 1);
            counterUntil = now + 900;
            parrySuccesses += 1;
            playerPosture = recoverPosture(playerPosture, 20, playerPostureMax);
            const staggered = damageEnemyPosture("counter", now);
            score += Math.round(260 * scoreMultiplier());
            message = staggered
              ? "受け流しで敵の構えを砕いた。反撃を。"
              : "青白く、受け流した。反撃を。";
          } else if (inLine && guardUntil >= now) {
            counterUntil = 0;
            const pressure =
              currentVariant.role === "heavy"
                ? 52
                : boss
                  ? bossPhase === 2
                    ? 40
                    : 34
                  : 28;
            const guarded = postureAfterGuard(playerPosture, pressure);
            playerPosture = guarded.posture;
            if (guarded.broken) {
              guardUntil = 0;
              playerGuardBrokenUntil = now + 900;
              recoilUntil = Math.max(recoilUntil, now + 900);
              triggerImpact(dangerLane || 1, 0.1);
              hp = applyDamage(hp, 10).hp;
              message = hp
                ? "構えを砕かれた。短い間、防御も回避もできない。"
                : "防御を崩され、倒れた。";
              if (!hp) {
                defeated = true;
                saveBestRecord();
                queuedAttackLanes = [];
                clearEnemyAttackVisuals();
                if (slashProjectile) {
                  slashProjectile.dispose();
                  slashProjectile = null;
                }
              }
            } else {
              message = `防御で受け止めた。構え残り ${Math.ceil(playerPosture)}。`;
            }
          } else if (!inLine || dodgeSafe) {
            const correctDodge =
              dodgeInSafety &&
              correctDodgeForLane(
                dodgeDirection as -1 | 1,
                dangerLane as -1 | 0 | 1,
                bossAttack,
              );
            if (correctDodge) {
              correctDodges += 1;
              score += Math.round(120 * scoreMultiplier());
              playerPosture = recoverPosture(
                playerPosture,
                10,
                playerPostureMax,
              );
            }
            message = correctDodge
              ? "正しい方向へ流れた。得点と構えを得た。"
              : "危険線の外で刃を外した。";
          } else {
            hitsTaken += 1;
            enemyHitTaken = true;
            triggerImpact(dangerLane || 1, 0.12);
            const hitDamage =
              currentVariant.role === "heavy"
                ? 34
                : boss
                  ? bossPhase === 2
                    ? 30
                    : 28
                  : 24;
            hp = applyDamage(hp, hitDamage).hp;
            if (guardBreakImpactAt > 0) guardBreakImpactAt = 0;
            combo = 0;
            comboMilestone = 0;
            message = hp ? "岩刃を受けた。" : "倒れた。再起を選べる。";
            if (!hp) {
              defeated = true;
              saveBestRecord();
              queuedAttackLanes = [];
              clearEnemyAttackVisuals();
              if (slashProjectile) {
                slashProjectile.dispose();
                slashProjectile = null;
              }
            }
          }
          announce(state());
        }
      } else if (enemyAttackAt) {
        clearEnemyAttackVisuals();
        guardRing.isVisible = false;
        attackAreaMaterial.alpha = 0.24;
        enemyGuardUntil = 0;
        if (queuedAttackLanes.length > 0) {
          forcedAttackReadyAt =
            now +
            (currentVariant.family === "獣型"
              ? 260
              : currentVariant.family === "モニュメント型"
                ? 520
                : 380);
          nextGuardAt = forcedAttackReadyAt + 1600;
          message = "まだ終わらない。次の危険線を見よ。";
          announce(state());
        } else {
          forcedAttackReadyAt = 0;
          nextGuardAt =
            boss && currentVariant.family === "人型" && bossPhase === 2
              ? now + 260
              : now + 1800;
        }
        dangerLane = 0;
        bossAttack = false;
        spearAttackSide = 0;
        enemy.root.position.y = 0.2;
      }
    }
    if (recoilUntil > now) {
      const recoil = Math.min(1, (recoilUntil - now) / 190);
      player.blade.rotation.z += recoilDirection * 0.14 * recoil;
      player.rightArm.rotation.z += recoilDirection * 0.18 * recoil;
      player.torso.rotation.z -= recoilDirection * 0.06 * recoil;
    }
    if (guardUntil > now && attackUntil <= now && dodgeUntil <= now) {
      const guardBreath = Math.sin(now * 0.009) * 0.018;
      player.root.scaling.y +=
        (0.96 + guardBreath - player.root.scaling.y) * Math.min(1, dt * 7);
      player.blade.rotation.z +=
        (-0.18 - player.blade.rotation.z) * Math.min(1, dt * 8);
      player.rightArm.rotation.z +=
        (-0.58 - player.rightArm.rotation.z) * Math.min(1, dt * 8);
      player.leftArm.rotation.z +=
        (0.46 - player.leftArm.rotation.z) * Math.min(1, dt * 8);
      player.torso.rotation.z +=
        (0.035 - player.torso.rotation.z) * Math.min(1, dt * 7);
    }
    if (sheathUntil > now) {
      const sheathProgress = 1 - Math.max(0, sheathUntil - now) / 290;
      player.blade.rotation.z +=
        (-0.65 - player.blade.rotation.z) *
        Math.min(1, dt * (4 + sheathProgress * 5));
      player.rightArm.rotation.z +=
        (-0.16 - player.rightArm.rotation.z) * Math.min(1, dt * 3);
    } else if (attackUntil <= now && dodgeUntil <= now)
      player.blade.rotation.z = -0.65;
    if (combo > 0 && now > comboExpiresAt) {
      combo = 0;
      comboMilestone = 0;
      message = "連撃の気配が消えた。";
      announce(state());
    }
    if (
      guardUntil <= now &&
      attackUntil <= now &&
      hp > 0 &&
      !defeated &&
      combo === 0
    )
      message = "構えよ。山は逃げない。";
    const breath = Math.sin(now * 0.0022) * 0.018;
    const postAttackBreath =
      sheathUntil > now ? Math.sin(now * 0.008) * 0.024 : 0;
    const clothLag = Math.max(-0.32, Math.min(0.32, -bladeVelocity * 0.018));
    const inertia = Math.min(1, dt * (5 + bladeAngularSpeed * 2));
    player.hair.rotation.z +=
      (clothLag * 0.7 - player.hair.rotation.z) * inertia;
    player.neckCloth.rotation.z +=
      (clothLag * 0.95 - player.neckCloth.rotation.z) * inertia;
    player.sash.rotation.z +=
      (clothLag * 0.42 - player.sash.rotation.z) * Math.min(1, dt * 4);
    player.prayer.rotation.y +=
      (clothLag * 0.8 - player.prayer.rotation.y) * Math.min(1, dt * 3);
    player.torso.position.y = 1.15 + breath + postAttackBreath;
    player.head.position.y = 1.9 + breath * 0.65;
    player.root.rotation.y = Math.sin(now * 0.0012) * 0.05;
    if (attackUntil <= now && guardUntil <= now && dodgeUntil <= now) {
      player.rightArm.rotation.z +=
        (-0.16 - player.rightArm.rotation.z) * Math.min(1, dt * 8);
      player.leftArm.rotation.z +=
        (0.16 - player.leftArm.rotation.z) * Math.min(1, dt * 8);
      player.torso.rotation.z +=
        (0 - player.torso.rotation.z) * Math.min(1, dt * 8);
    }
  });
  return {
    scene,
    dispose: () => {
      scene.onBeforeRenderObservable.remove(observer);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("yamabushi-dodge", dodgeEvent);
      window.removeEventListener("yamabushi-pause", pauseEvent);
      window.removeEventListener("yamabushi-reward", rewardEvent);
      window.removeEventListener("yamabushi-effects", effectsEvent);
      window.removeEventListener("yamabushi-audio", audioEvent);
      window.removeEventListener("yamabushi-performance", performanceEvent);
      window.removeEventListener("yamabushi-retire", retireEvent);
      window.removeEventListener("yamabushi-restart", resetRun);
      window.removeEventListener("yamabushi-start", resetRun);
      scene.dispose();
    },
  };
}
