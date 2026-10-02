import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Scene } from "@babylonjs/core/scene";
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
export const CHAPTER_TITLES = [
  "霧ノ峠",
  "岩戸の回廊",
  "天狗の稜線",
  "無明の奥宮",
  "修験成就",
] as const;
/** Static scenery never consumes either gameplay RNG stream. */
export function createChapterVisual(
  scene: Scene,
  materials: Record<string, StandardMaterial>
) {
  const chapters = CHAPTER_TITLES.map((name, index) => {
    const meshes = [];
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const m =
          index === 0 || index === 2
            ? MeshBuilder.CreateCylinder(
                `${name}_ridge_${side}_${i}`,
                {
                  height: 4 + i,
                  diameterTop: 0,
                  diameterBottom: index === 2 ? 5 : 7,
                  tessellation: 5,
                },
                scene
              )
            : MeshBuilder.CreateBox(
                `${name}_landmark_${side}_${i}`,
                {
                  width: index === 1 ? 2.4 : 0.55,
                  height: index === 4 ? 2 : 5,
                  depth: index === 1 ? 3 : 0.65,
                },
                scene
              );
        m.position.set(
          side * (index === 1 ? 5 : 7 + i),
          index === 4 ? 1 : 2,
          8 + i * 4
        );
        m.material = index === 3 ? materials.wood : materials.stone;
        m.metadata = { chapter: index + 1 };
        meshes.push(m);
      }
    return meshes;
  });
  return (chapter: number) =>
    chapters.forEach((meshes, index) =>
      meshes.forEach(m => m.setEnabled(index === chapter - 1))
    );
}
