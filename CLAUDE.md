# Udonarium SWitch

- オンラインTRPGセッション支援ツール。WebRTC P2Pでブラウザ間リアルタイム同期
- Angular 17 + TypeScript 5.2
- [udonarium](https://github.com/TK11235/udonarium) のフォーク。ソードワールド2.5向けの機能を追加している

## Conventions

- コメント・ドキュメントは**日本語**（簡潔に）。変数名・関数名は**英語**
- [Angular Style Guide](https://angular.io/guide/styleguide) に従う

### Upstream 追従

**upstream の変更を取り込みやすい状態を保つこと**を、設計判断の優先事項に置く。

- upstream 由来のファイルへの変更は最小限に留め、差分が読める形にする
- upstream が module スコープ変数を使っている箇所は、static クラスメンバに置き換えない
- フォーク独自のロジックは、可能なら既存クラスの改変ではなく新規クラス／サービスとして足す（e.g. `class/dice-table.ts`, `class/*-command-handler.ts`）

## Commands

- `ng serve --ssl` — HTTPS開発サーバ（WebRTC/SkyWay機能に必要）
- `ng build` — プロダクションビルド（出力: `dist/udonarium/`）
- `npm test` — Karma/Jasmine を ChromeHeadless で watch 実行
- `npm run test:ci` — 1回だけ実行してカバレッジ出力（CIと同じ）。`coverage/` は gitignore
- `ng test --browsers=Chrome` — 実ブラウザを開く（デバッガを当てるとき）

## Release

### ブランチ運用

git-flowに従う。`feature/*` → `develop`、`develop` から `release/*` を切ってリリース準備 → `master` に `--no-ff` マージしてタグ → `develop` に back-merge → release ブランチ削除。

`master` はリリース済みのものだけを持つ。タグは **`master` 上のマージコミット** に打つ。

### リモート

4つある。**タグは必ず名前指定で push する** — `git push --tags` は継承した80個のタグを他人のリポジトリに投げる。

- `origin` — `udonarium_switch_dev`（開発用）
- `fork` — `udonarium_switch`（公開用。GitHub Release はここに作る）
- `forkee` — TK11235/udonarium（upstream。**他人のリポジトリ**だが push URL 設定済み）
- `lily` — entyu/udonarium_lily（**他人のリポジトリ**だが push URL 設定済み）

### タグ

`switch-vX.Y.Z`。`git describe` は `--match 'switch-v*'` を付け、upstreamですでに使われている `vX.Y.Z`形式の継承タグをはじく。

### バージョンの書き換え

- `package.json` — `version`
- `package-lock.json` — `version` が2箇所（トップレベルと `packages[""]`）
- `src/index.html` — `<title>`

**`npm version` は使わない** — lockfile が `lockfileVersion: 2` なので、npm 9+ が 3 に上げて巨大な差分になる。

リリースコミットは `docs: バージョン情報更新 (vX.Y.Z)`（upstream の慣習）。`CHANGELOG.md` も同時に更新する。

### 配布

`ng build` の成果物 `dist/udonarium/` を `udonarium_switch.zip` にして GitHub Release に手動添付する。CI（`.github/workflows/test.yml`）はテストのみで、タグ push でも `release/*` への push でも起動しない。

## Path aliases

`tsconfig.json` で定義。インポート時に使用:

- `@udonarium/*` → `src/app/class/*` （ドメインモデル・コアクラス）
- `component/*` → `src/app/component/*`
- `directive/*` → `src/app/directive/*`
- `service/*` → `src/app/service/*`
- `pipe/*` → `src/app/pipe/*`
- `testing/*` → `src/testing/*` （テスト用ヘルパ。spec からのみ使う）

## Testing

### 方針

優先して書くのは、フォーク独自の**正規表現・境界値・パーサ**。バグ修正時は先に落ちる spec を書いてから直す。
基本的に**コンポーネントの spec は書かない** — サービスの多くが `AppModule` の providers 登録（`providedIn: 'root'` ではない）で TestBed ハーネスのコストに対して保証が薄い。コンポーネント内のロジックをテストしたくなったら、`class/` 側か static メソッドへの切り出しができないか検討する。

ただし**コンストラクタ引数を持たないサービスは例外**で、TestBed を通さず `new` して spec を書いてよい（e.g. `service/game-character-targeting.service.spec.ts`）。
上の但し書きが避けたいのはハーネスのコストであって、サービスそのものではない。


### 配置

対象と同階層・同名 + `.spec.ts`。共有ヘルパは `src/testing/` に置き、`testing/*` エイリアスで参照する。
`tsconfig.spec.json` の `include` は spec のみだが、spec から import すれば推移的に取り込まれるので設定変更は不要。

### GameObject を扱う spec の作法

- **`afterEach(resetGameObjects)` を必ず付ける**（`testing/game-object-testing`）。`ObjectStore` / `EventSystem` は DI 外のシングルトンで、Karma は全 spec を同一プロセスで走らせるため状態が漏れる。`jasmine.random: true` にしてあるので、後始末漏れは実行順が変わったときに問題になる。
- **`ObjectFactory` はリセットしない**。`@SyncObject` の登録は import 時に一度きりで、単一バンドル内では二度と走らない。
- 後片付けは `ObjectStore.remove()`。`delete()` は墓標を残し、同じ identifier の `add()` が以後 null を返す。
- **`EventSystem.call()` は非同期**（Network のループバック経由）、`trigger()` は同期。ハンドラのテストは `trigger()` を使うか await する。
- `versionUp()` は `minorVersion = Math.random()` なので version の値は assert しない。
- WebRTC は不要。SkyWay は `Network.open()` 内の動的 import でしか読まれない。

## Architecture

### UI management

Angular Routerは不使用。UIウィンドウは `PanelService`（パネル）と `ModalService`（モーダル）で動的に生成・管理する。

### Object sync system

ゲーム状態のP2P同期は独自のデコレータベースの仕組みで実現:

- `@SyncObject('alias')` — クラスを同期対象として `ObjectFactory` に登録
- `@SyncVar()` — プロパティを自動同期対象にマーク

同期フロー: プロパティ変更 → `ObjectStore.update()` → `EventSystem` でイベント発火 → `Network` でピアにブロードキャスト → 受信側で `ObjectSynchronizer` がバージョン比較して適用。シリアライズはXML形式（`ObjectSerializer`）。

### Game object hierarchy

```
GameObject（基底: identifier, version管理）
  └─ ObjectNode（親子ツリー構造）
      └─ TabletopObject（座標・画像管理）
          └─ GameCharacter, Terrain, GameTableMask, Card 等
```

各オブジェクトは `DataElement` ツリーでデータを保持（image/common/detail等のサブ要素）。

### Core singletons

以下はAngular DI外のシングルトンで、`.instance` で直接アクセスする:

- `EventSystem` — 優先度付きpub/subイベントバス
- `ObjectStore` — 全ゲームオブジェクトのリポジトリ
- `ObjectSynchronizer` — ピア間同期エンジン
- `Network` — WebRTC接続管理（SkyWay 2023 SDK）

### NgZone strategy

コア初期化は `ngZone.runOutsideAngular()` で実行し変更検知を回避。UIの更新には `lazyNgZoneUpdate()` でデバウンスした `ngZone.run()` を使用。

### Networking

SkyWay 2023（`@skyway-sdk/core`）でWebRTCシグナリング。バックエンドURLは `src/assets/config.yaml` の `backend.url` で設定。
