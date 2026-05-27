import { ping, submitCheckin, uploadPhoto } from './api'
import { getQueue, removeFromQueue, bumpAttempts, enqueue } from './store'

type PhotoUris = {
  guests: (string | null)[]   // URI per guest — null if already uploaded or no photo
  document: string | null     // Document URI — null if already uploaded or no doc
}

/**
 * Try to submit a check-in.
 * If offline, push to local queue — including any photo URIs that failed to
 * upload so they can be retried when connectivity returns.
 */
export async function smartCheckin(
  payload: any,
  photoUris?: PhotoUris
): Promise<{ ok: boolean; offline: boolean; reference?: string; queueId?: string }> {
  try {
    const res = await submitCheckin(payload)
    return { ok: true, offline: false, reference: res.booking_reference }
  } catch (err: any) {
    // Network failure or timeout → queue for later
    if (err.message === 'TIMEOUT' || err.message === 'NOT_PAIRED' || err.name === 'TypeError') {
      const queueId = await enqueue({ checkin: payload, photoUris: photoUris ?? null })
      return { ok: false, offline: true, queueId }
    }
    throw err
  }
}

/**
 * Flush all queued check-ins to the server.
 * For each queued item, retries any pending photo uploads first, then submits
 * the check-in with the recovered paths.
 * Returns number of successfully synced items.
 */
export async function syncQueue(): Promise<number> {
  const isOnline = await ping()
  if (!isOnline) return 0

  const queue = await getQueue()
  let synced = 0

  for (const item of queue) {
    try {
      // Support both old format (raw payload) and new format ({ checkin, photoUris })
      const isNew = item.payload?.checkin !== undefined
      let finalPayload = isNew ? item.payload.checkin : item.payload
      const uris: PhotoUris | null = isNew ? item.payload.photoUris : null

      if (uris) {
        // Retry uploading any photos that failed during offline check-in
        const photoPaths = await Promise.all(
          (uris.guests ?? []).map((uri: string | null, i: number) =>
            uri ? uploadPhoto(uri, `guest${i + 1}`) : Promise.resolve(null)
          )
        )
        const docPath = uris.document ? await uploadPhoto(uris.document, 'doc') : null

        // Merge recovered paths into payload (only override if we got a path back)
        finalPayload = {
          ...finalPayload,
          guests: finalPayload.guests.map((g: any, i: number) => ({
            ...g,
            photo_path: photoPaths[i] ?? g.photo_path ?? undefined
          })),
          document_path: docPath ?? finalPayload.document_path ?? undefined
        }
      }

      await submitCheckin(finalPayload)
      await removeFromQueue(item.id)
      synced++
      console.log(`[Sync] Flushed queued check-in ${item.id}`)
    } catch (err) {
      console.warn(`[Sync] Failed to sync ${item.id}:`, err)
      await bumpAttempts(item.id)
    }
  }

  return synced
}
