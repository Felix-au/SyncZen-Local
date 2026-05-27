import { app, shell, BrowserWindow, ipcMain, dialog, session } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { electronApp } from '@electron-toolkit/utils'
import { exec } from 'child_process'
import { promisify } from 'util'
import { initDatabase, dbAll, dbGet, dbRun, autoCheckoutOverdue } from './db'
import { loadConfig, getApiToken, isSetupComplete, markSetupComplete, regenerateToken } from './config'
import { startApiServer, stopApiServer, getLocalIp, apiPort } from './api'

// Disable GPU acceleration to prevent FATAL crashes in virtual/RDP/VM environments
app.disableHardwareAcceleration()

const execAsync = promisify(exec)

/**
 * Ensures the Windows Firewall allows inbound traffic on port 8080.
 * If the rule is missing, spawns an elevated PowerShell (UAC prompt) to add it.
 * Safe to call on every launch — does nothing if the rule already exists.
 */
async function ensureFirewallRule(): Promise<void> {
  if (process.platform !== 'win32') return
  try {
    const { stdout } = await execAsync('netsh advfirewall firewall show rule name="SyncStay-API"').catch(() => ({ stdout: '' }))
    if (stdout.includes('SyncStay-API')) {
      console.log('[Firewall] Rule already present — skipping')
      return
    }
    console.log('[Firewall] Rule missing — requesting elevation to add it...')
    // Start-Process with -Verb RunAs triggers Windows UAC elevation dialog
    await execAsync(
      `powershell -Command "Start-Process -FilePath 'netsh' -ArgumentList 'advfirewall firewall add rule name=SyncStay-API dir=in action=allow protocol=TCP localport=8080' -Verb RunAs -Wait"`
    )
    console.log('[Firewall] Rule added successfully')
  } catch (err: any) {
    // Non-fatal: user cancelled UAC or policy blocks elevation
    console.warn('[Firewall] Could not add rule (user may have cancelled UAC):', err.message)
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'SyncStay',
    backgroundColor: '#080E1A',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['NODE_ENV'] === 'development' && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.syncstay.desktop')

  // Allow camera access for photo capture
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media')
  })

  // Open devtools on F12 in dev
  app.on('browser-window-created', (_, win) => {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.key === 'F12') win.webContents.openDevTools()
    })
  })

  // Register all IPC handlers
  registerIpcHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await stopApiServer()
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {

  // ── Setup flow ──────────────────────────────────────────────────────────────
  ipcMain.handle('setup:isComplete', () => isSetupComplete())

  ipcMain.handle('setup:run', async (event) => {
    const send = (step: string, status: 'running' | 'done' | 'error', detail?: string) => {
      event.sender.send('setup:progress', { step, status, detail })
    }

    try {
      // Step 1: Database
      send('Initializing database', 'running')
      await initDatabase()
      send('Initializing database', 'done')

      // Step 2: Firewall rule
      send('Adding firewall rule for port 8080', 'running')
      try {
        await ensureFirewallRule()
        send('Adding firewall rule for port 8080', 'done')
      } catch {
        send('Adding firewall rule for port 8080', 'done', 'Skipped (UAC cancelled or not supported)')
      }

      // Step 3: Token
      send('Generating pairing token', 'running')
      loadConfig() // ensures token is generated
      send('Generating pairing token', 'done')

      // Step 4: API Server
      send('Starting API server', 'running')
      await startApiServer()
      send('Starting API server', 'done')

      markSetupComplete()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // On subsequent launches (setup already done), start everything silently
  ipcMain.handle('app:boot', async () => {
    if (!isSetupComplete()) return { needsSetup: true }
    try {
      await initDatabase()
      autoCheckoutOverdue()   // check out any past-due bookings on every launch
      ensureFirewallRule()    // ensure port 8080 is open (non-blocking)
      await startApiServer()
      return { needsSetup: false, port: apiPort }
    } catch (err: any) {
      return { needsSetup: false, error: err.message }
    }
  })

  // ── Rooms ────────────────────────────────────────────────────────────────────
  ipcMain.handle('rooms:list', () => {
    return dbAll(`
      SELECT r.*,
        bg.booking_reference, bg.check_out_date,
        GROUP_CONCAT(g.name, ', ') AS guest_names
      FROM rooms r
      LEFT JOIN room_allocations ra ON ra.room_id = r.id
      LEFT JOIN booking_groups bg ON bg.id = ra.group_id AND bg.status = 'checked_in'
      LEFT JOIN guests g ON g.group_id = bg.id
      GROUP BY r.id
      ORDER BY r.floor, r.room_number
    `)
  })

  ipcMain.handle('rooms:add', (_e, { room_number, room_type, floor, price_per_night, notes }) => {
    const id = dbRun(
      `INSERT INTO rooms (room_number, room_type, floor, price_per_night, notes) VALUES (?, ?, ?, ?, ?)`,
      [room_number, room_type ?? 'Standard', floor ?? 1, price_per_night ?? 0, notes ?? null]
    )
    return { id }
  })

  ipcMain.handle('rooms:updateStatus', (_e, { id, status }) => {
    dbRun(`UPDATE rooms SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id])
    return { ok: true }
  })

  ipcMain.handle('rooms:delete', (_e, { id }) => {
    const room = dbGet(`SELECT status FROM rooms WHERE id = ?`, [id])
    if (!room) return { error: 'Room not found' }
    if (room.status === 'occupied') return { error: 'Cannot delete occupied room' }
    dbRun(`DELETE FROM rooms WHERE id = ?`, [id])
    return { ok: true }
  })

  // ── Bookings ──────────────────────────────────────────────────────────────────
  ipcMain.handle('bookings:list', () => {
    return dbAll(`
      SELECT bg.*,
        GROUP_CONCAT(DISTINCT r.room_number) AS rooms,
        GROUP_CONCAT(DISTINCT g.name) AS guests
      FROM booking_groups bg
      LEFT JOIN room_allocations ra ON ra.group_id = bg.id
      LEFT JOIN rooms r ON r.id = ra.room_id
      LEFT JOIN guests g ON g.group_id = bg.id
      GROUP BY bg.id
      ORDER BY bg.check_in_time DESC
    `)
  })

  ipcMain.handle('bookings:checkout', (_e, { id }) => {
    const numId = Number(id)
    console.log('[IPC] bookings:checkout id=', numId)
    const booking = dbGet(`SELECT * FROM booking_groups WHERE id = ?`, [numId])
    if (!booking) { console.warn('[IPC] Booking not found:', numId); return { error: 'Booking not found' } }
    dbRun(`UPDATE booking_groups SET status = 'checked_out' WHERE id = ?`, [numId])
    const allocations = dbAll(`SELECT room_id FROM room_allocations WHERE group_id = ?`, [numId])
    console.log('[IPC] Freeing', allocations.length, 'rooms for group', numId)
    for (const a of allocations) {
      dbRun(`UPDATE rooms SET status = 'available', updated_at = datetime('now') WHERE id = ?`, [Number(a.room_id)])
    }
    return { ok: true }
  })

  // ── Check-in from desktop ─────────────────────────────────────────────────────
  ipcMain.handle('checkin:submit', (_e, { guests, room_ids, check_out_date, notes, document_path }) => {
    try {
      const ref = 'SS' + Date.now().toString(36).toUpperCase()
      const groupId = dbRun(
        `INSERT INTO booking_groups (booking_reference, check_out_date, notes, id_proof_path) VALUES (?, ?, ?, ?)`,
        [ref, check_out_date, notes ?? null, document_path ?? null]
      )
      for (const g of guests) {
        dbRun(
          `INSERT INTO guests (group_id, name, phone, age, sex, photo_path, is_primary_contact) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [groupId, g.name || '', g.phone || null, g.age ?? null, g.sex || null, g.photo_path || null, g.is_primary ? 1 : 0]
        )
      }
      for (const roomId of room_ids) {
        dbRun(`INSERT INTO room_allocations (group_id, room_id) VALUES (?, ?)`, [groupId, roomId])
        dbRun(`UPDATE rooms SET status = 'occupied', updated_at = datetime('now') WHERE id = ?`, [roomId])
      }
      return { ok: true, booking_reference: ref }
    } catch (err: any) {
      return { error: err.message }
    }
  })

  // ── Booking detail ────────────────────────────────────────────────────────────
  ipcMain.handle('bookings:detail', (_e, { id }) => {
    const numId = Number(id)
    console.log('[IPC] bookings:detail id=', numId)
    const booking = dbGet(`SELECT * FROM booking_groups WHERE id = ?`, [numId])
    if (!booking) { console.warn('[IPC] No booking found for id', numId); return null }
    const guests = dbAll(`SELECT * FROM guests WHERE group_id = ? ORDER BY is_primary_contact DESC, id`, [numId])
    const rooms  = dbAll(`SELECT r.* FROM rooms r JOIN room_allocations ra ON ra.room_id = r.id WHERE ra.group_id = ?`, [numId])
    console.log('[IPC] Detail: booking', booking.booking_reference, '| guests', guests.length, '| rooms', rooms.length)
    return { booking, guests, rooms }
  })

  // ── Read any local file as base64 data URL (avoids file:// cross-origin block) ─
  ipcMain.handle('photo:getDataUrl', (_e, filePath: string) => {
    if (!filePath) return null
    try {
      if (!fs.existsSync(filePath)) { console.warn('[Photo] File not found:', filePath); return null }
      const data = fs.readFileSync(filePath)
      const ext  = filePath.split('.').pop()?.toLowerCase() ?? 'jpg'
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                 : ext === 'png'  ? 'image/png'
                 : ext === 'webp' ? 'image/webp' : 'image/jpeg'
      return `data:${mime};base64,${data.toString('base64')}`
    } catch (e) {
      console.error('[Photo] getDataUrl error:', e); return null
    }
  })

  // ── Save camera-captured photo to disk ──────────────────────────────────────
  ipcMain.handle('photo:save', async (_e, { dataUrl, prefix = 'photo' }) => {
    const photosDir = join(app.getPath('userData'), 'photos')
    fs.mkdirSync(photosDir, { recursive: true })
    const fileName = `${prefix}_${Date.now()}.jpg`
    const filePath = join(photosDir, fileName)
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
    console.log('[Photo] Saved:', filePath)
    return filePath
  })

  // ── Image file picker dialog ───────────────────────────────────────────────
  ipcMain.handle('dialog:pickImage', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'heic'] }]
    })
    if (result.canceled || !result.filePaths.length) return null
    return result.filePaths[0]
  })

  // ── Dashboard stats ────────────────────────────────────────────────────────────
  ipcMain.handle('stats:get', () => {
    const rooms = dbGet(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status='occupied' THEN 1 ELSE 0 END) as occupied,
        SUM(CASE WHEN status='maintenance' THEN 1 ELSE 0 END) as maintenance,
        SUM(CASE WHEN status='checkout' THEN 1 ELSE 0 END) as checkout
      FROM rooms
    `)
    const todayCheckins = dbGet(
      `SELECT COUNT(*) as count FROM booking_groups WHERE date(check_in_time) = date('now') AND status = 'checked_in'`
    )
    const activeBookings = dbGet(
      `SELECT COUNT(*) as count FROM booking_groups WHERE status = 'checked_in'`
    )
    const recentBookings = dbAll(`
      SELECT bg.booking_reference, bg.check_in_time, bg.check_out_date, bg.status,
        GROUP_CONCAT(DISTINCT g.name) as guests,
        GROUP_CONCAT(DISTINCT r.room_number) as rooms
      FROM booking_groups bg
      LEFT JOIN guests g ON g.group_id = bg.id AND g.is_primary_contact = 1
      LEFT JOIN room_allocations ra ON ra.group_id = bg.id
      LEFT JOIN rooms r ON r.id = ra.room_id
      GROUP BY bg.id
      ORDER BY bg.check_in_time DESC LIMIT 5
    `)
    return { rooms, today_checkins: todayCheckins?.count ?? 0, active_bookings: activeBookings?.count ?? 0, recent: recentBookings }
  })

  // ── Server info / QR ──────────────────────────────────────────────────────────
  ipcMain.handle('server:info', async () => {
    const QRCode = await import('qrcode')
    const ip = getLocalIp()
    const port = apiPort
    const url = `http://${ip}:${port}`
    const token = getApiToken()
    const qr = await QRCode.default.toDataURL(JSON.stringify({ url, token }), {
      width: 256, margin: 2,
      color: { dark: '#F5F5F0', light: '#0D1B2E' }
    })
    return { ip, port, url, token, qr }
  })

  ipcMain.handle('server:regenerateToken', () => {
    return { token: regenerateToken() }
  })

  // ── Available rooms (for check-in form) ───────────────────────────────────────
  ipcMain.handle('rooms:available', () => {
    return dbAll(`SELECT * FROM rooms WHERE status = 'available' ORDER BY floor, room_number`)
  })
}
