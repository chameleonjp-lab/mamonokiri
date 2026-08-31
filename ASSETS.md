# ASSETS

| Asset | 用途 | URL |
|---|---|---|
| mamonokiri-player-yamabushi-v1.webp | 写実的な山伏プレイヤーの基準レンダー／透明カットアウト | `/assets/production/mamonokiri-player-yamabushi-v1.webp` |
| mamonokiri-enemy-kagemen-v1.webp | 通常敵「影面」の基準レンダー／透明カットアウト | `/assets/production/mamonokiri-enemy-kagemen-v1.webp` |
| mamonokiri-enemy-kakugan-v1.webp | 通常敵「角岩」の基準レンダー／右攻撃教材型の透明カットアウト | `/assets/production/mamonokiri-enemy-kakugan-v1.webp` |
| mamonokiri-boss-garei-v1.webp | 獣型ボス「牙嶺」の基準レンダー／透明カットアウト | `/assets/production/mamonokiri-boss-garei-v1.webp` |
| mamonokiri-arena-mist-shrine-v1.webp | 霧深い山岳神域の背景レンダー／戦場基準画 | `/assets/production/mamonokiri-arena-mist-shrine-v1.webp` |

## 形式と運用

- `client/public/assets/production/` のWebPは、造形・ライティングの基準画として保管している。現行のタイトル画面・結果画面・戦闘中3D描画はこれらを読み込まず、コード描画で構成する。
- 戦場背景はWebP（1672×941）。中央の戦闘レーンが空く構図で、背景の基準画として利用する。
- 現在の戦闘中3D描画は `client/src/game/scene.ts` と `client/src/game/proceduralCharacter.ts` のプロシージャルメッシュ／モーションが担当している。画像の読み込みやテクスチャ依存はない。
- これらは写実的な3Dレンダー画像であり、スキニング済みの `.glb` / `.gltf` メッシュではない。実モデルの置き換えには、メッシュ・マテリアル・リグ・アニメーションを別工程で用意する必要がある。
