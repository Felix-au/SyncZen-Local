import { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Dimensions, Alert,
} from 'react-native'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system'
import { useCheckIn } from './_context'
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../src/constants/theme'

const { width: SCREEN_W } = Dimensions.get('window')
// ID card is 1.586:1 (ISO/IEC 7810 ID-1)
const CARD_W = SCREEN_W * 0.82
const CARD_H = CARD_W / 1.586

export default function IdCaptureScreen() {
  const router = useRouter()
  const { state, setLocalIdProofUri } = useCheckIn()
  const [permission, requestPermission]   = useCameraPermissions()
  const [preview, setPreview]             = useState<string | null>(state.localIdProofUri)
  const [processing, setProcessing]       = useState(false)
  const cameraRef = useRef<CameraView>(null)

  const captureAndCrop = async () => {
    if (!cameraRef.current || processing) return
    setProcessing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92, base64: false })
      if (!photo) throw new Error('Camera returned no photo.')

      // Crop to the ID card guide rectangle
      // The guide is centred in the screen; photo dimensions may differ from display
      const photoW = photo.width
      const photoH = photo.height
      const scaleX = photoW / SCREEN_W
      const scaleH = photoH / Dimensions.get('window').height

      const cropX = ((SCREEN_W - CARD_W) / 2) * scaleX
      const cropY = (Dimensions.get('window').height / 2 - CARD_H / 2) * scaleH
      const cropW = CARD_W * scaleX
      const cropHPx = CARD_H * scaleH

      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ crop: { originX: cropX, originY: cropY, width: cropW, height: cropHPx } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      )

      setPreview(manipulated.uri)
      setLocalIdProofUri(manipulated.uri)
    } catch (err: any) {
      Alert.alert('Capture Failed', err.message ?? 'Could not capture ID photo.')
    } finally {
      setProcessing(false)
    }
  }

  const retake = () => {
    setPreview(null)
    setLocalIdProofUri(null)
  }

  if (!permission) return <View style={s.bg} />

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.bg}>
        <View style={s.center}>
          <Text style={s.permTitle}>Camera Permission Required</Text>
          <TouchableOpacity style={s.btn} onPress={requestPermission}>
            <Text style={s.btnText}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Preview mode ────────────────────────────────────────────────────────────
  if (preview) {
    return (
      <SafeAreaView style={s.bg}>
        <View style={s.previewContainer}>
          <Text style={s.previewTitle}>ID Document Preview</Text>
          <Text style={s.previewSub}>Make sure the document is readable and complete.</Text>
          <Image source={{ uri: preview }} style={s.previewImage} resizeMode="contain" />
          <View style={s.previewActions}>
            <TouchableOpacity style={s.retakeBtn} onPress={retake}>
              <Text style={s.retakeBtnText}>↺ Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={() => router.push('/checkin/rooms')}>
              <Text style={s.confirmBtnText}>Use This Photo →</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.skipBtn} onPress={() => router.push('/checkin/rooms')}>
            <Text style={s.skipBtnText}>Skip ID capture</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Camera mode ─────────────────────────────────────────────────────────────
  return (
    <View style={s.bg}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Dark vignette surround */}
      <View style={s.vignette} />

      {/* Card guide frame */}
      <View style={[s.cardFrame, { width: CARD_W, height: CARD_H }]}>
        {/* Corners */}
        <View style={[s.corner, s.tl]} />
        <View style={[s.corner, s.tr]} />
        <View style={[s.corner, s.bl]} />
        <View style={[s.corner, s.br]} />
        {/* Scan line animation not needed — simple guide is enough */}
      </View>

      {/* Instructions */}
      <View style={s.hintBox}>
        <Text style={s.hintText}>
          Align the ID card within the frame.{'\n'}Ensure all edges are visible and well-lit.
        </Text>
      </View>

      {/* Capture button */}
      <SafeAreaView style={s.controls} edges={['bottom']}>
        <TouchableOpacity
          style={[s.captureBtn, processing && s.captureBtnDisabled]}
          onPress={captureAndCrop}
          disabled={processing}
        >
          <View style={s.captureInner} />
        </TouchableOpacity>
        <TouchableOpacity style={s.skipBtnCamera} onPress={() => router.push('/checkin/rooms')}>
          <Text style={s.skipBtnText}>Skip →</Text>
        </TouchableOpacity>
      </SafeAreaView>

      {/* Processing overlay */}
      {processing && (
        <View style={s.processingOverlay}>
          <Text style={s.processingText}>Processing document...</Text>
        </View>
      )}
    </View>
  )
}

const CORNER_SIZE = 28
const CORNER_BORDER = 3

const s = StyleSheet.create({
  bg:     { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  permTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, textAlign: 'center' },
  btn:  { backgroundColor: Colors.accent, borderRadius: Radius.md, padding: Spacing.md, paddingHorizontal: Spacing.xl },
  btnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.base },

  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  cardFrame: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -CARD_H / 2,
    // Clear the center by clearing the bg
    backgroundColor: 'transparent',
  },

  corner: {
    position: 'absolute',
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderColor: Colors.accent, borderWidth: CORNER_BORDER,
  },
  tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },

  hintBox: {
    position: 'absolute', bottom: 160,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  hintText: { color: Colors.textSecondary, fontSize: FontSize.xs, textAlign: 'center', lineHeight: 18 },

  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingBottom: Spacing.lg, gap: Spacing.md,
  },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnDisabled: { opacity: 0.4 },
  captureInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#fff',
  },
  skipBtnCamera: {
    paddingHorizontal: Spacing.lg, paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
  },

  skipBtn: {
    alignItems: 'center', paddingVertical: Spacing.sm,
  },
  skipBtnText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  previewContainer: {
    flex: 1, padding: Spacing.lg, gap: Spacing.md,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgBase,
  },
  previewTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  previewSub:   { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  previewImage: { width: CARD_W, height: CARD_H, borderRadius: Radius.sm, backgroundColor: Colors.bgGlass },
  previewActions: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  retakeBtn: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
    backgroundColor: Colors.bgGlass,
  },
  retakeBtnText:   { color: Colors.textSecondary, fontWeight: FontWeight.semibold, fontSize: FontSize.base },
  confirmBtn:      { flex: 2, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center' },
  confirmBtnText:  { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.base },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  processingText: { color: Colors.textPrimary, fontSize: FontSize.base, marginTop: Spacing.md },
})
