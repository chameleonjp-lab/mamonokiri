# ASSETS

| Asset | 用途 | URL |
|---|---|---|
| yamabushi-visual-target.jpg | 墨霞の修験道の基準ビジュアル | `/manus-storage/yamabushi-visual-target_406e54f6.jpg` |
| yamabushi-character-cutout.png | 山伏キャラクターの造形リファレンス | `/manus-storage/yamabushi-character-cutout_7c019bdd.png` |
| mountain-wraith-enemy.png | 異形の造形リファレンス | `/manus-storage/mountain-wraith-enemy_22fa8fd3.png` |
| yamabushi-mountain-crest.png | 山・刀・法螺貝を組み合わせた紋章 | `/manus-storage/yamabushi-mountain-crest_8f5ae00d.png` |
| mamonokiri-player-yamabushi-v1.webp | 写実的な山伏プレイヤーの基準レンダー／透明カットアウト | `/assets/production/mamonokiri-player-yamabushi-v1.webp` |
| mamonokiri-enemy-kagemen-v1.webp | 通常敵「影面」の基準レンダー／透明カットアウト | `/assets/production/mamonokiri-enemy-kagemen-v1.webp` |
| mamonokiri-boss-garei-v1.webp | 獣型ボス「牙嶺」の基準レンダー／透明カットアウト | `/assets/production/mamonokiri-boss-garei-v1.webp` |
| mamonokiri-arena-mist-shrine-v1.webp | 霧深い山岳神域の背景レンダー／戦場基準画 | `/assets/production/mamonokiri-arena-mist-shrine-v1.webp` |

## 形式と運用

- `client/public/assets/production/` の配信用キャラクター3点は、透明アルファを維持したWebP（1024×1536）。タイトル画面・結果画面・将来のカットアウト表示へ利用できる。
- 戦場背景はWebP（1672×941）。中央の戦闘レーンが空く構図で、背景の基準画として利用する。
- 元の高解像度PNGは生成・編集用の作業素材として保持し、リポジトリにはブラウザ配信用に圧縮したWebPを登録する。
- 現在の戦闘中3D描画は `client/src/game/scene.ts` のプロシージャルメッシュが担当している。今回のレンダー素材は既存の当たり判定・危険範囲・カメラを変更せず、造形とライティングの基準として追加した。
- これらは写実的な3Dレンダー画像であり、スキニング済みの `.glb` / `.gltf` メッシュではない。実モデルの置き換えには、メッシュ・マテリアル・リグ・アニメーションを別工程で用意する必要がある。
