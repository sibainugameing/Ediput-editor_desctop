import DOMPurify from "dompurify";
import { marked } from "marked";
import renderMathInElement from "katex/contrib/auto-render";
import "katex/dist/katex.min.css";

marked.setOptions({
  gfm: true,
  breaks: false,
});

const mathDelimiters = [
  { left: "$$", right: "$$", display: true },
  { left: "\\(", right: "\\)", display: false },
  { left: "\\[", right: "\\]", display: true },
  { left: "\\begin{equation}", right: "\\end{equation}", display: true },
  { left: "\\begin{align}", right: "\\end{align}", display: true },
  { left: "\\begin{alignat}", right: "\\end{alignat}", display: true },
  { left: "\\begin{gather}", right: "\\end{gather}", display: true },
  { left: "\\begin{CD}", right: "\\end{CD}", display: true },
];

export function renderMarkdown(source: string): string {
  const rendered = marked.parse(source) as string;
  const container = document.createElement("div");

  container.innerHTML = DOMPurify.sanitize(rendered);

  try {
    renderMathInElement(container, {
      delimiters: mathDelimiters,
      throwOnError: false,
      trust: false,
      strict: "warn",
      output: "htmlAndMathml",
      maxExpand: 1000,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
    });
  } catch (error) {
    console.error("数式のレンダリングに失敗しました", error);
  }

  return DOMPurify.sanitize(container.innerHTML);
}
