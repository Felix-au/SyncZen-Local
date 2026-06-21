import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  AppState, ScrollView, RefreshControl
} from 'react-native'
import { colors, radius, font, space } from '../theme'
import { ping } from '../api'
import { getQueue, clearServerConfig } from '../store'
import { syncQueue } from '../sync'
import type { QueuedCheckin } from '../store'

interface Props {
  onStartCheckin: () => void
  onUnpair: () => void
}

export default function HomeScreen({ onStartCheckin, onUnpair }: Props) {
  const [online, setOnline]     = useState<boolean | null>(null)
  const [queue, setQueue]       = useState<QueuedCheckin[]>([])
  const [syncing, setSyncing]   = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastSync, setLastSync] = useState<string>('')

  const refresh = useCallback(async () => {
    const [isOnline, q] = await Promise.all([ping(), getQueue()])
    setOnline(isOnline)
    setQueue(q)
  }, [])

  const trySyncQueue = async () => {
    if (syncing) return
    setSyncing(true)
    const n = await syncQueue()
    await refresh()
    setSyncing(false)
    if (n > 0) setLastSync(`${n} check-in${n > 1 ? 's' : ''} synced just now`)
  }

  useEffect(() => {
    refresh()
    const sub = AppState.addEventListener('change', s => { if (s === 'active') { refresh(); trySyncQueue() } })
    const timer = setInterval(() => { refresh(); trySyncQueue() }, 15000)
    return () => { sub.remove(); clearInterval(timer) }
  }, [])

  const onRefresh = async () => { setRefreshing(true); await refresh(); await trySyncQueue(); setRefreshing(false) }

  const handleUnpair = () => {
    clearServerConfig()
    onUnpair()
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.logo}>SyncZen Local</Text>
          <Text style={s.tag}>Mobile Check-In</Text>
        </View>

        {/* Status card */}
        <View style={[s.statusCard, { borderColor: online ? colors.green : colors.red }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={[s.dot, { backgroundColor: online ? colors.green : online === null ? colors.amber : colors.red }]} />
            <Text style={[s.statusText, { color: online ? colors.green : online === null ? colors.amber : colors.red }]}>
              {online === null ? 'Checking…' : online ? 'Server Online' : 'Server Offline'}
            </Text>
          </View>
          <Text style={s.statusSub}>
            {online
              ? 'Connected to hotel server — check-ins will sync instantly'
              : 'Working offline — check-ins will sync when server is reachable'}
          </Text>
          {lastSync ? <Text style={s.syncNote}>{lastSync}</Text> : null}
        </View>

        {/* Offline queue */}
        {queue.length > 0 && (
          <View style={s.queueCard}>
            <View style={s.queueHeader}>
              <Text style={s.queueTitle}>⏳ Pending Sync ({queue.length})</Text>
              <TouchableOpacity onPress={trySyncQueue} disabled={syncing}>
                <Text style={[s.syncBtn, syncing && { opacity: 0.4 }]}>
                  {syncing ? 'Syncing…' : '↻ Sync Now'}
                </Text>
              </TouchableOpacity>
            </View>
            {queue.map((item, i) => (
              <View key={item.id} style={s.queueItem}>
                <Text style={s.queueItemRef}>#{i + 1}</Text>
                <Text style={s.queueItemTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
                <Text style={s.queueItemAttempts}>{item.attempts} attempts</Text>
              </View>
            ))}
          </View>
        )}

        {/* Check-in button */}
        <TouchableOpacity style={s.checkinBtn} onPress={onStartCheckin} activeOpacity={0.8}>
          <Text style={s.checkinIcon}>🏨</Text>
          <Text style={s.checkinText}>Start Check-In</Text>
          <Text style={s.checkinSub}>{online ? 'Online mode' : 'Offline mode — will sync later'}</Text>
        </TouchableOpacity>

        {/* Footer */}
        <TouchableOpacity style={s.unpairBtn} onPress={handleUnpair}>
          <Text style={s.unpairText}>Unpair from server</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.bg },
  scroll:        { padding: space.lg, paddingBottom: space.xxl, minHeight: '100%' },
  header:        { alignItems: 'center', marginBottom: space.xl },
  logo:          { fontSize: font.xxl, fontWeight: '900', color: colors.textPri, letterSpacing: -0.5 },
  tag:           { fontSize: font.sm, color: colors.accent, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  statusCard:    { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, padding: space.md, marginBottom: space.md },
  dot:           { width: 10, height: 10, borderRadius: 5 },
  statusText:    { fontSize: font.lg, fontWeight: '800' },
  statusSub:     { fontSize: font.sm, color: colors.textMute, marginTop: 6, lineHeight: 18 },
  syncNote:      { fontSize: font.xs, color: colors.green, marginTop: 6, fontWeight: '600' },
  queueCard:     { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, marginBottom: space.md },
  queueHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  queueTitle:    { fontSize: font.md, fontWeight: '800', color: colors.amber },
  syncBtn:       { fontSize: font.sm, color: colors.accent, fontWeight: '700' },
  queueItem:     { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  queueItemRef:  { fontSize: font.sm, color: colors.textSec, fontWeight: '700', width: 28 },
  queueItemTime: { fontSize: font.sm, color: colors.textMute, flex: 1 },
  queueItemAttempts: { fontSize: font.xs, color: colors.textMute },
  checkinBtn:    { backgroundColor: colors.accent, borderRadius: radius.lg, padding: space.xl, alignItems: 'center', marginBottom: space.lg, shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 },
  checkinIcon:   { fontSize: 42, marginBottom: space.sm },
  checkinText:   { fontSize: font.xl, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  checkinSub:    { fontSize: font.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  unpairBtn:     { alignItems: 'center', paddingVertical: space.md },
  unpairText:    { fontSize: font.sm, color: colors.textMute, fontWeight: '600' },
})
