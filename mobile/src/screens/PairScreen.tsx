import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
  SafeAreaView, Platform, TextInput
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
  const lastScan = useRef(0)

  // Web: manual entry instead of QR camera scan
  const [webUrl, setWebUrl]     = useState('http://')
  const [webToken, setWebToken] = useState('')

  const testAndSave = async (url: string, token: string) => {
    setTesting(true); setStatus('Connecting to server…')
    await saveServerConfig(url.trim(), token.trim())
    const ok = await ping()
    if (!ok) {
      setTesting(false); setStatus('')
      if (Platform.OS === 'web') {
        alert('Could not reach server. Check the URL and ensure the desktop app is running and on the same network.')
      } else {
        Alert.alert('Connection Failed', 'Could not reach the server. Make sure both devices are on the same WiFi network.')
      }
      return
    }
    setStatus('Connected! ✓')
    setTimeout(onPaired, 700)
  }

  if (Platform.OS === 'web') return (
    <SafeAreaView style={s.root}>
      <View style={s.center}>
        <Text style={s.icon}>🌐</Text>
        <Text style={s.title}>Connect to Desktop</Text>
        <Text style={s.sub}>Enter the server URL and token shown in the desktop app's Pair tab.</Text>
        <View style={{ width: '100%', gap: 10, marginBottom: space.lg }}>
          <Text style={s.inputLabel}>Server URL</Text>
          <TextInput style={s.webInput} value={webUrl} onChangeText={setWebUrl}
            placeholder="http://192.168.1.x:8080" placeholderTextColor={colors.textMute} autoCapitalize="none" />
          <Text style={s.inputLabel}>Token</Text>
          <TextInput style={s.webInput} value={webToken} onChangeText={setWebToken}
            placeholder="Paste token from Pair tab…" placeholderTextColor={colors.textMute} autoCapitalize="none" />
        </View>
        {testing
          ? <ActivityIndicator color={colors.accent} />
          : <TouchableOpacity style={[s.btn, (!webUrl.startsWith('http') || !webToken) && { opacity: 0.4 }]}
              disabled={!webUrl.startsWith('http') || !webToken}
              onPress={() => testAndSave(webUrl, webToken)}>
              <Text style={s.btnText}>Connect →</Text>
            </TouchableOpacity>
        }
        {status ? <Text style={{ color: colors.green, marginTop: 12, fontWeight: '700' }}>{status}</Text> : null}
      </View>
    </SafeAreaView>
  )

  if (!permission) return <View style={s.center}><ActivityIndicator color={colors.accent} /></View>

  if (!permission.granted) return (
    <SafeAreaView style={s.root}>
      <View style={s.center}>
        <Text style={s.icon}>📷</Text>
        <Text style={s.title}>Camera Permission</Text>
        <Text style={s.sub}>SyncStay needs camera access to scan the QR code from the desktop app.</Text>
        <TouchableOpacity style={s.btn} onPress={requestPermission}>
          <Text style={s.btnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )

  const handleScan = async ({ data }: { data: string }) => {
    const now = Date.now()
    if (now - lastScan.current < 3000 || testing) return
    lastScan.current = now

    try {
      const parsed = JSON.parse(data)
      if (!parsed.url || !parsed.token) throw new Error('Invalid QR')

      setScanning(false)
      setTesting(true)
      setStatus('Connecting to server…')

      await saveServerConfig(parsed.url, parsed.token)
      const ok = await ping()
      if (!ok) {
        setStatus('')
        setTesting(false)
        Alert.alert('Connection Failed', 'Could not reach the server. Make sure both devices are on the same WiFi network.', [
          { text: 'Retry', onPress: () => setScanning(true) }
        ])
        return
      }

      setStatus('Connected! ✓')
      setTimeout(onPaired, 800)
    } catch {
      setTesting(false)
      setStatus('')
      Alert.alert('Invalid QR', 'This QR code is not from a SyncStay desktop app.', [
        { text: 'Try Again', onPress: () => setScanning(true) }
      ])
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>SyncStay</Text>
        <Text style={s.headerSub}>Mobile Check-In</Text>
      </View>

      {testing ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[s.sub, { marginTop: space.md, color: status.includes('✓') ? colors.green : colors.textSec }]}>
            {status}
          </Text>
        </View>
      ) : scanning ? (
        <View style={s.scannerWrap}>
          <CameraView
            style={s.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleScan}
          />
          <View style={s.scanFrame} pointerEvents="none">
            <View style={[s.corner, s.tl]} />
            <View style={[s.corner, s.tr]} />
            <View style={[s.corner, s.bl]} />
            <View style={[s.corner, s.br]} />
          </View>
          <Text style={s.scanHint}>Point camera at the QR code in the SyncStay desktop app → Pair tab</Text>
          <TouchableOpacity style={s.cancelBtn} onPress={() => setScanning(false)}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.center}>
          <Text style={s.icon}>📡</Text>
          <Text style={s.title}>Pair with Desktop</Text>
          <Text style={s.sub}>
            Open the SyncStay desktop app, go to the{' '}
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Pair</Text>
            {' '}tab, and scan the QR code shown there.
          </Text>

          <TouchableOpacity style={s.btn} onPress={() => setScanning(true)}>
            <Text style={s.btnText}>📷  Scan QR Code</Text>
          </TouchableOpacity>

          <View style={s.stepCard}>
            {[
              ['1', 'Open desktop app'],
              ['2', 'Click "Pair" in the sidebar'],
              ['3', 'Scan the QR code here'],
              ['4', 'Both devices on same WiFi'],
            ].map(([n, label]) => (
              <View key={n} style={s.step}>
                <View style={s.stepNum}><Text style={s.stepNumText}>{n}</Text></View>
                <Text style={s.stepLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

const CORNER = 22
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  header:      { alignItems: 'center', paddingTop: space.xl, paddingBottom: space.lg },
  headerTitle: { fontSize: font.xxl, fontWeight: '900', color: colors.textPri, letterSpacing: -0.5 },
  headerSub:   { fontSize: font.sm, color: colors.accent, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  icon:        { fontSize: 52, marginBottom: space.md },
  title:       { fontSize: font.xl, fontWeight: '800', color: colors.textPri, marginBottom: space.sm, textAlign: 'center' },
  sub:         { fontSize: font.md, color: colors.textSec, textAlign: 'center', lineHeight: 20, marginBottom: space.lg },
  btn:         { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 32, marginBottom: space.xl },
  btnText:     { color: '#fff', fontWeight: '800', fontSize: font.lg },
  stepCard:    { width: '100%', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md },
  step:        { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8 },
  stepNum:     { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.borderHi, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: colors.accent, fontWeight: '800', fontSize: font.sm },
  stepLabel:   { color: colors.textSec, fontSize: font.md },
  scannerWrap: { flex: 1, position: 'relative' },
  camera:      { flex: 1 },
  scanFrame:   { position: 'absolute', top: '50%', left: '50%', width: 220, height: 220, marginTop: -110, marginLeft: -110 },
  corner:      { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.accent, borderWidth: 3 },
  tl:          { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr:          { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl:          { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br:          { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  scanHint:    { position: 'absolute', bottom: 100, left: 20, right: 20, textAlign: 'center', color: colors.textPri, fontSize: font.sm, backgroundColor: 'rgba(0,0,0,0.65)', padding: 10, borderRadius: radius.sm },
  cancelBtn:   { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: colors.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderHi, paddingVertical: 12, paddingHorizontal: 32 },
  cancelText:  { color: colors.textSec, fontWeight: '700', fontSize: font.md },
  inputLabel:  { fontSize: font.sm, fontWeight: '700', color: colors.textSec, textTransform: 'uppercase', letterSpacing: 0.4 },
  webInput:    { backgroundColor: colors.elevated, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.textPri, fontSize: font.md, width: '100%' },
})
