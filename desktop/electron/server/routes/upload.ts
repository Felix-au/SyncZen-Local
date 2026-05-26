import { Router, Request, Response } from 'express'
import multer from 'multer'
import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'
import Jimp from 'jimp'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// Storage directory: in userData so it's outside the install directory
function getStorageDir(subdir: 'portraits' | 'id-proofs'): string {
  const storageDir = path.join(app.getPath('userData'), 'storage', subdir)
  fs.mkdirSync(storageDir, { recursive: true })
  return storageDir
}

// Use memory storage — we'll write the file manually after Jimp compression
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } })

// POST /api/upload/portrait — compress and save guest portrait photo
router.post('/portrait', upload.single('photo'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })
  try {
    const filename = `portrait-${uuidv4()}.jpg`
    const destPath = path.join(getStorageDir('portraits'), filename)

    // Compress to 256x256 quality portrait
    const image = await Jimp.read(req.file.buffer)
    await image
      .cover(256, 256)
      .quality(85)
      .writeAsync(destPath)

    const relPath = `storage/portraits/${filename}`
    res.status(201).json({ path: relPath, filename })
  } catch (err) {
    console.error('[Upload] Portrait error:', err)
    res.status(500).json({ error: 'Failed to process portrait image.' })
  }
})

// POST /api/upload/id-proof — compress and save ID document photo (perspective-corrected by APK)
router.post('/id-proof', upload.single('photo'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })
  try {
    const filename = `id-${uuidv4()}.jpg`
    const destPath = path.join(getStorageDir('id-proofs'), filename)

    // Save ID card at higher resolution to maintain readability
    const image = await Jimp.read(req.file.buffer)
    await image
      .scaleToFit(1200, 800)
      .quality(88)
      .writeAsync(destPath)

    const relPath = `storage/id-proofs/${filename}`
    res.status(201).json({ path: relPath, filename })
  } catch (err) {
    console.error('[Upload] ID proof error:', err)
    res.status(500).json({ error: 'Failed to process ID proof image.' })
  }
})

export default router
