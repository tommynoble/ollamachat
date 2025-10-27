const { contextBridge, ipcRenderer } = require('electron');

// Expose ipcRenderer to the renderer process
contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  once: (channel, listener) => ipcRenderer.once(channel, listener),
  removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
});
