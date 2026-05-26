import { Router, Request, Response } from 'express'
import { getPool } from '../db'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// Generate a unique booking reference e.g. BK-A3F9C2
function generateReference(): string {
  return 'BK-' + uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase()
}

// GET /api/bookings — list all bookings (with guest and room info)
router.get('/', async (req: Request, res: Response) => {
  const { status } = req.query
  try {
    let query = `
      SELECT
        bg.*,
        GROUP_CONCAT(DISTINCT g.name ORDER BY g.is_primary_contact DESC SEPARATOR ', ') AS guest_names,
        COUNT(DISTINCT g.id) AS guest_count,
        GROUP_CONCAT(DISTINCT r.room_number ORDER BY r.room_number SEPARATOR ', ') AS rooms
      FROM booking_groups bg
      LEFT JOIN guests g ON g.group_id = bg.id
      LEFT JOIN room_allocations ra ON ra.group_id = bg.id
      LEFT JOIN rooms r ON r.id = ra.room_id
    `
    const params: string[] = []
    if (status) {
      query += ` WHERE bg.status = ?`
      params.push(status as string)
    }
    query += ` GROUP BY bg.id ORDER BY bg.check_in_time DESC`
    const rows = await getPool().query(query, params)
    res.json({ bookings: rows })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings.' })
  }
})

// GET /api/bookings/:id — single booking full detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bookings = await getPool().query(
      `SELECT * FROM booking_groups WHERE id = ?`,
      [req.params.id]
    )
    if (!bookings.length) return res.status(404).json({ error: 'Booking not found.' })

    const guests = await getPool().query(
      `SELECT * FROM guests WHERE group_id = ?`,
      [req.params.id]
    )
    const rooms = await getPool().query(
      `SELECT r.* FROM rooms r JOIN room_allocations ra ON ra.room_id = r.id WHERE ra.group_id = ?`,
      [req.params.id]
    )

    res.json({ booking: bookings[0], guests, rooms })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch booking.' })
  }
})

// POST /api/bookings — create a full group check-in
// Body: { guests: [{name, age?, sex?, photo_path?, is_primary_contact?}], room_ids: [int], check_out_date: string, id_proof_path?: string, notes?: string }
router.post('/', async (req: Request, res: Response) => {
  const { guests, room_ids, check_out_date, id_proof_path, notes } = req.body

  if (!guests?.length) return res.status(400).json({ error: 'At least one guest is required.' })
  if (!room_ids?.length) return res.status(400).json({ error: 'At least one room must be allocated.' })
  if (!check_out_date) return res.status(400).json({ error: 'check_out_date is required.' })

  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()

    // 1. Create booking group
    const ref = generateReference()
    const groupResult = await conn.query(
      `INSERT INTO booking_groups (booking_reference, check_out_date, id_proof_path, notes) VALUES (?,?,?,?)`,
      [ref, check_out_date, id_proof_path ?? null, notes ?? null]
    )
    const groupId = Number(groupResult.insertId)

    // 2. Insert each guest
    for (const g of guests) {
      await conn.query(
        `INSERT INTO guests (group_id, name, age, sex, photo_path, is_primary_contact) VALUES (?,?,?,?,?,?)`,
        [groupId, g.name, g.age ?? null, g.sex ?? null, g.photo_path ?? null, g.is_primary_contact ?? false]
      )
    }

    // 3. Allocate rooms and mark them occupied
    for (const roomId of room_ids) {
      await conn.query(
        `INSERT INTO room_allocations (group_id, room_id) VALUES (?,?)`,
        [groupId, roomId]
      )
      await conn.query(
        `UPDATE rooms SET status = 'occupied' WHERE id = ?`,
        [roomId]
      )
    }

    await conn.commit()
    res.status(201).json({ group_id: groupId, booking_reference: ref, message: 'Check-in successful.' })
  } catch (err: any) {
    await conn.rollback()
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A room is already allocated to an active booking.' })
    console.error(err)
    res.status(500).json({ error: 'Check-in failed.' })
  } finally {
    conn.release()
  }
})

// POST /api/bookings/:id/checkout — check out a group
router.post('/:id/checkout', async (req: Request, res: Response) => {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()

    const bookings = await conn.query(`SELECT * FROM booking_groups WHERE id = ?`, [req.params.id])
    if (!bookings.length) return res.status(404).json({ error: 'Booking not found.' })
    if (bookings[0].status !== 'checked_in') {
      return res.status(409).json({ error: 'Booking is not in checked_in status.' })
    }

    // Free up the rooms
    const allocations = await conn.query(
      `SELECT room_id FROM room_allocations WHERE group_id = ?`,
      [req.params.id]
    )
    for (const a of allocations) {
      await conn.query(`UPDATE rooms SET status = 'checkout' WHERE id = ?`, [a.room_id])
    }

    // Mark booking as checked out
    await conn.query(
      `UPDATE booking_groups SET status = 'checked_out' WHERE id = ?`,
      [req.params.id]
    )

    await conn.commit()
    res.json({ message: 'Guest checked out successfully.' })
  } catch (err) {
    await conn.rollback()
    res.status(500).json({ error: 'Checkout failed.' })
  } finally {
    conn.release()
  }
})

export default router
