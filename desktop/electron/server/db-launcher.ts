import { spawn, ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Resolve the directory where portable MariaDB binaries are stored.
// In dev: relative to project root. In production: in app resources.
function getDbEngineDir(): string {
  if (isDev) {
    return path.join(__dirname, '..', '..', 'db-engine')
  }
  return path.join(process.resourcesPath, 'db-engine')
}

// Data directory where MariaDB stores its actual database files.
function getDataDir(): string {
  const userDataDir = app.getPath('userData')
  return path.join(userDataDir, 'mariadb-data')
}

let dbProcess: ChildProcess | null = null

export async function startDatabase(): Promise<void> {
  const engineDir = getDbEngineDir()
  const dataDir = getDataDir()
  const mysqld = path.join(engineDir, 'bin', 'mysqld.exe')

  // Verify the engine exists; if not, fall back to system MariaDB or skip.
  if (!fs.existsSync(mysqld)) {
    console.warn(`[DB] MariaDB engine not found at: ${mysqld}`)
    console.warn('[DB] Falling back to system-installed MariaDB (if available).')
    // The API server will still attempt to connect; if MariaDB is installed
    // system-wide, it will connect. If not, it will throw and log clearly.
    return
  }

  // Initialize data directory if it doesn't exist yet (first run)
  if (!fs.existsSync(dataDir)) {
    console.log('[DB] First launch detected. Initializing MariaDB data directory...')
    fs.mkdirSync(dataDir, { recursive: true })
    await runDbInit(engineDir, dataDir)
    console.log('[DB] Database initialized successfully.')
  }

  console.log('[DB] Starting embedded MariaDB server...')
  dbProcess = spawn(
    mysqld,
    [
      `--datadir=${dataDir}`,
      '--port=3307',
      '--bind-address=127.0.0.1',
      '--skip-networking=OFF',
      '--console',
    ],
    {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: engineDir,
    }
  )

  dbProcess.stdout?.on('data', (d) => console.log('[MariaDB]', d.toString().trim()))
  dbProcess.stderr?.on('data', (d) => console.log('[MariaDB]', d.toString().trim()))
  dbProcess.on('exit', (code) => console.log(`[DB] MariaDB exited with code ${code}`))

  // Wait for MariaDB to be ready
  await waitForMariaDB()
  console.log('[DB] MariaDB is ready.')
}

async function runDbInit(engineDir: string, dataDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const installDb = path.join(engineDir, 'bin', 'mysql_install_db.exe')
    const proc = spawn(
      installDb,
      [`--datadir=${dataDir}`, '--password=', '--default-user=root'],
      { cwd: engineDir, stdio: 'pipe' }
    )
    proc.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`mysql_install_db exited with code ${code}`))
    })
    proc.on('error', reject)
  })
}

async function waitForMariaDB(retries = 20, delayMs = 500): Promise<void> {
  const mariadb = await import('mariadb')
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await mariadb.createConnection({
        host: '127.0.0.1',
        port: 3307,
        user: 'root',
        password: '',
        connectTimeout: 2000,
      })
      await conn.end()
      return
    } catch {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw new Error('[DB] MariaDB did not become ready in time.')
}

export async function stopDatabase(): Promise<void> {
  if (dbProcess) {
    console.log('[DB] Shutting down embedded MariaDB...')
    dbProcess.kill('SIGTERM')
    dbProcess = null
  }
}
