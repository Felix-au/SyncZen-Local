import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'server_config'

export interface ServerConfig {
  url: string   // e.g. "http://192.168.1.15:8080"
  token?: string
}

export async function getServerConfig(): Promise<ServerConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function saveServerConfig(config: ServerConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export async function clearServerConfig(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)
}

// ---------- HTTP helpers ----------

async function getBaseUrl(): Promise<string> {
  const config = await getServerConfig()
  if (!config) throw new Error('No server configured. Scan the QR code first.')
  return config.url.replace(/\/$/, '')
}

async function getHeaders(): Promise<HeadersInit> {
  const config = await getServerConfig()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config?.token) {
    headers['Authorization'] = `Bearer ${config.token}`
  }
  return headers
}

export async function apiGet<T>(path: string): Promise<T> {
  const base = await getBaseUrl()
  const headers = await getHeaders()
  const res = await fetch(`${base}${path}`, {
    headers,
  })
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json()
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const base = await getBaseUrl()
  const headers = await getHeaders()
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(err.error ?? `POST ${path} failed: ${res.status}`)
  }
  return res.json()
}

export async function apiUpload(path: string, fileUri: string, fieldName: string): Promise<{ path: string; filename: string }> {
  const base = await getBaseUrl()
  const config = await getServerConfig()
  const formData = new FormData()
  formData.append(fieldName, {
    uri: fileUri,
    type: 'image/jpeg',
    name: `${fieldName}-${Date.now()}.jpg`,
  } as any)

  const headers: Record<string, string> = {}
  if (config?.token) {
    headers['Authorization'] = `Bearer ${config.token}`
  }

  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  })
  if (!res.ok) throw new Error(`Upload ${path} failed: ${res.status}`)
  return res.json()
}

export async function pingServer(): Promise<boolean> {
  try {
    const base = await getBaseUrl()
    const config = await getServerConfig()
    const headers: Record<string, string> = {}
    if (config?.token) {
      headers['Authorization'] = `Bearer ${config.token}`
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    try {
      const res = await fetch(`${base}/api/health`, {
        headers,
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return res.ok
    } catch {
      clearTimeout(timeoutId)
      return false
    }
  } catch {
    return false
  }
}
