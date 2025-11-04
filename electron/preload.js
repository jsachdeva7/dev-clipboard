import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fsAPI', {
  parseDroppedPaths: (paths) => ipcRenderer.invoke('parse-paths', paths)
})