import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { confirm, open, save, message } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import DOMPurify from "dompurify";
import { marked } from "marked";
import {
  FileOutput,
  FileText,
  FilePlus2,
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
  ".cm-content": { padding: "28px 24px", caretColor: "#7dd3fc" },
  ".cm-gutters": { backgroundColor: "#0f1419", color: "#566474", border: "none" },
  ".cm-activeLine": { backgroundColor: "rgba(125, 211, 252, 0.045)" },
  ".cm-activeLineGutter": { backgroundColor: "rgba(125, 211, 252, 0.045)" },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(125, 211, 252, 0.22) !important",
  },
});

marked.setOptions({ gfm: true, breaks: false });

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
  const [source, setSource] = useState("");
  const [previewSource, setPreviewSource] = useState("");
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("新規書類");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dark, setDark] = useState(() => readStoredBoolean("ediput-theme-dark", true));
  const [editorRatio, setEditorRatio] = useState(() =>
    clamp(readStoredNumber("ediput-editor-ratio", 0.5), 0.3, 0.7),
  );
  const [resizing, setResizing] = useState(false);
  const saveLock = useRef(false);
  const closeBypassRef = useRef(false);
  const workspaceRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setPreviewSource(source), 60);
    return () => window.clearTimeout(id);
  }, [source]);

  useEffect(() => {
    try {
      localStorage.setItem("ediput-theme-dark", String(dark));
      localStorage.setItem("ediput-editor-ratio", String(editorRatio));
    } catch {
      // Ignore unavailable local storage.
    }
  }, [dark, editorRatio]);

  useEffect(() => {
    const title = currentPath ? baseName(currentPath) : "無題";
    void getCurrentWebviewWindow().setTitle((dirty ? "● " : "") + title + " — Ediput");
  }, [currentPath, dirty]);

  useEffect(() => {
    if (!resizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const workspace = workspaceRef.current;
      if (!workspace) return;

      const rect = workspace.getBoundingClientRect();
      const sidebarWidth = window.innerWidth <= 900 || !sidebarOpen ? 0 : 194;
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
    setStatus(currentPath ? baseName(currentPath) + " · 未保存" : "未保存");
  };

  const confirmDiscard = async () => {
    if (!dirty) return true;
    return confirm("未保存の変更があります。破棄して続行しますか？", {
      title: "Ediput",
      kind: "warning",
    });
  };

  const createNewWindow = () => {
    const label = "editor-" + Date.now().toString(36);
    const window = new WebviewWindow(label, {
      url: "index.html",
      title: "無題 — Ediput",
      width: 1280,
      height: 820,
      minWidth: 960,
      minHeight: 620,
      resizable: true,
    });
    window.once("tauri://error", event => {
      console.error("新規ウィンドウを作成できませんでした", event);
    });
  };

  const openDocument = async () => {
    if (!(await confirmDiscard())) return;

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

  const printDocument = async () => {
    setStatus("PDF出力を準備中…");
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    try {
      await getCurrentWebviewWindow().print([]);
      setStatus("PDF / 印刷");
    } catch (error) {
      console.error("ネイティブ印刷に失敗しました", error);
      window.print();
      setStatus("PDF / 印刷");
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

  useEffect(() => {
    let cancelled = false;
    const subscriptions = [
      listen("ediput-menu-open", () => void openDocument()),
      listen("ediput-menu-save", () => void saveDocument()),
      listen("ediput-menu-pdf", () => void printDocument()),
      listen("ediput-menu-sidebar", () => setSidebarOpen(value => !value)),
      listen("ediput-menu-theme", () => setDark(value => !value)),
    ];

    void Promise.all(subscriptions).then(unsubscribers => {
      if (cancelled) {
        unsubscribers.forEach(unsubscribe => unsubscribe());
      }
    });

    return () => {
      cancelled = true;
      void Promise.all(subscriptions).then(unsubscribers => {
        unsubscribers.forEach(unsubscribe => unsubscribe());
      });
    };
  });

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void getCurrentWebviewWindow()
      .onCloseRequested(async event => {
        if (closeBypassRef.current || !dirty) return;

        event.preventDefault();

        const confirmed = await confirm("未保存の変更があります。保存せずに閉じますか？", {
          title: "Ediput",
          kind: "warning",
        });

        if (!confirmed) return;

        closeBypassRef.current = true;
        await getCurrentWebviewWindow().close();
      })
      .then(value => {
        unlisten = value;
      });

    return () => {
      unlisten?.();
    };
  }, [dirty]);

  const handleDividerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setEditorRatio(value => clamp(value - 0.02, 0.3, 0.7));
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setEditorRatio(value => clamp(value + 0.02, 0.3, 0.7));
    }
  };

  const lineCount = source ? source.split("\n").length : 0;
  const characterCount = source.length;
  const workspaceStyle = {
    "--editor-track": String(editorRatio) + "fr",
    "--preview-track": String(1 - editorRatio) + "fr",
  } as CSSProperties;

  return (
    <div className={dark ? "app dark" : "app light"}>
      <header className="topbar">
        <div className="topbar-side">
          <button
            className="icon-button menu-button"
            onClick={() => setSidebarOpen(value => !value)}
            aria-label="サイドバー"
            title="サイドバー"
          >
            <Menu size={18} />
          </button>
          <div className="brand-mark" aria-hidden="true">E</div>
          <div className="document-title">
            <strong>{currentPath ? baseName(currentPath) : "無題"}</strong>
            <span>{dirty ? "未保存" : "保存済み"}</span>
          </div>
        </div>

        <div className="toolbar">
          <button onClick={createNewWindow} title="新規ウィンドウ">
            <FilePlus2 size={16} />
            <span>新規</span>
          </button>
          <button onClick={() => void openDocument()} title="開く">
            <FolderOpen size={16} />
            <span>開く</span>
          </button>
          <button onClick={() => void saveDocument()} title="保存">
            <Save size={16} />
            <span>保存</span>
          </button>
          <button className="accent" onClick={() => void printDocument()} title="PDF / 印刷">
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
            <span>書類</span>
            <button
              className="icon-button"
              onClick={() => setSidebarOpen(false)}
              aria-label="サイドバーを閉じる"
              title="閉じる"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          <div className="file-card active">
            <FileText size={15} />
            <div>
              <strong>{currentPath ? baseName(currentPath) : "無題.md"}</strong>
              <span>{dirty ? "変更あり" : "ローカル書類"}</span>
            </div>
          </div>
        </aside>

        {!sidebarOpen && (
          <button
            className="reopen-sidebar icon-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="サイドバーを開く"
            title="サイドバーを開く"
          >
            <PanelLeftOpen size={17} />
          </button>
        )}

        <section className="panel">
          <div className="panel-header">
            <span>Markdown</span>
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
              aria-label="Markdownエディター"
            />
          </div>
        </section>

        <button
          type="button"
          className="pane-divider"
          aria-label="エディターとプレビューの幅を変更"
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

        <section className="panel preview-panel">
          <div className="panel-header">
            <span>プレビュー</span>
            <span className="preview-state">自動更新</span>
          </div>
          <article
            className="markdown preview-content"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </section>
      </main>

      <footer className="statusbar">
        <span>{dirty ? "未保存の変更" : "保存済み"}</span>
        <span>{lineCount} 行 · {characterCount.toLocaleString()} 文字</span>
      </footer>

      <div className="print-only">
        <article className="markdown" dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </div>
    </div>
  );
}
