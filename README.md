# RouteKeeper（仮）

RouteKeeper（仮）は、公園・施設・大学構内などの入口、経由地、出口を確認するためのマップWebアプリです。

現在は、2人で機能開発を始めるための**共通の土台だけ**を用意した段階です。地図表示、現在地取得、ルート検索、スポット登録、保存などの機能は、まだ実装されていません。

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
│  ├─ config.example.js
│  ├─ state.js
│  ├─ map.js
│  ├─ routing.js
│  ├─ storage.js
│  ├─ spots.js
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
  - 徒歩ルート、距離、所要時間の表示
- `js/config.example.js`
  - APIキー設定例の管理

### 担当B：スポット・保存

主に次のファイルを編集します。

- `js/storage.js`
  - LocalStorageへの保存、読み込み、削除
- `js/spots.js`
  - スポット登録操作
  - 保存済みスポットの一覧、選択、削除

`index.html`、`css/style.css`、`js/state.js`、`js/app.js`、`README.md`は共同ファイルです。変更前に相手へ伝えてください。

## APIキーの設定方法

徒歩ルート検索では、今後OpenRouteServiceのAPIキーを使用します。現時点ではルート検索が未実装なので、APIキーを設定しても検索はできません。

APIキーは以下のいずれかの方法で設定できます。

### 方法1：アプリ画面の設定パネルから設定（推奨）
アプリ画面の左下にある「設定」パネルの「OpenRouteService APIキー」入力欄に直接APIキーを入力します。
入力されたキーはブラウザのLocalStorageに安全に保存され、ページをリロードしても保持されます。この方法を使えば、コードや設定ファイルを編集することなくルート検索機能を利用できます。

### 方法2：設定ファイル (`js/config.js`) を作成して設定
1. `js/config.example.js` を同じフォルダへコピーします。
2. コピーしたファイル名を `js/config.js` に変更します。
3. `js/config.js` の `YOUR_API_KEY` を自分のAPIキーへ置き換えます。
4. ルート検索機能を実装するとき、`index.html` の設定ファイル読み込みを `config.example.js` から `config.js` へ変更します。

PowerShellでは、次を実行してコピーできます。

```powershell
Copy-Item .\js\config.example.js .\js\config.js
```

作成後の `config.js` は、次の形になります。

```javascript
window.ROUTEKEEPER_CONFIG = {
  ORS_API_KEY: "ここへ自分のAPIキーを設定"
};
```

`js/config.js` は `.gitignore` に登録済みです。本物のAPIキーをGitHubへ公開しないでください。`config.example.js` にも本物のAPIキーを書かないでください。

## ローカルでの確認方法

### 簡単な確認

`index.html` をWebブラウザで開くと、現在の画面の土台を確認できます。

### ローカルWebサーバーを使う確認

今後、現在地取得やAPI通信を確認するときは、`file://`で直接開かず、HTTPSまたはlocalhostで動かす必要があります。利用できるローカルWebサーバーで `routekeeper` フォルダを公開してください。

例として、Pythonがインストールされている場合は次のように起動できます。

```powershell
python -m http.server 8000
```

その後、ブラウザで `http://localhost:8000` を開きます。現在地取得を使う場合は、ブラウザに位置情報の利用許可を求められます。

## JavaScriptの読み込み順

`index.html` では次の順番で読み込みます。

1. Leaflet
2. `js/config.example.js`
3. `js/state.js`
4. `js/map.js`
5. `js/routing.js`
6. `js/storage.js`
7. `js/spots.js`
8. `js/app.js`

設定と共通状態を先に用意し、担当別モジュールを読み込んだ後、最後に `app.js` で初期化するための順番です。

## 現在の未実装機能

- Leaflet地図の初期化とOpenStreetMap表示
- 現在地取得と現在地マーカー
- OpenRouteServiceを使った徒歩ルート検索
- ルート線、距離、所要時間の表示
- 地図クリック処理
- 入口、経由地、出口の登録
- LocalStorageへの保存と読み込み
- 保存済みスポット一覧の表示、選択、削除

各機能は担当別の小さなチケットに分け、段階的に実装してください。

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

