# Ediput Desktop

Ediput のデスクトップ版です。

**macOS / Windows / Linux を正式ターゲット**にし、将来の Android / iOS 展開を考慮した構成です。

## 技術スタック

- Tauri 2
- React 19
- TypeScript
- Vite
- CodeMirror 6
- marked
- DOMPurify
- KaTeX
- lucide-react
- Rust

Tauri は OS のネイティブ WebView を利用し、Linux / macOS / Windows / Android / iOS を単一コードベースから対象にできます。

## 開発

Node.js と Rust / Cargo、Tauri の各OS向け前提環境を用意してください。

```bash
npm install
npm run tauri:dev
```

Web UIだけ確認:

```bash
npm run dev
```

## ビルド

```bash
npm run tauri:build
```

bundleターゲット:

- macOS: DMG
- Windows: NSIS
- Linux: AppImage / deb

## 現在の機能

- CodeMirrorによるMarkdown編集
- デバウンス付きライブプレビュー
- Markdown / text ファイルの開く・保存
- Ctrl/Cmd + O / S
- ライト / ダークテーマ
- サイドバー開閉
- システム印刷UIからPDF保存
- HTMLをDOMPurifyでサニタイズ

## パフォーマンス方針

- CodeMirrorの差分更新を利用
- 編集とプレビュー更新を分離
- プレビュー更新を短時間デバウンス
- TauriのネイティブWebViewを利用
- ファイルI/Oは操作時だけ実行

## 次の実装

高度なMarkdown互換性、KaTeX数式、画像、ドラッグ&ドロップ、最近使ったファイル、ネイティブPDF出力を順次追加します。
