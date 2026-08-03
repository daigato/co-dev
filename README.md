# RouteKeeper（仮）

RouteKeeper（仮）は、公園・施設・大学構内などの出入口や経由地を確認するためのマップWebアプリです。

地図表示、現在地取得、スポット登録、建物内の出入口ペア登録、徒歩ルート比較を実装しています。

## 使用技術

- HTML5
- CSS3
- Vanilla JavaScript
- Leaflet.js（CDNから読み込み）
- OpenStreetMap（今後、地図データとして使用）
- HTML5 Geolocation API（今後、現在地取得に使用）
- OpenRouteService API（今後、徒歩ルート検索に使用）
- LocalStorage（今後、スポット保存に使用）

React、Vue、TypeScript、npm、Node.js、データベース、ログイン機能は使用しません。

## フォルダ構成

```text
routekeeper/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ config.js
│  ├─ state.js
│  ├─ map.js
│  ├─ routing.js
│  ├─ storage.js
│  ├─ spots.js
│  ├─ buildings.js
│  └─ app.js
├─ .gitignore
└─ README.md
```

## 役割分担

### 担当A：地図・経路

主に次のファイルを編集します。

- `js/map.js`
  - Leaflet地図の初期化
  - 現在地の取得と表示
  - 保存済みスポットの地点表示
- `js/routing.js`
  - OpenRouteServiceへの問い合わせ
  - 通常ルートと建物経由ルートの所要時間比較
  - 徒歩ルート、距離、所要時間の表示
- `js/config.js`
  - OpenRouteService APIキー設定の管理

### 担当B：スポット・保存

主に次のファイルを編集します。

- `js/storage.js`
  - LocalStorageへの保存、読み込み、削除
- `js/spots.js`
  - スポット登録操作
  - 保存済みスポットの一覧、選択、削除
- `js/buildings.js`
  - 建物グループ、出入口ペア、建物内通過時間の登録と表示

`index.html`、`css/style.css`、`js/state.js`、`js/app.js`、`README.md`は共同ファイルです。変更前に相手へ伝えてください。

## APIキーの設定方法

徒歩ルート検索ではOpenRouteServiceのAPIキーを使用します。アプリ画面からは入力せず、`js/config.js` に設定します。

`js/config.js` の `REPLACE_ORS_API_KEY` を、自分のAPIキーへ置き換えてください。

```javascript
window.ROUTEKEEPER_CONFIG = {
  ORS_API_KEY: "ここへ自分のAPIキーを設定"
};
```

本物のAPIキーを設定した `js/config.js` をGitHubへコミットしないでください。公開環境では、デプロイサービスの環境変数やバックエンド経由でキーを扱う構成を使用してください。

## ローカルでの確認方法

### 簡単な確認

`index.html` をWebブラウザで開くと、現在の画面の土台を確認できます。

### ローカルWebサーバーを使う確認

今後、現在地取得やAPI通信を確認するときは、`file://`で直接開かず、HTTPSまたはlocalhostで動かす必要があります。利用できるローカルWebサーバーで `routekeeper` フォルダを公開してください。

例として、Pythonがインストールされている場合は次のように起動できます。

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

その後、ブラウザで `http://127.0.0.1:8000` を開きます。現在地取得を使う場合は、ブラウザに位置情報の利用許可を求められます。

## JavaScriptの読み込み順

`index.html` では次の順番で読み込みます。

1. Leaflet
2. `js/config.js`
3. `js/state.js`
4. `js/map.js`
5. `js/routing.js`
6. `js/storage.js`
7. `js/spots.js`
8. `js/buildings.js`
9. `js/app.js`

設定と共通状態を先に用意し、担当別モジュールを読み込んだ後、最後に `app.js` で初期化するための順番です。

## 建物内の通り抜け登録

1. 地図上に出入口タイプのスポットを2か所登録します。
2. 「建物内の通り抜け登録」で建物名、出入口 A、出入口 B、建物内の徒歩時間を設定します。
3. 目的地への経路検索時、通常ルートとすべての登録ペアを比較します。
4. 建物経由が速い場合、屋外区間を青い実線、建物内の出入口間を紫の点線で表示します。ペアは両方向の経路候補として比較されます。

スポットと建物グループはブラウザのLocalStorageへ保存されます。

## 目的地と経由地の操作

- 地図上の任意地点をクリックし、表示された「ここを目的地にする」から、スポット保存せずに経路検索できます。
- 保存済みの経由地タイプのピンでは、目的地への経路表示後に「この地点を経由地に追加」を選べます。
- 経由地は選択順に複数追加でき、現在地から各経由地を通って目的地へ向かうよう経路を再計算します。
- 各区間で通常ルートと建物経由ルートを比較します。
- ルート情報欄の「経路表示を終了」で、経路線・目的地・選択済み経由地を解除できます。

---

## 今後の拡張予定（将来的なアイデア）

現在は要件に基づき、ログイン機能なし・LocalStorageによるローカルブラウザ保存で実装されていますが、将来的にマルチデバイス対応や複数ユーザー間でのデータ共有を行う場合の拡張アイデアです。

- **ユーザー識別とデータ同期**
  - **Googleログイン等の導入**: Firebase Authentication や Supabase Auth などの認証サービスを活用。
  - **簡便な認証フロー**: 面倒なパスワード管理の手間を避け、1クリックで安全にユーザー識別を行える仕組みを導入します。
- **クラウド保存（データベース連携）**
  - **クラウドDBの導入**: Firestore や Supabase などのクラウドデータベースと連携。
  - **マルチデバイス対応**: スマートフォンや別のPCからアクセスした場合でも、同一のアカウントで登録スポットや徒歩ルートをシームレスに参照・編集できるように拡張します。

ーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーーー

## ファイル説明

- housin.md...これからやること
- houkoku.md...実装したことを報告
