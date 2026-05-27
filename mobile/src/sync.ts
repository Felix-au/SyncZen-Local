import { ping, submitCheckin, uploadPhoto } from './api'
import { getQueue, removeFromQueue, bumpAttempts, enqueue } from './store'

type PhotoBase64 = {
  guests: (string | null)[]  // base64 strings per guest (null if no photo or already uploaded)
  document: string | null    // document base64 (null if none or already uploaded)
}

/**
 * Smart check-in:
 * - If online: submit immediately.
 * - If offline: queue payload + base64 photo data for later sync.
 * Base64 is stored (not file URIs) so photos survive until sync.
 */
export async function smartCheckin(
  payload: any,
  photoBase64?: PhotoBase64
): Promise<{ ok: boolean; offline: boolean; reference?: string; queueId?: string }> {
  try {
    const res = await submitCheckin(payload)
    return { ok: true, offline: false, reference: res.booking_reference }
  } catch (err: any) {
    const msg: string = err.message ?? ''
    const isNetwork =
      err.message === 'TIMEOUT' ||
      err.message === 'NOT_PAIRED' ||
      err.name === 'TypeError' ||
      err.name === 'AbortError' ||
      msg.includes('fetch') ||
      msg.includes('cancel') ||
      msg.includes('network') ||
      msg.includes('abort') ||
      msg.includes('timeout')
    if (isNetwork) {
      const queueId = await enqueue({ checkin: payload, photoBase64: photoBase64 ?? null })
      return { ok: false, offline: true, queueId }
    }
    throw err
  }
}

/**
 * Flush queued check-ins to the server.
 * For each item, uploads any stored base64 photos first, then submits.
 */
export async function syncQueue(): Promise<number> {
  const isOnline = await ping()
  if (!isOnline) return 0

  const queue = await getQueue()
  let synced = 0

  for (const item of queue) {
    try {
      const isNew = item.payload?.checkin !== undefined
      let finalPayload = isNew ? item.payload.checkin : item.payload
      const b64: PhotoBase64 | null = isNew ? item.payload.photoBase64 : null

      if (b64) {
        // Upload stored base64 photos — URI is irrelevant when base64 is provided
        const photoPaths = await Promise.all(
          (b64.guests ?? []).map((base64: string | null, i: number) =>
            base64 ? uploadPhoto('offline', `guest${i + 1}`, base64) : Promise.resolve(null)
          )
        )
        const docPath = b64.document ? await uploadPhoto('offline', 'doc', b64.document) : null

        finalPayload = {
          ...finalPayload,
          guests: finalPayload.guests.map((g: any, i: number) => ({
            ...g, photo_path: photoPaths[i] ?? g.photo_path ?? undefined
          })),
          document_path: docPath ?? finalPayload.document_path ?? undefined
        }
      }

      await submitCheckin(finalPayload)
      await removeFromQueue(item.id)
      synced++
      console.log(`[Sync] Flushed ${item.id}`)
    } catch (err) {
      console.warn(`[Sync] Failed ${item.id}:`, err)
      await bumpAttempts(item.id)
    }
  }

  return synced
}
