# 2026-10-01 視覚品質監査の根拠

本資料の基準は main の commit 14f17c89da689aa71e54813ee49c362347b691a2 です。
[課題一覧](../../VISUAL_QUALITY_AUDIT_2026-10-01.md) に88件の現状、課題、改善案、完了条件を記載しています。

- issues.json：全課題と出典を再利用できる構造化データ。
- geometry-evidence.json：NullEngineで生成した実シーンの床・足・危険表示・槍・操作・反撃・材質・鳥居の記録。
- reproduce.ts：外部通信やGPU描画を使わず数値を再現するコード。
- browser-evidence.json：公開タイトルを1363×936のブラウザで観測したDOMの実寸。
- title-failure-desktop.jpg：WebGL非対応、追加設定を開いたタイトル。
- title-failure-closed-desktop.jpg：同条件で追加設定を閉じたタイトル。

リポジトリのルートで依存関係を用意した後、次で数値を再現します。

```sh
node --import tsx docs/audits/visual-quality-20261001/reproduce.ts
```

このコードは geometry-evidence.json を更新します。将来の修正後は元の監査結果との差を確認してください。
数値は形状とルールの検証であり、GPUで描画した画像やiPhoneの操作感の検証ではありません。
今回の確認ブラウザはWebGL非対応のため、通常起動の3D戦闘とiPhone実機は未確認です。

## 2026-10-02 ハーネス照合の改訂

88件のIDを維持して、現行仕様とのずれを修正し、15の共通実装契約へまとめました。

- harness-review-20261002.json：ハーネス2.6.0・固定commit・24モジュール・選択理由と参照ハッシュ。
- acceptance-checks.json：整合性15件と体験15件の計画。全件not_runであり、実行済み結果ではありません。
- issues.json：各課題からQ契約・ハーネス根拠・2種類の検査へ対応。

初回の画像・DOM・NullEngine記録は改訂後のゲームを検査した記録ではなく、ゲーム基準commitが同じことを確認して参照しています。ゲーム本体とハーネス本体のコードは変更していません。
