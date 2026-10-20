const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  assets: () => ipcRenderer.invoke("assets"),
  addImages: () => ipcRenderer.invoke("add-images"),
  openFolder: () => ipcRenderer.invoke("open-folder"),
  minimize: () => ipcRenderer.send("minimize"),
  toggleFull: () => ipcRenderer.send("toggle-full"),
  front: () => ipcRenderer.send("front"),
});
