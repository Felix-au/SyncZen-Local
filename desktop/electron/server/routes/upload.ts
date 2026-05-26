import { Router } from 'express'
import multer, { StorageEngine } from 'multer'
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

// Memory storage — write after Jimp compression
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
})

// POST /api/upload/portrait — compress and save guest portrait photo
router.post('/portrait', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })
  try {
    const filename = `portrait-${uuidv4()}.jpg`
    const destPath = path.join(getStorageDir('portraits'), filename)

    const image = await Jimp.read(req.file.buffer)
    await image.cover(256, 256).quality(85).writeAsync(destPath)

    res.status(201).json({ path: `storage/portraits/${filename}`, filename })
  } catch (err) {
    console.error('[Upload] Portrait error:', err)
    res.status(500).json({ error: 'Failed to process portrait image.' })
  }
})

// POST /api/upload/id-proof — compress and save ID document photo
router.post('/id-proof', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' })
  try {
    const filename = `id-${uuidv4()}.jpg`
    const destPath = path.join(getStorageDir('id-proofs'), filename)

    const image = await Jimp.read(req.file.buffer)
    await image.scaleToFit(1200, 800).quality(88).writeAsync(destPath)

    res.status(201).json({ path: `storage/id-proofs/${filename}`, filename })
  } catch (err) {
    console.error('[Upload] ID proof error:', err)
    res.status(500).json({ error: 'Failed to process ID proof image.' })
  }
})

export default router
