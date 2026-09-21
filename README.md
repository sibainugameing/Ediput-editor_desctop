# Ediput Desktop

Ediput Desktop は、Web版とは別に設計・開発する独立したMarkdownエディタです。Web版のUIや操作フローを踏襲せず、デスクトップに最適化した体験を作ります。

## 対象プラットフォーム

- macOS
- Windows
- Linux

スマートフォン版（Android / iOS）は、デスクトップ版の基盤と使い勝手を確認した後に、必要性を判断します。現時点では対応確定ではありません。

## 設計方針

- **UI**: デスクトップ独自の画面構成・操作フロー
- **速度**: 入力応答を優先し、プレビューなど重い処理は編集処理から分離
- **OS連携**: ネイティブのファイル選択・保存・印刷を活用
- **安全性**: Markdownをサニタイズして表示し、数式は信頼しない設定でKaTeXに渡す
- **独立性**: Web版のコードや変更に依存しない
- **移植性**: macOS / Windows / Linuxを同じアプリ基盤で展開

## 技術スタック

- Tauri 2
- React 19
- TypeScript
- Vite
- CodeMirror 6
- marked
- DOMPurify
- KaTeX（インライン / ディスプレイ数式）
- lucide-react
- Rust

## 開発

Node.js と Rust / Cargo、Tauriの各OS向け前提環境を用意してください。

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

## 現在の実装

- CodeMirrorによるMarkdown編集
- デバウンス付きライブプレビュー
- Markdown / textファイルの開く・保存
- Ctrl/Cmd + O / S
- ライト / ダークテーマ
- サイドバー開閉
- システム印刷UIからPDF保存
- HTMLをDOMPurifyでサニタイズ
- KaTeXによる数式表示（`\(...\)` / `\[...\]` / `$...$` など）
- ネイティブメニューからの新規ウィンドウ生成
- 複数ウィンドウでのファイル操作権限

## パフォーマンス方針

- CodeMirrorの差分更新を利用
- 編集とプレビュー更新を分離
- プレビュー更新を短時間デバウンス
- TauriのネイティブWebViewを利用
- ファイルI/Oは操作時だけ実行

## 次の実装

Markdown拡張・画像対応・ドラッグ&ドロップ・最近使ったファイルなどを順次検討・実装します。
