import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import initSqlJs, { Database, SqlJsStatic } from 'sql.js'

let SQL: SqlJsStatic | null = null
let db: Database | null = null

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'syncstay.db')
}

function getWasmPath(): string {
  // In dev: node_modules/sql.js/dist/sql-wasm.wasm
  // In prod: resources/sql-wasm.wasm (copied by electron-builder extraResources)
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'sql-wasm.wasm')
  }
  return path.join(
    __dirname,
    '../../node_modules/sql.js/dist/sql-wasm.wasm'
  )
}

export async function initDatabase(): Promise<void> {
  const wasmPath = getWasmPath()
  const wasmBuffer = fs.readFileSync(wasmPath)

  SQL = await initSqlJs({ wasmBinary: wasmBuffer })

  const dbPath = getDbPath()
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // Enable WAL mode for better concurrency
  db.run('PRAGMA journal_mode=WAL;')
  db.run('PRAGMA foreign_keys=ON;')

  createSchema()
  applyMigrations()
  saveDatabase()
  console.log('[DB] SQLite initialized at', dbPath)
}

function createSchema(): void {
  db!.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT NOT NULL UNIQUE,
      room_type TEXT NOT NULL DEFAULT 'Standard',
      floor INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'available'
        CHECK(status IN ('available','occupied','maintenance','checkout')),
      price_per_night REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db!.run(`
    CREATE TABLE IF NOT EXISTS booking_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_reference TEXT NOT NULL UNIQUE,
      check_in_time TEXT NOT NULL DEFAULT (datetime('now')),
      check_out_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'checked_in'
        CHECK(status IN ('checked_in','checked_out','cancelled')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  db!.run(`
    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES booking_groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      age INTEGER,
      sex TEXT CHECK(sex IN ('male','female','other')),
      photo_path TEXT,
      id_proof_path TEXT,
      is_primary_contact INTEGER NOT NULL DEFAULT 0
    )
  `)

  db!.run(`
    CREATE TABLE IF NOT EXISTS room_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES booking_groups(id) ON DELETE CASCADE,
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      allocated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(room_id, group_id)
    )
  `)
}

function applyMigrations(): void {
  // guests.phone
  const gCols = dbAll(`PRAGMA table_info(guests)`)
  if (!gCols.find((c) => c.name === 'phone')) {
    db!.run(`ALTER TABLE guests ADD COLUMN phone TEXT`)
    console.log('[DB] Migration: guests.phone added')
  }
  // booking_groups.id_proof_path (group document photo)
  const bgCols = dbAll(`PRAGMA table_info(booking_groups)`)
  if (!bgCols.find((c) => c.name === 'id_proof_path')) {
    db!.run(`ALTER TABLE booking_groups ADD COLUMN id_proof_path TEXT`)
    console.log('[DB] Migration: booking_groups.id_proof_path added')
  }
}

export function saveDatabase(): void {
  if (!db) return
  const data = db.export()
  fs.writeFileSync(getDbPath(), Buffer.from(data))
}

export function getDb(): Database {
  if (!db) throw new Error('[DB] Database not initialized')
  return db
}

// Helper: run a query and return all rows as plain objects
export function dbAll(sql: string, params: any[] = []): Record<string, any>[] {
  const stmt = getDb().prepare(sql)
  stmt.bind(params)
  const rows: Record<string, any>[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

// Helper: run a query and return first row or null
export function dbGet(sql: string, params: any[] = []): Record<string, any> | null {
  const rows = dbAll(sql, params)
  return rows[0] ?? null
}

// Helper: run INSERT/UPDATE/DELETE, return lastInsertRowid
export function dbRun(sql: string, params: any[] = []): number {
  try {
    const stmt = getDb().prepare(sql)
    stmt.run(params)
    stmt.free()
    // MUST read rowid BEFORE saveDatabase (export doesn't reset it, but order matters)
    const rowid = (getDb().exec('SELECT last_insert_rowid()')[0]?.values?.[0]?.[0] as number) ?? 0
    saveDatabase()
    return rowid
  } catch (err) {
    console.error('[DB] dbRun ERROR:', sql, '\nParams:', params, '\nError:', err)
    throw err
  }
}

// Auto-checkout bookings whose check_out_date has passed.
// Called on every app boot — works even if app was closed for multiple days.
export function autoCheckoutOverdue(): void {
  try {
    const overdue = dbAll(
      `SELECT id FROM booking_groups WHERE status = 'checked_in' AND check_out_date < date('now')`
    )
    if (!overdue.length) return
    console.log(`[DB] Auto-checking out ${overdue.length} overdue booking(s)`)
    for (const b of overdue) {
      // Free rooms
      const allocs = dbAll(`SELECT room_id FROM room_allocations WHERE group_id = ?`, [b.id])
      for (const a of allocs) {
        dbRun(`UPDATE rooms SET status = 'available', updated_at = datetime('now') WHERE id = ?`, [Number(a.room_id)])
      }
      dbRun(`UPDATE booking_groups SET status = 'checked_out' WHERE id = ?`, [Number(b.id)])
      console.log(`[DB] Auto-checked out booking id=${b.id}`)
    }
  } catch (err) {
    console.error('[DB] autoCheckoutOverdue error:', err)
  }
}
