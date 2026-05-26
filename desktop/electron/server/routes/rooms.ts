import { Router, Request, Response } from 'express'
import { getPool } from '../db'

const router = Router()

// GET /api/rooms — list all rooms with occupancy info
router.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await getPool().query(`
      SELECT
        r.*,
        bg.booking_reference,
        bg.check_out_date,
        GROUP_CONCAT(g.name ORDER BY g.is_primary_contact DESC SEPARATOR ', ') AS guest_names
      FROM rooms r
      LEFT JOIN room_allocations ra ON ra.room_id = r.id
      LEFT JOIN booking_groups bg ON bg.id = ra.group_id AND bg.status = 'checked_in'
      LEFT JOIN guests g ON g.group_id = bg.id
      GROUP BY r.id
      ORDER BY r.floor, r.room_number
    `)
    res.json({ rooms: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch rooms.' })
  }
})

// GET /api/rooms/:id — single room detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const rows = await getPool().query(`SELECT * FROM rooms WHERE id = ?`, [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Room not found.' })
    res.json({ room: rows[0] })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch room.' })
  }
})

// POST /api/rooms — register a new room
router.post('/', async (req: Request, res: Response) => {
  const { room_number, room_type, floor, price_per_night, notes } = req.body
  if (!room_number) return res.status(400).json({ error: 'room_number is required.' })
  try {
    const result = await getPool().query(
      `INSERT INTO rooms (room_number, room_type, floor, price_per_night, notes) VALUES (?,?,?,?,?)`,
      [room_number, room_type ?? 'Standard', floor ?? 1, price_per_night ?? 0, notes ?? null]
    )
    res.status(201).json({ id: Number(result.insertId), message: 'Room registered.' })
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Room number already exists.' })
    res.status(500).json({ error: 'Failed to register room.' })
  }
})

// PATCH /api/rooms/:id/status — update room status
router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body
  const validStatuses = ['available', 'occupied', 'maintenance', 'checkout']
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` })
  }
  try {
    await getPool().query(`UPDATE rooms SET status = ? WHERE id = ?`, [status, req.params.id])
    res.json({ message: 'Room status updated.' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update room status.' })
  }
})

// DELETE /api/rooms/:id — remove a room (only if not currently occupied)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const rows = await getPool().query(`SELECT status FROM rooms WHERE id = ?`, [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Room not found.' })
    if (rows[0].status === 'occupied') {
      return res.status(409).json({ error: 'Cannot delete an occupied room.' })
    }
    await getPool().query(`DELETE FROM rooms WHERE id = ?`, [req.params.id])
    res.json({ message: 'Room deleted.' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete room.' })
  }
})

export default router
