# Ediput Desktop

Ediput のデスクトップ版。Electron を使用し、Markdown の編集・プレビュー、ローカルファイルの読み書き、PDF出力を行うための初期実装です。

## 開発環境

- Node.js 20 以降
- npm

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run dist
```

生成物は `dist/` に出力されます。macOS（DMG）、Windows（NSIS）、Linux（AppImage / deb）を設定しています。

## 現在の機能

- Graphite系のダークUI
- Markdown入力とライブプレビュー
- Markdown / textファイルを開く・保存する
- A4 PDF出力（OSの印刷機能を利用）
- Electron の `contextIsolation` と `nodeIntegration: false`
- ファイル操作を preload 経由の限定APIに分離

## 制限事項

現段階のMarkdownプレビューは軽量な独自実装です。表、数式、脚注、複雑なMarkdown拡張など、Web版の全機能との互換性はまだありません。PDFはプレビュー内容を印刷する方式です。

## セキュリティ

レンダラーからNode.js APIを直接利用できない構成です。MarkdownはHTMLとして直接信頼せず、テキストをエスケープしてから限定的な書式を適用します。
