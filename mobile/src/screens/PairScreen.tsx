import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  SafeAreaView, Platform, TextInput, ScrollView
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { colors, radius, font, space } from '../theme'
import { saveServerConfig } from '../store'
import { ping } from '../api'

interface Props { onPaired: () => void }

export default function PairScreen({ onPaired }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanning, setScanning] = useState(false)
  const [testing, setTesting]   = useState(false)
  const [status, setStatus]     = useState('')
  const [manualUrl, setManualUrl] = useState('http://')
  const [manualToken, setManualToken] = useState('')
  const lastScan = useRef(0)

  const connect = async (url: string, token: string) => {
    if (!url.startsWith('http') || !token.trim()) {
      Alert.alert('Missing Info', 'Enter the server URL and token.')
      return
    }
    setTesting(true); setStatus('Connecting…')
    await saveServerConfig(url.trim(), token.trim())
    const ok = await ping()
    if (!ok) {
      await saveServerConfig('', '')
      setTesting(false); setStatus('')
      Alert.alert('Connection Failed', 'Could not reach the server. Check the URL and ensure both devices are on the same WiFi network.')
      return
    }
    setStatus('Connected! ✓')
    setTimeout(onPaired, 700)
  }

  const handleScan = async ({ data }: { data: string }) => {
    const now = Date.now()
    if (now - lastScan.current < 3000 || testing) return
    lastScan.current = now
    try {
      const parsed = JSON.parse(data)
      if (!parsed.url || !parsed.token) throw new Error('Invalid QR')
      setScanning(false)
      await connect(parsed.url, parsed.token)
    } catch {
      Alert.alert('Invalid QR', 'This QR code is not from a SyncStay desktop app.', [
        { text: 'Try Again', onPress: () => setScanning(true) }
      ])
    }
  }

  const startScan = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available in browser', 'QR scanning requires the native app. Use manual entry below.')
      return
    }
    if (!permission?.granted) {
      const result = await requestPermission()
      if (!result.granted) { Alert.alert('Permission needed', 'Camera permission is required to scan QR codes.'); return }
    }
    setScanning(true)
  }

  // ── QR scanner (native only, full screen) ──────────────────────────────────
  if (scanning && Platform.OS !== 'web') return (
    <View style={s.scanRoot}>
      <CameraView style={s.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={handleScan} />
      {/* Frame overlay */}
      <View pointerEvents="none" style={s.frameWrap}>
        <View style={[s.corner, s.tl]} /><View style={[s.corner, s.tr]} />
        <View style={[s.corner, s.bl]} /><View style={[s.corner, s.br]} />
      </View>
      <Text style={s.scanHint}>Point at the QR code in the desktop app → Pair tab</Text>
      <TouchableOpacity style={s.cancelBtn} onPress={() => setScanning(false)}>
        <Text style={s.cancelTxt}>Cancel</Text>
      </TouchableOpacity>
      {testing && (
        <View style={s.testOverlay}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={[s.statusTxt, status.includes('✓') && { color: colors.green }]}>{status}</Text>
        </View>
      )}
    </View>
  )

  // ── Default screen: QR button + manual entry ───────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={s.header}>
          <Text style={s.logo}>SyncStay</Text>
          <Text style={s.tagline}>Mobile Check-In</Text>
        </View>

        <Text style={s.title}>📡  Pair with Desktop</Text>
        <Text style={s.sub}>Connect this device to a running SyncStay desktop app on the same WiFi network.</Text>

        {/* Instructions */}
        <View style={s.card}>
          {[['1','Open desktop app'],['2','Click "Pair" in the sidebar'],['3','Scan QR or enter details manually'],['4','Both devices on same WiFi']].map(([n, lbl]) => (
            <View key={n} style={s.step}>
              <View style={s.stepNum}><Text style={s.stepNumTxt}>{n}</Text></View>
              <Text style={s.stepLbl}>{lbl}</Text>
            </View>
          ))}
        </View>

        {/* QR scan button */}
        <TouchableOpacity style={s.qrBtn} onPress={startScan}>
          <Text style={s.qrBtnIcon}>📷</Text>
          <View>
            <Text style={s.qrBtnTitle}>Scan QR Code</Text>
            <Text style={s.qrBtnSub}>{Platform.OS === 'web' ? 'Not available in browser — use manual entry' : 'Fastest way to pair'}</Text>
          </View>
        </TouchableOpacity>

        {/* Divider */}
        <View style={s.divRow}><View style={s.divLine}/><Text style={s.divTxt}>or enter manually</Text><View style={s.divLine}/></View>

        {/* Manual entry */}
        <View style={s.card}>
          <Text style={s.fieldLbl}>SERVER URL</Text>
          <TextInput style={s.input} value={manualUrl} onChangeText={setManualUrl}
            placeholder="http://192.168.1.x:8080" placeholderTextColor={colors.textMute}
            autoCapitalize="none" keyboardType="url" />
          <Text style={[s.fieldLbl, { marginTop: space.md }]}>TOKEN</Text>
          <TextInput style={s.input} value={manualToken} onChangeText={setManualToken}
            placeholder="Paste token from Pair tab…" placeholderTextColor={colors.textMute}
            autoCapitalize="none" />
          <Text style={s.tokenHint}>Find the token in the desktop app under the Pair tab.</Text>
        </View>

        {/* Connect button */}
        {testing
          ? <View style={s.testingRow}><ActivityIndicator color={colors.accent} /><Text style={[s.statusTxt, status.includes('✓') && { color: colors.green }]}>{status}</Text></View>
          : <TouchableOpacity style={[s.connectBtn, (!manualUrl.startsWith('http') || !manualToken.trim()) && { opacity: 0.45 }]}
              disabled={!manualUrl.startsWith('http') || !manualToken.trim()}
              onPress={() => connect(manualUrl, manualToken)}>
              <Text style={s.connectBtnTxt}>Connect →</Text>
            </TouchableOpacity>
        }
      </ScrollView>
    </SafeAreaView>
  )
}

const CORNER = 24
const s = StyleSheet.create({
  // Default screen
  root:        { flex: 1, backgroundColor: colors.bg },
  page:        { padding: space.lg, paddingBottom: 60 },
  header:      { alignItems: 'center', marginBottom: space.xl },
  logo:        { fontSize: font.xxl, fontWeight: '900', color: colors.textPri, letterSpacing: -0.5 },
  tagline:     { fontSize: font.sm, color: colors.accent, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },
  title:       { fontSize: font.xl, fontWeight: '800', color: colors.textPri, marginBottom: space.sm },
  sub:         { fontSize: font.md, color: colors.textMute, lineHeight: 20, marginBottom: space.lg },
  card:        { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, marginBottom: space.md },
  step:        { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 7 },
  stepNum:     { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.borderHi, alignItems: 'center', justifyContent: 'center' },
  stepNumTxt:  { color: colors.accent, fontWeight: '800', fontSize: font.sm },
  stepLbl:     { color: colors.textSec, fontSize: font.md },
  qrBtn:       { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.elevated, borderRadius: radius.md, borderWidth: 2, borderColor: colors.borderHi, padding: space.md, marginBottom: space.md },
  qrBtnIcon:   { fontSize: 32 },
  qrBtnTitle:  { fontSize: font.lg, fontWeight: '800', color: colors.textPri },
  qrBtnSub:    { fontSize: font.sm, color: colors.textMute, marginTop: 2 },
  divRow:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.md },
  divLine:     { flex: 1, height: 1, backgroundColor: colors.border },
  divTxt:      { fontSize: font.xs, color: colors.textMute, fontWeight: '600' },
  fieldLbl:    { fontSize: font.xs, fontWeight: '700', color: colors.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input:       { backgroundColor: colors.elevated, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 11, color: colors.textPri, fontSize: font.md },
  tokenHint:   { fontSize: font.xs, color: colors.textMute, marginTop: 8, lineHeight: 16 },
  testingRow:  { flexDirection: 'row', alignItems: 'center', gap: space.md, justifyContent: 'center', paddingVertical: space.md },
  statusTxt:   { fontSize: font.md, fontWeight: '700', color: colors.textSec },
  connectBtn:  { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  connectBtnTxt:{ color: '#fff', fontWeight: '800', fontSize: font.lg },
  // Scanner
  scanRoot:    { flex: 1, backgroundColor: '#000' },
  camera:      { flex: 1 },
  frameWrap:   { position: 'absolute', top: '50%', left: '50%', width: 220, height: 220, marginTop: -110, marginLeft: -110 },
  corner:      { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.accent, borderWidth: 3 },
  tl:          { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr:          { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl:          { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br:          { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanHint:    { position: 'absolute', bottom: 110, left: 20, right: 20, textAlign: 'center', color: '#fff', fontSize: font.sm, backgroundColor: 'rgba(0,0,0,0.65)', padding: 10, borderRadius: radius.sm },
  cancelBtn:   { position: 'absolute', bottom: 44, alignSelf: 'center', backgroundColor: colors.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderHi, paddingVertical: 12, paddingHorizontal: 32 },
  cancelTxt:   { color: colors.textSec, fontWeight: '700', fontSize: font.md },
  testOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', gap: space.md },
})
