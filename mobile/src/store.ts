import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const URL_KEY   = 'synczen_server_url'
const TOKEN_KEY = 'synczen_token'
const QUEUE_KEY = 'synczen_offline_queue'

// expo-secure-store is native-only — fall back to AsyncStorage on web
const secureGet = (key: string) =>
  Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key)
const secureSet = (key: string, val: string) =>
  Platform.OS === 'web' ? AsyncStorage.setItem(key, val) : SecureStore.setItemAsync(key, val)
const secureDel = (key: string) =>
  Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key)

// ── Server config ─────────────────────────────────────────────────────────────
export async function saveServerConfig(url: string, token: string) {
  await AsyncStorage.setItem(URL_KEY, url)
  await secureSet(TOKEN_KEY, token)
}

export async function getServerConfig(): Promise<{ url: string; token: string } | null> {
  const url   = await AsyncStorage.getItem(URL_KEY)
  const token = await secureGet(TOKEN_KEY)
  if (!url || !token) return null
  return { url, token }
}

export async function clearServerConfig() {
  await AsyncStorage.removeItem(URL_KEY)
  await secureDel(TOKEN_KEY)
}

// ── Offline queue ──────────────────────────────────────────────────────────────
export type QueuedCheckin = {
  id: string
  payload: any
  timestamp: number
  attempts: number
}

export async function getQueue(): Promise<QueuedCheckin[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}

export async function enqueue(payload: any): Promise<string> {
  const q = await getQueue()
  const item: QueuedCheckin = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    payload,
    timestamp: Date.now(),
    attempts: 0
  }
  q.push(item)
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  return item.id
}

export async function removeFromQueue(id: string) {
  const q = await getQueue()
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q.filter(i => i.id !== id)))
}

export async function bumpAttempts(id: string) {
  const q = await getQueue()
  const updated = q.map(i => i.id === id ? { ...i, attempts: i.attempts + 1 } : i)
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated))
}

// ── Rooms cache (for offline use) ─────────────────────────────────────────────
const ROOMS_KEY = 'synczen_rooms_cache'

export async function saveRoomsCache(rooms: any[]) {
  await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify({ rooms, cachedAt: Date.now() }))
}

export async function getRoomsCache(): Promise<any[] | null> {
  const raw = await AsyncStorage.getItem(ROOMS_KEY)
  if (!raw) return null
  return JSON.parse(raw).rooms ?? null
}
