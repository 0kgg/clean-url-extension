# Clean URL Copier

ブラウザアクションを押すとポップアップが開き、現在タブのクリーンURLと、Amazon商品ページから自動抽出した商品名・色・サイズ・単価・個数を編集してまとめてクリップボードへコピーできるChrome拡張です。追跡/アフィリエイト系クエリを削除し、Amazonリンクは `/dp/<ASIN>` に最短化します。

## 出力フォーマット例
```
・[アメトハレ] レインブーツ ロング 長靴 折りたたみ
色: ブラック
サイズ: 27.5~28.0cm
単価：￥4,380
個数：1個
https://www.amazon.co.jp/dp/B093WN4KDV
```
空欄のフィールドは行ごとスキップされます（商品情報がすべて空なら URL のみコピー）。

## 主な処理
- 追跡・アフィリエイトクエリの削除（大小無視）
  `utm_*`, `gclid`, `dclid`, `fbclid`, `msclkid`, `mc_eid`, `ref`, `tag`, `aff`, `aff_id`, `affsource`, `pid`, `vid`, `_branch_match_id` など
- Amazonリンクをホスト維持のまま `/dp/<ASIN>` に正規化（ASINをパス/クエリから抽出）
- ポップアップ起動時にAmazon商品ページから商品名（`#productTitle`）、価格（`.a-price .a-offscreen` ほか）、色（`#variation_color_name .selection`）、サイズ（`#variation_size_name .selection`）、個数（`#quantity`）を自動抽出し、フォームへプレビュー
- フォーム内容は自由に編集可。「コピー」ボタンで整形テキストをクリップボードへ書き込み
- **商品名補助ボタン**
  - 「短縮」: 詰め込みキーワードをルールで切り落とし（ブランド `[...]` / `【...】` は温存、区切り記号・ストップ語彙・末尾括弧・トークン重複を処理）
  - 「型番」: 商品詳細表から抽出した `[ブランド] 型番 <元タイトル先頭12文字>` に再構成（発注書向け）
- **ASIN別の商品名保存（自動）**: コピー時に編集後のタイトルを `chrome.storage.local` に ASIN キーで保存。次回同じ商品を開くと自動復元され「保存済」バッジが表示される。バッジの「戻す」で元の Amazon タイトルに戻せる

## インストール（ローカル読み込み）
1. `chrome://extensions` を開き、デベロッパーモードをON。
2. 「パッケージ化されていない拡張機能を読み込む」で本フォルダを選択。
   もしくは同梱の `chrome-clean-url.zip` を展開して選択。
3. ツールバーのアイコンをクリックするとポップアップが開きます。内容を確認・編集し「コピー」を押すとクリップボードへ書き込みます。

## パーミッション
- `activeTab`: 現在タブのURL取得
- `scripting`: 商品ページ（DOM）からの情報抽出
- `clipboardWrite`: クリップボード書き込み
- `storage`: ASIN別の編集済み商品名の永続化

## 構成
- `manifest.json` — MV3 マニフェスト。アイコン/権限/ポップアップを定義。
- `popup.html` / `popup.js` — ポップアップUIと抽出・整形・コピー処理。
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
- `chrome://` などの特殊ページではURL取得・DOM抽出をスキップします（URL欄は空）。
- Amazon以外のページでは商品情報は取得されません。URL欄のみ埋まり、必要なら各欄を手入力できます。
- 価格・バリエーションのセレクタはAmazonのDOMに依存するため、将来のUI変更で抽出できなくなる可能性があります。その場合はポップアップで手動入力してください。
