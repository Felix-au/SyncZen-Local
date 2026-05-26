import { Router, Request, Response } from 'express'
import { getPool } from '../db'

const router = Router()

// GET /api/guests/:id — single guest detail
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const rows = await getPool().query(`SELECT * FROM guests WHERE id = ?`, [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Guest not found.' })
    res.json({ guest: rows[0] })
  } catch {
    res.status(500).json({ error: 'Failed to fetch guest.' })
  }
})

// PATCH /api/guests/:id — update guest details
router.patch('/:id', async (req: Request, res: Response) => {
  const { name, age, sex, photo_path } = req.body
  try {
    await getPool().query(
      `UPDATE guests SET
        name = COALESCE(?, name),
        age = COALESCE(?, age),
        sex = COALESCE(?, sex),
        photo_path = COALESCE(?, photo_path)
      WHERE id = ?`,
      [name ?? null, age ?? null, sex ?? null, photo_path ?? null, req.params.id]
    )
    res.json({ message: 'Guest updated.' })
  } catch {
    res.status(500).json({ error: 'Failed to update guest.' })
  }
})

export default router
