import { app, BrowserWindow, ipcMain, shell } from 'electron'
import * as path from 'path'
import { startApiServer, stopApiServer } from './server/api'
import { startDatabase, stopDatabase } from './server/db-launcher'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: '#0d0d0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'public', 'icon.ico'),
    show: false,
  })

  // Load the app
  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Handle external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Window control IPC
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window:close', () => mainWindow?.close())

async function bootstrap() {
  console.log('[Main] Starting Hotel Check-In Desktop...')

  // 1. Boot embedded MariaDB
  await startDatabase()

  // 2. Start Express API server
  const { port } = await startApiServer()
  console.log(`[Main] API server running on port ${port}`)

  // 3. Create Electron window
  await createWindow()
}

app.whenReady().then(bootstrap).catch(console.error)

app.on('window-all-closed', async () => {
  await stopApiServer()
  await stopDatabase()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
