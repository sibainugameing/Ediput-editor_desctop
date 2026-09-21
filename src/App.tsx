import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { open, save, message } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import DOMPurify from "dompurify";
import { marked } from "marked";
import {
  FileOutput,
  FileText,
  FolderOpen,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Sun,
  Moon,
} from "lucide-react";
import "./styles.css";

const editorTheme = EditorView.theme({
  "&": { backgroundColor: "#0f1419", color: "#dfe7ee", height: "100%" },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontSize: "14px",
    lineHeight: "1.75",
    overflow: "auto",
  },
  ".cm-content": { padding: "24px", caretColor: "#7dd3fc" },
  ".cm-gutters": { backgroundColor: "#0f1419", color: "#566474", border: "none" },
  ".cm-activeLine": { backgroundColor: "rgba(125, 211, 252, 0.045)" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(125, 211, 252, 0.045)" },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(125, 211, 252, 0.22) !important",
  },
});

marked.setOptions({ gfm: true, breaks: false });

const initialDocument = [
  "# Ediputへようこそ",
  "",
  "高速なMarkdown編集とライブプレビューを、デスクトップで。",
  "",
  "## できること",
  "",
  "- **Markdown** をそのまま編集",
  "- 右側でリアルタイムプレビュー",
  "- ローカルファイルを開く・保存",
  "- PDF出力はシステムの印刷機能から実行",
  "",
  "> UIと編集レスポンスを優先して設計しています。",
  "",
  "`# Hello, Ediput`",
  "",
].join("\n");

function baseName(path: string) {
  return path.split(/[\\/]/).pop() || "無題";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readStoredBoolean(key: string, fallback: boolean) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function readStoredNumber(key: string, fallback: number) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [source, setSource] = useState(initialDocument);
  const [previewSource, setPreviewSource] = useState(initialDocument);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("新規ドキュメント");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(() => readStoredBoolean("ediput-theme-dark", true));
  const [editorRatio, setEditorRatio] = useState(() =>
    clamp(readStoredNumber("ediput-editor-ratio", 0.5), 0.3, 0.7),
  );
  const [resizing, setResizing] = useState(false);
  const saveLock = useRef(false);
  const workspaceRef = useRef<HTMLElement | null>(null);

  const deferredSource = useDeferredValue(source);

  useEffect(() => {
    const id = window.setTimeout(() => setPreviewSource(deferredSource), 60);
    return () => window.clearTimeout(id);
  }, [deferredSource]);

  useEffect(() => {
    try {
      localStorage.setItem("ediput-theme-dark", String(dark));
    } catch {
      // Ignore unavailable local storage.
    }
  }, [dark]);

  useEffect(() => {
    try {
      localStorage.setItem("ediput-editor-ratio", String(editorRatio));
    } catch {
      // Ignore unavailable local storage.
    }
  }, [editorRatio]);

  useEffect(() => {
    if (!resizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const workspace = workspaceRef.current;
      if (!workspace) return;

      const rect = workspace.getBoundingClientRect();
      const sidebarWidth = window.innerWidth <= 900 || !sidebarOpen ? 0 : 190;
      const contentWidth = rect.width - sidebarWidth;
      if (contentWidth <= 0) return;

      setEditorRatio(
        clamp((event.clientX - rect.left - sidebarWidth) / contentWidth, 0.3, 0.7),
      );
    };

    const handlePointerUp = () => setResizing(false);

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.body.classList.add("is-resizing");

    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.body.classList.remove("is-resizing");
    };
  }, [resizing, sidebarOpen]);

  const previewHtml = useMemo(
    () => DOMPurify.sanitize(marked.parse(previewSource) as string),
    [previewSource],
  );

  const onEdit = (value: string) => {
    setSource(value);
    setDirty(true);
    setStatus(currentPath ? baseName(currentPath) + " · 未保存" : "未保存の変更");
  };

  const openDocument = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        fileAccessMode: "scoped",
        filters: [
          { name: "Markdown", extensions: ["md", "markdown"] },
          { name: "Text", extensions: ["txt"] },
          { name: "All files", extensions: ["*"] },
        ],
        title: "Markdownファイルを開く",
      });
      if (!selected || Array.isArray(selected)) return;

      const content = await readTextFile(selected);
      setSource(content);
      setPreviewSource(content);
      setCurrentPath(selected);
      setDirty(false);
      setStatus(baseName(selected));
    } catch (error) {
      console.error(error);
      await message("ファイルを開けませんでした。", { title: "Ediput", kind: "error" });
    }
  };

  const saveDocument = async () => {
    if (saveLock.current) return;
    saveLock.current = true;

    try {
      let target = currentPath;

      if (!target) {
        target = await save({
          defaultPath: "untitled.md",
          filters: [{ name: "Markdown", extensions: ["md"] }],
          title: "Markdownファイルを保存",
        });
      }

      if (!target) return;

      await writeTextFile(target, source);
      setCurrentPath(target);
      setDirty(false);
      setStatus(baseName(target) + " · 保存済み");
    } catch (error) {
      console.error(error);
      await message("保存できませんでした。", { title: "Ediput", kind: "error" });
    } finally {
      saveLock.current = false;
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if ((event.metaKey || event.ctrlKey) && key === "s") {
        event.preventDefault();
        void saveDocument();
      }

      if ((event.metaKey || event.ctrlKey) && key === "o") {
        event.preventDefault();
        void openDocument();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleDividerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setEditorRatio(value => clamp(value - 0.02, 0.3, 0.7));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setEditorRatio(value => clamp(value + 0.02, 0.3, 0.7));
    }
  };

  const lineCount = source ? source.split("\n").length : 1;
  const characterCount = source.length;
  const workspaceStyle = {
    "--editor-ratio": editorRatio,
  } as React.CSSProperties;

  return (
    <div className={dark ? "app dark" : "app light"}>
      <header className="topbar">
        <div className="brand">
          <button
            className="icon-button menu-button"
            onClick={() => setSidebarOpen(value => !value)}
            aria-label="サイドバー"
          >
            <Menu size={18} />
          </button>
          <div className="brand-mark">E</div>
          <div className="brand-copy">
            <strong>Ediput</strong>
            <span>DESKTOP</span>
          </div>
        </div>

        <div className="toolbar">
          <button onClick={() => void openDocument()} title="開く">
            <FolderOpen size={16} />
            <span>開く</span>
          </button>
          <button onClick={() => void saveDocument()} title="保存">
            <Save size={16} />
            <span>保存</span>
          </button>
          <button className="accent" onClick={() => window.print()} title="PDF / 印刷">
            <FileOutput size={16} />
            <span>PDF</span>
          </button>
          <button
            className="icon-button"
            onClick={() => setDark(value => !value)}
            aria-label="テーマ切替"
            title="テーマ切替"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      <main
        ref={workspaceRef}
        className={sidebarOpen ? "workspace" : "workspace collapsed"}
        style={workspaceStyle}
      >
        <aside className="sidebar">
          <div className="sidebar-header">
            <span>DOCUMENT</span>
            <button
              className="icon-button"
              onClick={() => setSidebarOpen(false)}
              aria-label="閉じる"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          <div className="file-card active">
            <FileText size={15} />
            <div>
              <strong>{currentPath ? baseName(currentPath) : "Untitled.md"}</strong>
              <span>{dirty ? "未保存" : "保存済み"}</span>
            </div>
          </div>

          <div className="sidebar-bottom">
            <span>Local-first</span>
            <span>macOS · Windows · Linux</span>
          </div>
        </aside>

        {!sidebarOpen && (
          <button
            className="reopen-sidebar icon-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="サイドバーを開く"
          >
            <PanelLeftOpen size={17} />
          </button>
        )}

        <section className="panel">
          <div className="panel-header">
            <span>MARKDOWN</span>
            <span className={dirty ? "dirty" : "muted"}>{status}</span>
          </div>
          <div className="editor-host">
            <CodeMirror
              value={source}
              height="100%"
              theme={editorTheme}
              extensions={[markdown({ base: markdownLanguage })]}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                rectangularSelection: false,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
              }}
              onChange={onEdit}
              aria-label="Markdown editor"
            />
          </div>
        </section>

        <button
          type="button"
          className="pane-divider"
          aria-label="エディタとプレビューの幅を変更"
          aria-orientation="vertical"
          aria-valuemin={30}
          aria-valuemax={70}
          aria-valuenow={Math.round(editorRatio * 100)}
          onPointerDown={event => {
            event.preventDefault();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            setResizing(true);
          }}
          onKeyDown={handleDividerKeyDown}
          title="ドラッグまたは左右キーで幅を変更"
        />

        <section className="panel">
          <div className="panel-header">
            <span>PREVIEW</span>
            <span className="live"><i /> LIVE</span>
          </div>
          <article className="markdown preview-content" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </section>
      </main>

      <footer className="statusbar">
        <span>Ediput Desktop</span>
        <span>{lineCount} lines · {characterCount.toLocaleString()} chars · Markdown · Local files</span>
      </footer>

      <div className="print-only">
        <article className="markdown" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </div>
    </div>
  );
}
