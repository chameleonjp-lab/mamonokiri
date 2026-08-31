# STRUCTURE

`client/src/components/GameCanvas.tsx`はReactとBabylon.jsの境界であり、エンジンの初期化・描画ループ・リサイズ・破棄だけを担当する。`client/src/game/scene.ts`はフレームワーク非依存のゲームワールドとして、カメラ、照明、地形、山伏、異形、入力、攻撃判定、状態通知を担当する。`client/src/App.tsx`はゲームHUDを描画し、`yamabushi-state`のCustomEventだけを購読する。ゲームロジックからReactを参照しない。

地形はプロシージャルメッシュ、霧はBabylon SceneのFOG、攻撃の印象は護符朱マテリアルとUIの短い文言で表現する。リポジトリ内の画像は造形基準画として保管するだけで、現行のタイトル・戦闘・結果画面は画像やテクスチャを読み込まず、コード描画とモーションで構成する。
