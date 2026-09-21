const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ediput', {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', { filePath, content }),
  exportPdf: () => ipcRenderer.invoke('file:export-pdf')
});
