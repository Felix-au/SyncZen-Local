import * as SQLite from 'expo-sqlite'

// ---------- Types ----------

export interface PendingGuest {
  name: string
  age?: number
  sex?: 'male' | 'female' | 'other'
  localPhotoUri?: string   // local file:// URI before upload
  serverPhotoPath?: string // path returned by server after upload
  is_primary_contact: boolean
}

export interface PendingCheckin {
  id: number
  uuid: string
  created_at: string
  check_out_date: string
  room_ids: number[]         // stored as JSON string in DB
  guests: PendingGuest[]     // stored as JSON string in DB
  local_id_proof_uri?: string
  server_id_proof_path?: string
  notes?: string
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  retry_count: number
}

// ---------- Database ----------

let db: SQLite.SQLiteDatabase | null = null

export async function openQueue(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db
  db = await SQLite.openDatabaseAsync('offline_queue.db')
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_checkins (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid            TEXT NOT NULL UNIQUE,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      check_out_date  TEXT NOT NULL,
      room_ids_json   TEXT NOT NULL,
      guests_json     TEXT NOT NULL,
      local_id_proof_uri     TEXT,
      server_id_proof_path   TEXT,
      notes           TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      retry_count     INTEGER NOT NULL DEFAULT 0
    );
  `)
  return db
}

// ---------- Queue Operations ----------

export async function enqueueCheckin(
  data: Omit<PendingCheckin, 'id' | 'uuid' | 'created_at' | 'status' | 'retry_count'>
): Promise<string> {
  const db = await openQueue()
  const uuid = generateUUID()
  await db.runAsync(
    `INSERT INTO pending_checkins (uuid, check_out_date, room_ids_json, guests_json, local_id_proof_uri, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuid, data.check_out_date, JSON.stringify(data.room_ids), JSON.stringify(data.guests), data.local_id_proof_uri ?? null, data.notes ?? null]
  )
  return uuid
}

export async function getPendingCheckins(): Promise<PendingCheckin[]> {
  const db = await openQueue()
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM pending_checkins WHERE status IN ('pending', 'failed') ORDER BY created_at ASC`
  )
  return rows.map(deserializeRow)
}

export async function getAllQueueItems(): Promise<PendingCheckin[]> {
  const db = await openQueue()
  const rows = await db.getAllAsync<any>(`SELECT * FROM pending_checkins ORDER BY created_at DESC`)
  return rows.map(deserializeRow)
}

export async function getPendingCount(): Promise<number> {
  const db = await openQueue()
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_checkins WHERE status IN ('pending', 'failed')`
  )
  return result?.count ?? 0
}

export async function markSyncing(uuid: string): Promise<void> {
  const db = await openQueue()
  await db.runAsync(`UPDATE pending_checkins SET status = 'syncing' WHERE uuid = ?`, [uuid])
}

export async function markSynced(uuid: string): Promise<void> {
  const db = await openQueue()
  await db.runAsync(`UPDATE pending_checkins SET status = 'synced' WHERE uuid = ?`, [uuid])
}

export async function markFailed(uuid: string): Promise<void> {
  const db = await openQueue()
  await db.runAsync(
    `UPDATE pending_checkins SET status = 'failed', retry_count = retry_count + 1 WHERE uuid = ?`,
    [uuid]
  )
}

export async function updateServerPaths(
  uuid: string,
  serverIdProofPath: string | null,
  guestsJson: string
): Promise<void> {
  const db = await openQueue()
  await db.runAsync(
    `UPDATE pending_checkins SET server_id_proof_path = ?, guests_json = ? WHERE uuid = ?`,
    [serverIdProofPath, guestsJson, uuid]
  )
}

// ---------- Helpers ----------

function deserializeRow(row: any): PendingCheckin {
  return {
    id: row.id,
    uuid: row.uuid,
    created_at: row.created_at,
    check_out_date: row.check_out_date,
    room_ids: JSON.parse(row.room_ids_json),
    guests: JSON.parse(row.guests_json),
    local_id_proof_uri: row.local_id_proof_uri ?? undefined,
    server_id_proof_path: row.server_id_proof_path ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    retry_count: row.retry_count,
  }
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
