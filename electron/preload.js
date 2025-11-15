const { contextBridge, ipcRenderer, webUtils } = require('electron')

// Expose the API immediately
try {
  const fsAPI = {
    parseDroppedPaths: (paths) => {
      return ipcRenderer.invoke('parse-paths', paths)
    },
    getFilePath: (file) => {
      try {
        return webUtils.getPathForFile(file)
      } catch (error) {
        console.error('Error getting file path:', error)
        throw error
      }
    },
    watchFile: (filePath) => {
      return ipcRenderer.invoke('watch-file', filePath)
    },
    unwatchFile: (filePath) => {
      return ipcRenderer.invoke('unwatch-file', filePath)
    },
    onFileChanged: (callback) => {
      ipcRenderer.on('file-changed', (event, data) => callback(data))
    },
    removeFileChangedListener: () => {
      ipcRenderer.removeAllListeners('file-changed')
    },
    zipDirectory: (nodes) => {
      return ipcRenderer.invoke('zip-directory', nodes)
    },
    showItemInFolder: (filePath) => {
      return ipcRenderer.invoke('show-item-in-folder', filePath)
    },
    closeWindow: () => {
      ipcRenderer.send('close-window')
    },
  }
  
  contextBridge.exposeInMainWorld("fsAPI", fsAPI)
} catch (error) {
  console.error('Error exposing fsAPI:', error)
  console.error('Error stack:', error.stack)
}