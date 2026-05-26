import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, Image,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { pingServer, apiPost, apiUpload } from '../../src/lib/api'
import { enqueueCheckin } from '../../src/lib/offlineQueue'
import { useCheckIn } from './_context'
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../src/constants/theme'

export default function ConfirmScreen() {
  const router = useRouter()
  const { state, reset } = useCheckIn()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const online = await pingServer()

      if (online) {
        // ── Online path: upload files and post immediately ──────────────────
        const uploadedGuests = await Promise.all(
          state.guests.map(async (g) => {
            let serverPhotoPath: string | undefined
            if (g.localPhotoUri) {
              try {
                const r = await apiUpload('/api/upload/portrait', g.localPhotoUri, 'photo')
                serverPhotoPath = r.path
              } catch { /* continue without photo */ }
            }
            return { ...g, serverPhotoPath, localPhotoUri: undefined }
          })
        )

        let idProofPath: string | null = null
        if (state.localIdProofUri) {
          try {
            const r = await apiUpload('/api/upload/id-proof', state.localIdProofUri, 'photo')
            idProofPath = r.path
          } catch { /* continue without ID */ }
        }

        await apiPost('/api/bookings', {
          guests: uploadedGuests.map(g => ({
            name: g.name,
            age:  g.age ?? null,
            sex:  g.sex ?? null,
            photo_path: g.serverPhotoPath ?? null,
            is_primary_contact: g.is_primary_contact,
          })),
          room_ids:      state.roomIds,
          check_out_date: state.checkOutDate,
          id_proof_path: idProofPath,
          notes:         state.notes || null,
        })

        Alert.alert('✓ Check-In Complete', 'Guest(s) checked in successfully.', [
          { text: 'Done', onPress: () => { reset(); router.replace('/') } }
        ])
      } else {
        // ── Offline path: enqueue for later sync ────────────────────────────
        await enqueueCheckin({
          check_out_date:    state.checkOutDate,
          room_ids:          state.roomIds,
          guests:            state.guests,
          local_id_proof_uri: state.localIdProofUri ?? undefined,
          notes:             state.notes || undefined,
        })

        Alert.alert(
          '📋 Saved Offline',
          'No server connection. Check-in has been saved locally and will sync automatically when the server is reachable.',
          [{ text: 'OK', onPress: () => { reset(); router.replace('/') } }]
        )
      }
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message ?? 'An unexpected error occurred.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Review Check-In</Text>
        <Text style={s.subtitle}>Confirm all details before submitting.</Text>

        {/* Guests */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>👥 Guests ({state.guests.length})</Text>
          {state.guests.map((g, i) => (
            <View key={i} style={s.guestRow}>
              {g.localPhotoUri
                ? <Image source={{ uri: g.localPhotoUri }} style={s.avatar} />
                : <View style={s.avatarPlaceholder}><Text style={s.avatarIcon}>♟</Text></View>
              }
              <View style={{ flex: 1 }}>
                <Text style={s.guestName}>{g.name}{g.is_primary_contact ? ' ★' : ''}</Text>
                <Text style={s.guestMeta}>
                  {[g.age && `Age ${g.age}`, g.sex].filter(Boolean).join(' · ') || 'No additional details'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ID Proof */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>🪪 ID Document</Text>
          {state.localIdProofUri
            ? <Image source={{ uri: state.localIdProofUri }} style={s.idPreview} resizeMode="contain" />
            : <Text style={s.missingText}>No ID document captured</Text>
          }
        </View>

        {/* Rooms & Stay */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>🏨 Rooms & Stay</Text>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Rooms</Text>
            <Text style={s.detailValue}>
              {state.roomIds.length} room{state.roomIds.length !== 1 ? 's' : ''} selected
            </Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Check-Out</Text>
            <Text style={s.detailValue}>{state.checkOutDate}</Text>
          </View>
          {state.notes ? (
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Notes</Text>
              <Text style={[s.detailValue, { flex: 1, textAlign: 'right' }]}>{state.notes}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[s.submitBtn, submitting && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.submitBtnText}>Submit Check-In ✓</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} disabled={submitting}>
          <Text style={s.backBtnText}>← Go Back to Edit</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bgBase },
  content: { padding: Spacing.lg, gap: Spacing.md },

  title:    { fontSize: FontSize.xl, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.base, color: Colors.textMuted },

  section: {
    backgroundColor: Colors.bgGlass, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, marginBottom: 4 },

  guestRow:          { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar:            { width: 40, height: 40, borderRadius: Radius.full },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: Radius.full, backgroundColor: Colors.accentDim, alignItems: 'center', justifyContent: 'center' },
  avatarIcon:        { fontSize: 18 },
  guestName:         { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  guestMeta:         { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },

  idPreview:    { width: '100%', height: 160, borderRadius: Radius.sm, backgroundColor: Colors.bgElevated },
  missingText:  { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' },

  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  detailValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },

  submitBtn:         { backgroundColor: Colors.accent, borderRadius: Radius.md, padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm, shadowColor: Colors.accent, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText:     { color: '#fff', fontWeight: FontWeight.heavy, fontSize: FontSize.md },

  backBtn:     { alignItems: 'center', paddingVertical: Spacing.sm },
  backBtnText: { color: Colors.textMuted, fontSize: FontSize.sm },
})
