import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Scene } from "@babylonjs/core/scene";
import { describe, expect, it } from "vitest";
import {
  makeProceduralPlayer,
  type PlayerMotionKind,
} from "./proceduralCharacter";

const source = readFileSync(
  new URL("./proceduralCharacter.ts", import.meta.url),
  "utf8",
);

describe("procedural character motion contract", () => {
  it("keeps every playable player state in the code-driven rig", () => {
    for (const motion of [
      "idle",
      "spawn",
      "dodge",
      "attack",
      "sheath",
      "guard",
      "parry",
      "hit",
      "defeat",
      "victory",
    ]) {
      expect(source).toContain(`| "${motion}"`);
    }

    for (const attack of ["normal", "counter", "guard-break", "finisher"]) {
      expect(source).toContain(`| "${attack}"`);
    }
  });

  it("builds an articulated hierarchy instead of a flat sprite", () => {
    expect(source).toContain("new TransformNode");
    expect(source).toContain('"left_shoulder"');
    expect(source).toContain('"right_elbow"');
    expect(source).toContain('"left_knee"');
    expect(source).toContain('"right_ankle"');
    expect(source).toContain("applyMotion: (sample) => applyMotion");
  });

  it("does not depend on image, texture, or external model data", () => {
    expect(source).not.toMatch(/Texture|<img|data:image|\.webp|\.png/);
    expect(source).toContain("MeshBuilder.CreateBox");
    expect(source).toContain("MeshBuilder.CreateSphere");
    expect(source).toContain("StandardMaterial");
  });

  it("applies every motion to the same live Babylon hierarchy", () => {
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
      ].map((name) => {
        const material = new StandardMaterial(name, scene);
        material.diffuseColor = new Color3(0.5, 0.5, 0.5);
        return [name, material];
      }),
    ) as Record<string, StandardMaterial>;
    const player = makeProceduralPlayer(scene, materials);
    const motions: PlayerMotionKind[] = [
      "idle",
      "spawn",
      "dodge",
      "attack",
      "sheath",
      "guard",
      "parry",
      "hit",
      "defeat",
      "victory",
    ];

    for (const kind of motions) {
      player.applyMotion({
        kind,
        progress: 0.5,
        timeSeconds: 0.5,
        direction: 1,
        attackKind: "normal",
      });
    }

    expect(player.root.getChildren().length).toBeGreaterThan(0);
    expect(player.blade.parent?.name).toBe("right_hand");
    expect(player.root.position.y).toBe(0.36);
    scene.dispose();
    engine.dispose();
  });
});
