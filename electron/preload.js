const { contextBridge, ipcRenderer, webUtils } = require('electron')

// Expose the API immediately
try {
  const fsAPI = {
    parseDroppedPaths: (paths) => {
      console.log('parseDroppedPaths called with:', paths)
      return ipcRenderer.invoke('parse-paths', paths)
    },
    getFilePath: (file) => {
      try {
        // Use webUtils.getPathForFile for File objects from drag and drop
        return path
      } catch (error) {
        console.error('Error getting file path:', error)
        throw error
      }
    },
  }
  
  contextBridge.exposeInMainWorld("fsAPI", fsAPI)
} catch (error) {
  console.error('Error exposing fsAPI:', error)
  console.error('Error stack:', error.stack)
}