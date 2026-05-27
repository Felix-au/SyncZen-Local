import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system'
import { getServerConfig } from './store'

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function request(path: string, options: RequestInit = {}, timeoutMs = 8000) {
  const cfg = await getServerConfig()
  if (!cfg) throw new Error('NOT_PAIRED')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${cfg.url}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.token}`,
        ...(options.headers ?? {})
      }
    })
    clearTimeout(timer)
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`)
    return res.json()
  } catch (err: any) {
    clearTimeout(timer)
    // React Native / Hermes may use different names for abort errors
    if (
      err.name === 'AbortError' ||
      err.message?.includes('cancel') ||
      err.message?.includes('abort') ||
      err.message?.includes('timed out')
    ) throw new Error('TIMEOUT')
    throw err
  }
}

// ── Health check ───────────────────────────────────────────────────────────────
export async function ping(): Promise<boolean> {
  try { await request('/api/health', {}, 2000); return true }
  catch { return false }
}

// ── Rooms ──────────────────────────────────────────────────────────────────────
export async function fetchAvailableRooms(timeoutMs = 3000) {
  const data = await request('/api/rooms/available', {}, timeoutMs)
  return data.rooms ?? data
}

// ── Photo upload ──────────────────────────────────────────────────────────────
export async function uploadPhoto(uri: string, prefix = 'photo', precomputedBase64?: string | null): Promise<string | null> {
  try {
    let base64: string
    if (precomputedBase64) {
      // Base64 provided directly from picker — fastest path, no file I/O
      base64 = `data:image/jpeg;base64,${precomputedBase64}`
    } else if (Platform.OS === 'web') {
      const blob = await fetch(uri).then(r => r.blob())
      base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } else {
      // Fallback: copy to cache to handle content:// URIs
      let fileUri = uri
      if (!uri.startsWith('file://')) {
        const cacheUri = FileSystem.cacheDirectory + `${prefix}_${Date.now()}.jpg`
        await FileSystem.copyAsync({ from: uri, to: cacheUri })
        fileUri = cacheUri
      }
      const raw = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 })
      base64 = `data:image/jpeg;base64,${raw}`
    }
    const res = await request('/api/photos/upload', { method: 'POST', body: JSON.stringify({ data: base64, prefix }) }, 20000)
    return res.path ?? null
  } catch (err) {
    console.warn('[API] Photo upload failed:', err)
    return null
  }
}

// ── Check-in ──────────────────────────────────────────────────────────────────
export async function submitCheckin(payload: {
  guests: { name: string; phone?: string; age?: number; sex?: string; photo_path?: string; is_primary?: boolean }[]
  room_ids: number[]
  check_out_date: string
  document_path?: string
  notes?: string
}) {
  return request('/api/checkin', { method: 'POST', body: JSON.stringify(payload) })
}
