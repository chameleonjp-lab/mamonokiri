# STRUCTURE

`client/src/components/GameCanvas.tsx`はReactとBabylon.jsの境界であり、エンジンの初期化・描画ループ・リサイズ・破棄だけを担当する。`client/src/game/scene.ts`はフレームワーク非依存のゲームワールドとして、カメラ、照明、地形、山伏、異形、入力、攻撃判定、状態通知を担当する。`client/src/App.tsx`はゲームHUDを描画し、`yamabushi-state`のCustomEventだけを購読する。ゲームロジックからReactを参照しない。

地形はプロシージャルメッシュ、霧はBabylon SceneのFOG、攻撃の印象は護符朱マテリアルとUIの短い文言で表現する。生成画像は将来の背景・テクスチャ拡張用にWebDevアセットURLで管理し、初期プロトタイプは描画性能を優先している。
