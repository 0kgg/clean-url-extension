# Clean URL Copier

ブラウザアクションを押すだけで、現在タブのURLをクリーンにしてクリップボードへコピーするChrome拡張です。追跡/アフィリエイト系クエリを削除し、Amazonリンクは `/dp/<ASIN>` に最短化します。通知は1件だけ上書き表示され、2秒後に自動で閉じます。バッジでも成否を表示します。

## 主な処理
- 追跡・アフィリエイトクエリの削除（大小無視）
  `utm_*`, `gclid`, `dclid`, `fbclid`, `msclkid`, `mc_eid`, `ref`, `tag`, `aff`, `aff_id`, `affsource`, `pid`, `vid`, `_branch_match_id` など
- Amazonリンクをホスト維持のまま `/dp/<ASIN>` に正規化（ASINをパス/クエリから抽出）
- 通知は同じIDで `update`→`create` し、2秒後に自動 `clear`
- バッジ: 成功で「OK」(緑)、失敗で「ERR」(赤)

## インストール（ローカル読み込み）
1. `chrome://extensions` を開き、デベロッパーモードをON。
2. 「パッケージ化されていない拡張機能を読み込む」で本フォルダを選択。
   もしくは同梱の `chrome-clean-url.zip` を展開して選択。
3. ツールバーのアイコンをクリックすると、クリーンURLがコピーされ、通知とバッジで結果が表示されます。

## パーミッション
- `activeTab`: 現在タブのURL取得
- `scripting`: クリップボードへの書き込みをタブで実行
- `clipboardWrite`: クリップボード書き込み
- `notifications`: 通知表示

## 構成
- `manifest.json` — MV3 マニフェスト。アイコン/権限/背景SWを定義。
- `background.js` — URL正規化・通知・バッジ更新のメインロジック。
- `icons/` — 拡張アイコン。`unnamed.jpg` を元に生成。
- `tools/icon_from_image.py` — `unnamed.jpg` から 16/32/48/128px のPNGを生成するスクリプト（Pillow依存）。

## アイコン再生成
```bash
py -3 chrome-clean-url\\tools\\icon_from_image.py
```
Pillow が未導入なら `py -3 -m pip install pillow` を実行してください。

## ビルド/配布
- ローカル読み込み用: フォルダをそのまま指定
- 配布用zip: `Compress-Archive -Path chrome-clean-url -DestinationPath chrome-clean-url.zip -Force`

## 既知の注意
- `chrome://` などの特殊ページではURL取得をスキップします。
- 通知が不要な場合は `background.js` の `notify` 呼び出しを取り除いてください。
