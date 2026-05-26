import { Router, Request, Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { getPool } from '../db'
import * as os from 'os'
import * as net from 'net'
import { apiPort } from '../api'
import QRCode from 'qrcode'

const router = Router()

// GET /api/settings/server-info — returns pairing info including QR code and local IP
router.get('/server-info', async (_req: Request, res: Response) => {
  try {
    const localIp = getLocalIpAddress()
    const pairingUrl = `http://${localIp}:${apiPort}`
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify({ url: pairingUrl, token: 'hotel-checkin-v1' }), {
      width: 256,
      margin: 2,
      color: { dark: '#ffffff', light: '#0d0d0f' },
    })

    res.json({
      local_ip: localIp,
      port: apiPort,
      pairing_url: pairingUrl,
      qr_code: qrDataUrl,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate server info.' })
  }
})

// GET /api/settings/stats — dashboard summary stats
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [rooms] = await getPool().query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'available') AS available,
        SUM(status = 'occupied') AS occupied,
        SUM(status = 'maintenance') AS maintenance,
        SUM(status = 'checkout') AS checkout
      FROM rooms
    `)
    const [bookings] = await getPool().query(`
      SELECT COUNT(*) AS active_bookings FROM booking_groups WHERE status = 'checked_in'
    `)
    const [guests] = await getPool().query(`
      SELECT COUNT(*) AS guests_today
      FROM guests g
      JOIN booking_groups bg ON bg.id = g.group_id
      WHERE DATE(bg.check_in_time) = CURDATE() AND bg.status = 'checked_in'
    `)

    res.json({
      rooms: rooms,
      active_bookings: Number(bookings.active_bookings),
      guests_today: Number(guests.guests_today),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch stats.' })
  }
})

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name]
    if (!iface) continue
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address
      }
    }
  }
  return '127.0.0.1'
}

export default router
