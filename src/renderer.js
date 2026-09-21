const editor = document.querySelector('#editor');
const preview = document.querySelector('#preview');
const status = document.querySelector('#status');
let currentPath = null;

// Minimal safe Markdown renderer: escapes HTML before applying supported syntax.
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function inlineMarkdown(value) {
  return value
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
function renderMarkdown(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let paragraph = [], list = null, code = false, codeLines = [];
  const flushParagraph = () => { if (paragraph.length) { out.push(`<p>${inlineMarkdown(escapeHtml(paragraph.join(' ')))}</p>`); paragraph = []; } };
  const flushList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of lines) {
    if (/^```/.test(line)) {
      flushParagraph(); flushList();
      if (code) { out.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`); codeLines = []; }
      code = !code; continue;
    }
    if (code) { codeLines.push(line); continue; }
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { flushParagraph(); flushList(); const n = heading[1].length; out.push(`<h${n}>${inlineMarkdown(escapeHtml(heading[2]))}</h${n}>`); continue; }
    if (/^>\s?/.test(line)) { flushParagraph(); flushList(); out.push(`<blockquote>${inlineMarkdown(escapeHtml(line.replace(/^>\s?/, '')))}</blockquote>`); continue; }
    const item = line.match(/^\s*[-*+]\s+(.+)$/);
    if (item) { flushParagraph(); if (list !== 'ul') { flushList(); list = 'ul'; out.push('<ul>'); } out.push(`<li>${inlineMarkdown(escapeHtml(item[1]))}</li>`); continue; }
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) { flushParagraph(); if (list !== 'ol') { flushList(); list = 'ol'; out.push('<ol>'); } out.push(`<li>${inlineMarkdown(escapeHtml(ordered[1]))}</li>`); continue; }
    flushList(); paragraph.push(line);
  }
  flushParagraph(); flushList();
  if (code) out.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  return out.join('\n');
}
function updatePreview() { preview.innerHTML = renderMarkdown(editor.value); }
editor.addEventListener('input', () => { updatePreview(); status.textContent = currentPath ? currentPath.split(/[\\/]/).pop() + ' · 未保存の変更' : '未保存の変更'; });
document.querySelector('#open').addEventListener('click', async () => {
  try { const file = await window.ediput.openFile(); if (!file) return; editor.value = file.content; currentPath = file.path; status.textContent = file.name; updatePreview(); }
  catch (error) { alert(`ファイルを開けませんでした: ${error.message}`); }
});
document.querySelector('#save').addEventListener('click', async () => {
  try { const saved = await window.ediput.saveFile(currentPath, editor.value); if (!saved) return; currentPath = saved.path; status.textContent = saved.name + ' · 保存済み'; }
  catch (error) { alert(`保存できませんでした: ${error.message}`); }
});
document.querySelector('#pdf').addEventListener('click', async () => {
  try { await window.ediput.exportPdf(); }
  catch (error) { alert(`PDFを出力できませんでした: ${error.message}`); }
});
updatePreview();
