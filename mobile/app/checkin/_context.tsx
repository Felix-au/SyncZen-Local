import React, { createContext, useContext, useState, ReactNode } from 'react'
import type { PendingGuest } from '../../src/lib/offlineQueue'

// ─── Shared state for the multi-step check-in wizard ────────────────────────

export interface CheckInState {
  // Step 1
  groupSize: number

  // Step 2 — per-guest data
  guests: PendingGuest[]

  // Step 3 — ID proof
  localIdProofUri: string | null

  // Step 4 — Room & stay
  roomIds: number[]
  checkOutDate: string
  notes: string
}

interface CheckInContextType {
  state: CheckInState
  setGroupSize: (n: number) => void
  updateGuest: (index: number, patch: Partial<PendingGuest>) => void
  setLocalIdProofUri: (uri: string | null) => void
  setRoomIds: (ids: number[]) => void
  setCheckOutDate: (d: string) => void
  setNotes: (n: string) => void
  reset: () => void
}

const defaultState: CheckInState = {
  groupSize:       1,
  guests:          [{ name: '', is_primary_contact: true }],
  localIdProofUri: null,
  roomIds:         [],
  checkOutDate:    '',
  notes:           '',
}

const CheckInContext = createContext<CheckInContextType | null>(null)

export function CheckInProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CheckInState>(defaultState)

  const setGroupSize = (n: number) => {
    setState(prev => {
      const newGuests = Array.from({ length: n }, (_, i) => ({
        ...( prev.guests[i] ?? { name: '', is_primary_contact: i === 0 }),
        is_primary_contact: i === 0,
      }))
      return { ...prev, groupSize: n, guests: newGuests }
    })
  }

  const updateGuest = (index: number, patch: Partial<PendingGuest>) => {
    setState(prev => {
      const guests = [...prev.guests]
      guests[index] = { ...guests[index], ...patch }
      return { ...prev, guests }
    })
  }

  const setLocalIdProofUri = (uri: string | null) =>
    setState(prev => ({ ...prev, localIdProofUri: uri }))

  const setRoomIds = (ids: number[]) =>
    setState(prev => ({ ...prev, roomIds: ids }))

  const setCheckOutDate = (d: string) =>
    setState(prev => ({ ...prev, checkOutDate: d }))

  const setNotes = (n: string) =>
    setState(prev => ({ ...prev, notes: n }))

  const reset = () => setState(defaultState)

  return (
    <CheckInContext.Provider value={{
      state, setGroupSize, updateGuest, setLocalIdProofUri,
      setRoomIds, setCheckOutDate, setNotes, reset,
    }}>
      {children}
    </CheckInContext.Provider>
  )
}

export function useCheckIn(): CheckInContextType {
  const ctx = useContext(CheckInContext)
  if (!ctx) throw new Error('useCheckIn must be used inside CheckInProvider')
  return ctx
}
