import express, { Application, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import * as http from 'http'
import * as path from 'path'
import { app as electronApp } from 'electron'
import { initDatabase } from './db'
import roomsRouter from './routes/rooms'
import bookingsRouter from './routes/bookings'
import guestsRouter from './routes/guests'
import settingsRouter from './routes/settings'
import uploadRouter from './routes/upload'
import { getApiToken } from './auth'

let server: http.Server | null = null
export let apiPort = 8080

export async function startApiServer(): Promise<{ port: number }> {
  // Initialize schema
  await initDatabase()

  const app: Application = express()

  app.use(cors({ origin: '*' }))
  app.use(express.json({ limit: '50mb' }))
  app.use(express.urlencoded({ extended: true, limit: '50mb' }))

  // Authentication Middleware:
  // Allows loopback requests (desktop client UI) automatically, but requires pairing token header for remote devices
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      return next()
    }

    const clientIp = req.ip || req.socket.remoteAddress || ''
    const isLocal = clientIp === '127.0.0.1' ||
                    clientIp === '::1' ||
                    clientIp === '::ffff:127.0.0.1' ||
                    req.hostname === 'localhost' ||
                    req.hostname === '127.0.0.1'

    if (isLocal) {
      return next()
    }

    const authHeader = req.headers.authorization
    const expectedToken = getApiToken()

    if (authHeader && authHeader === `Bearer ${expectedToken}`) {
      console.log(`[Auth] Authenticated remote request from ${clientIp}: ${req.method} ${req.path}`)
      return next()
    }

    console.warn(`[Auth] Blocked request from ${clientIp}: ${req.method} ${req.path} (Got: "${authHeader}", Expected: "Bearer ${expectedToken}")`)
    res.status(401).json({ error: 'Unauthorized: Invalid or missing pairing credentials.' })
  })

  // Health check — used by APK to test connection before check-in
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() })
  })

  // Serve uploaded assets
  const storageDir = path.join(electronApp.getPath('userData'), 'storage')
  app.use('/storage', express.static(storageDir))

  // Routers
  app.use('/api/rooms', roomsRouter)
  app.use('/api/bookings', bookingsRouter)
  app.use('/api/guests', guestsRouter)
  app.use('/api/settings', settingsRouter)
  app.use('/api/upload', uploadRouter)

  // Find an available port starting from 8080
  apiPort = await findAvailablePort(8080)

  return new Promise((resolve, reject) => {
    server = app.listen(apiPort, '0.0.0.0', () => {
      console.log(`[API] Express server listening on port ${apiPort}`)
      resolve({ port: apiPort })
    })
    server.on('error', reject)
  })
}

export async function stopApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('[API] Server stopped.')
        resolve()
      })
    } else {
      resolve()
    }
  })
}

async function findAvailablePort(startPort: number): Promise<number> {
  const net = await import('net')
  return new Promise((resolve) => {
    const testServer = net.createServer()
    testServer.listen(startPort, '0.0.0.0', () => {
      testServer.close(() => resolve(startPort))
    })
    testServer.on('error', () => resolve(findAvailablePort(startPort + 1) as unknown as number))
  })
}
