import { app, BrowserWindow, ipcMain, clipboard, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url';
import { screen } from 'electron'
import { existsSync, createWriteStream, unlinkSync } from 'fs'
import fs from 'fs/promises'
import { parsePaths } from './parsePaths.js'
import { watchFile, unwatchFile, unwatchAll } from './fileWatcher.js'
import http from 'http'
import archiver from 'archiver'
import os from 'os'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null
const tempZipFiles = new Set() // Track temp zip files for cleanup

ipcMain.handle('parse-paths', async (event, paths) => {
  return await parsePaths(paths)
})

ipcMain.handle('watch-file', async (event, filePath) => {
  // Normalize path for Windows
  const normalizedPath = filePath.replace(/\\/g, '/')
  watchFile(normalizedPath, async (changedPath) => {
    try {
      const content = await fs.readFile(changedPath, 'utf-8')
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('file-changed', { filePath: changedPath, content })
      }
    } catch (error) {
      console.error(`Error reading changed file ${changedPath}:`, error)
    }
  })
})

ipcMain.handle('unwatch-file', async (event, filePath) => {
  const normalizedPath = filePath.replace(/\\/g, '/')
  unwatchFile(normalizedPath)
})

ipcMain.on('close-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close()
  }
})

ipcMain.handle('zip-directory', async (event, nodes) => {
  try {
    // Create zip file in temp directory (will be cleaned up on app close)
    const tempDir = os.tmpdir()
    const zipPath = path.resolve(tempDir, `clipboard-${Date.now()}.zip`)
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    return new Promise((resolve, reject) => {
      output.on('close', async () => {
        // Track temp file for cleanup
        tempZipFiles.add(zipPath)
        
        try {
          // Ensure file exists and is fully written
          await fs.access(zipPath)
          
          // Copy zip file path to clipboard as text
          clipboard.writeText(zipPath)
          
          console.log('Copied zip file path to clipboard:', zipPath)
          resolve({ success: true, path: zipPath })
        } catch (clipboardError) {
          console.error('Error copying to clipboard:', clipboardError)
          reject(clipboardError)
        }
      })

      archive.on('error', (err) => {
        reject(err)
      })

      archive.pipe(output)

      // Helper function to add files recursively
      const addNodeToArchive = (node, parentPath = '') => {
        const currentPath = parentPath ? `${parentPath}/${node.name}` : node.name
        
        if (node.type === 'file') {
          // Add file content from memory
          if (node.content !== undefined) {
            archive.append(node.content, { name: currentPath })
          } else if (node.filePath) {
            // Read from disk if content not in memory
            archive.file(node.filePath, { name: currentPath })
          }
        } else if (node.type === 'folder' && node.children) {
          node.children.forEach(child => addNodeToArchive(child, currentPath))
        }
      }

      // Add all nodes to archive
      nodes.forEach(node => addNodeToArchive(node))
      
      archive.finalize()
    })
  } catch (error) {
    console.error('Error creating zip:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('show-item-in-folder', async (event, filePath) => {
  try {
    shell.showItemInFolder(filePath)
    return { success: true }
  } catch (error) {
    console.error('Error showing item in folder:', error)
    return { success: false, error: error.message }
  }
})

// Helper function to wait for Vite dev server to be ready
function waitForServer(url, maxAttempts = 30, delay = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const checkServer = () => {
      attempts++
      const urlObj = new URL(url)
      const req = http.get({
        hostname: urlObj.hostname,
        port: urlObj.port || 5173,
        path: '/',
        timeout: 1000
      }, (res) => {
        resolve()
      })
      
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          reject(new Error(`Server at ${url} did not become available after ${maxAttempts} attempts`))
        } else {
          setTimeout(checkServer, delay)
        }
      })
      
      req.on('timeout', () => {
        req.destroy()
        if (attempts >= maxAttempts) {
          reject(new Error(`Server at ${url} did not become available after ${maxAttempts} attempts`))
        } else {
          setTimeout(checkServer, delay)
        }
      })
    }
    checkServer()
  })
}

function createWindow () {
    const windowWidth = 360
    const windowHeight = 220

    const preloadPath = path.resolve(__dirname, 'preload.js')
    
    if (!existsSync(preloadPath)) {
      console.error('ERROR: Preload script not found at:', preloadPath)
    }

    const win = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        alwaysOnTop: true,
        frame: false,
        resizable: false,
        skipTaskbar: true,
        transparent: false,
        webPreferences: {
          preload: preloadPath,
          contextIsolation: true,
          nodeIntegration: false
        }
    })


    const { width: screenWidth, height: screenHeight} = screen.getPrimaryDisplay().workAreaSize
    const x = screenWidth - windowWidth - 20
    const y = screenHeight - windowHeight - 20
    win.setPosition(x, y)
    
    mainWindow = win
    
    win.on('closed', () => {
      unwatchAll()
      // Clean up temp zip files
      tempZipFiles.forEach(zipPath => {
        try {
          unlinkSync(zipPath)
          console.log('Deleted temp zip file:', zipPath)
        } catch (err) {
          console.error(`Error deleting temp zip file ${zipPath}:`, err)
        }
      })
      tempZipFiles.clear()
      mainWindow = null
    })

  if (process.env.VITE_DEV_SERVER_URL) {
    // Wait for Vite dev server to be ready before loading
    waitForServer(process.env.VITE_DEV_SERVER_URL)
      .then(() => {
        win.loadURL(process.env.VITE_DEV_SERVER_URL)
      })
      .catch((error) => {
        console.error('Error waiting for Vite server:', error)
        // Try loading anyway after a delay
        setTimeout(() => {
          win.loadURL(process.env.VITE_DEV_SERVER_URL)
        }, 2000)
      })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
})
