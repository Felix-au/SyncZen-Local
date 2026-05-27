import { contextBridge, ipcRenderer } from 'electron'

export type SetupProgress = {
  step: string
  status: 'running' | 'done' | 'error'
  detail?: string
}

const api = {
  setup: {
    isComplete: (): Promise<boolean> => ipcRenderer.invoke('setup:isComplete'),
    run: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('setup:run'),
    onProgress: (cb: (p: SetupProgress) => void) => {
      ipcRenderer.on('setup:progress', (_e, p) => cb(p))
      return () => ipcRenderer.removeAllListeners('setup:progress')
    }
  },

  boot: (): Promise<{ needsSetup: boolean; port?: number; error?: string }> =>
    ipcRenderer.invoke('app:boot'),

  rooms: {
    list: () => ipcRenderer.invoke('rooms:list'),
    available: () => ipcRenderer.invoke('rooms:available'),
    add: (data: any) => ipcRenderer.invoke('rooms:add', data),
    updateStatus: (id: number, status: string) => ipcRenderer.invoke('rooms:updateStatus', { id, status }),
    delete: (id: number) => ipcRenderer.invoke('rooms:delete', { id })
  },

  bookings: {
    list: () => ipcRenderer.invoke('bookings:list'),
    detail: (id: number) => ipcRenderer.invoke('bookings:detail', { id }),
    checkout: (id: number) => ipcRenderer.invoke('bookings:checkout', { id })
  },

  checkin: {
    submit: (data: {
      guests: { name: string; phone?: string; age?: number; sex?: string; photo_path?: string; is_primary?: boolean }[]
      room_ids: number[]
      check_out_date: string
      document_path?: string
      notes?: string
    }) => ipcRenderer.invoke('checkin:submit', data)
  },

  stats: { get: () => ipcRenderer.invoke('stats:get') },

  server: {
    info: () => ipcRenderer.invoke('server:info'),
    regenerateToken: () => ipcRenderer.invoke('server:regenerateToken')
  },

  dialog: {
    pickImage: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickImage')
  },

  photo: {
    save: (data: { dataUrl: string; prefix?: string }): Promise<string> =>
      ipcRenderer.invoke('photo:save', data),
    getDataUrl: (filePath: string): Promise<string | null> =>
      ipcRenderer.invoke('photo:getDataUrl', filePath)
  }


}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.api = api
}
