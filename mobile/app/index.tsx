import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getServerConfig } from '../src/lib/api'
import { getPendingCount } from '../src/lib/offlineQueue'
import { addSyncListener, removeSyncListener } from '../src/lib/syncEngine'
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../src/constants/theme'

export default function HomeScreen() {
  const router = useRouter()
  const [isConfigured, setIsConfigured]     = useState(false)
  const [serverUrl, setServerUrl]           = useState('')
  const [pendingCount, setPendingCount]     = useState(0)
  const [refreshing, setRefreshing]         = useState(false)

  const loadStatus = useCallback(async () => {
    const config = await getServerConfig()
    setIsConfigured(!!config)
    setServerUrl(config?.url ?? '')
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  useEffect(() => {
    loadStatus()
    addSyncListener(setPendingCount)
    return () => removeSyncListener(setPendingCount)
  }, [loadStatus])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadStatus()
    setRefreshing(false)
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoIcon}>🏨</Text>
          </View>
          <Text style={s.title}>Hotel Check-In</Text>
          <Text style={s.subtitle}>Reception Terminal</Text>
        </View>

        {/* Server Status Card */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <View style={[s.statusDot, isConfigured ? s.dotGreen : s.dotRed]} />
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{isConfigured ? 'Server Connected' : 'No Server Configured'}</Text>
              {isConfigured && <Text style={s.cardSub} numberOfLines={1}>{serverUrl}</Text>}
            </View>
            <TouchableOpacity style={s.configBtn} onPress={() => router.push('/pair')}>
              <Text style={s.configBtnText}>{isConfigured ? 'Change' : 'Setup'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Pending sync banner */}
        {pendingCount > 0 && (
          <TouchableOpacity style={s.syncBanner} onPress={() => router.push('/queue')}>
            <Text style={s.syncIcon}>⟳</Text>
            <Text style={s.syncText}>{pendingCount} check-in{pendingCount !== 1 ? 's' : ''} pending sync</Text>
            <Text style={s.syncChevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* Main Action */}
        <TouchableOpacity
          style={[s.mainButton, !isConfigured && s.mainButtonDisabled]}
          onPress={() => isConfigured && router.push('/checkin')}
          activeOpacity={isConfigured ? 0.75 : 1}
        >
          <Text style={s.mainButtonIcon}>+</Text>
          <View>
            <Text style={s.mainButtonTitle}>New Check-In</Text>
            <Text style={s.mainButtonSub}>Register a guest or group</Text>
          </View>
        </TouchableOpacity>

        {/* Secondary Actions */}
        <View style={s.secondaryRow}>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => router.push('/queue')}>
            <Text style={s.secondaryIcon}>📋</Text>
            <Text style={s.secondaryLabel}>Sync Queue</Text>
            {pendingCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => router.push('/pair')}>
            <Text style={s.secondaryIcon}>📡</Text>
            <Text style={s.secondaryLabel}>Server Pairing</Text>
          </TouchableOpacity>
        </View>

        {!isConfigured && (
          <Text style={s.hint}>
            {'Scan the QR code on the desktop app to connect to your hotel server.'}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bgBase },
  scroll:  { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },

  header: { alignItems: 'center', paddingVertical: Spacing.xl },
  logoBox: {
    width: 72, height: 72, borderRadius: Radius.lg,
    backgroundColor: Colors.accentDim,
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoIcon:  { fontSize: 36 },
  title:     { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  subtitle:  { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },

  card: {
    backgroundColor: Colors.bgGlass,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md,
  },
  cardRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statusDot:  { width: 10, height: 10, borderRadius: 5 },
  dotGreen:   { backgroundColor: Colors.green },
  dotRed:     { backgroundColor: Colors.red },
  cardTitle:  { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  cardSub:    { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  configBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentDim,
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.25)',
  },
  configBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.accent },

  syncBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.amberDim,
    borderRadius: Radius.md, borderWidth: 1, borderColor: 'rgba(255,179,71,0.25)',
    padding: Spacing.md,
  },
  syncIcon:    { fontSize: 18, color: Colors.amber },
  syncText:    { flex: 1, fontSize: FontSize.sm, color: Colors.amber, fontWeight: FontWeight.medium },
  syncChevron: { fontSize: 20, color: Colors.amber },

  mainButton: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg, padding: Spacing.lg,
    shadowColor: Colors.accent, shadowOpacity: 0.4,
    shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  mainButtonDisabled: { opacity: 0.4 },
  mainButtonIcon:  { fontSize: 32, color: '#fff', fontWeight: FontWeight.bold },
  mainButtonTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#fff' },
  mainButtonSub:   { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  secondaryRow: { flexDirection: 'row', gap: Spacing.sm },
  secondaryBtn: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.md,
    backgroundColor: Colors.bgGlass, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, position: 'relative',
  },
  secondaryIcon:  { fontSize: 24, marginBottom: 6 },
  secondaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  badge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: Colors.red, borderRadius: Radius.full,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, color: '#fff', fontWeight: FontWeight.bold },

  hint: {
    textAlign: 'center', fontSize: FontSize.sm,
    color: Colors.textMuted, lineHeight: 20, paddingHorizontal: Spacing.md,
  },
})
