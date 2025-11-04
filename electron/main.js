import { app, BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url';
import { screen } from 'electron'


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow () {
    const windowWidth = 400
    const windowHeight = 250

    const win = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        alwaysOnTop: true,
        frame: false,
        resizable: false,
        skipTaskbar: true,
        transparent: false,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js')
        }
    })

    const { width: screenWidth, height: screenHeight} = screen.getPrimaryDisplay().workAreaSize
    const x = screenWidth - windowWidth - 20
    const y = screenHeight - windowHeight - 20
    win.setPosition(x, y)

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
})
