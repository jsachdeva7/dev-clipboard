import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url';
import { screen } from 'electron'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import { parsePaths } from './parsePaths.js'
import { watchFile, unwatchFile, unwatchAll } from './fileWatcher.js'
import http from 'http'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null

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

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error)
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
