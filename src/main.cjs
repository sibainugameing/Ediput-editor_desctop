const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    backgroundColor: '#171a1f',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }, { name: 'All files', extensions: ['*'] }] });
  if (result.canceled || !result.filePaths[0]) return null;
  const filePath = result.filePaths[0];
  return { path: filePath, name: path.basename(filePath), content: await fs.readFile(filePath, 'utf8') };
});
ipcMain.handle('file:save', async (_event, { filePath, content }) => {
  let target = filePath;
  if (!target) {
    const result = await dialog.showSaveDialog(win, { defaultPath: 'untitled.md', filters: [{ name: 'Markdown', extensions: ['md'] }] });
    if (result.canceled || !result.filePath) return null;
    target = result.filePath;
  }
  await fs.writeFile(target, content, 'utf8');
  return { path: target, name: path.basename(target) };
});
ipcMain.handle('file:export-pdf', async () => {
  const result = await dialog.showSaveDialog(win, { defaultPath: 'ediput-document.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (result.canceled || !result.filePath) return null;
  const data = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: 0.6, bottom: 0.6, left: 0.65, right: 0.65 } });
  await fs.writeFile(result.filePath, data);
  return result.filePath;
});
