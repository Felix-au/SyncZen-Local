import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CheckInProvider, useCheckIn } from './_context'
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../src/constants/theme'

function GroupSizeSelector() {
  const router = useRouter()
  const { state, setGroupSize } = useCheckIn()
  const sizes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        {/* Progress indicator */}
        <View style={s.progress}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={[s.progressStep, i === 1 && s.progressActive]} />
          ))}
        </View>

        <Text style={s.stepLabel}>STEP 1 OF 4</Text>
        <Text style={s.title}>How many guests?</Text>
        <Text style={s.subtitle}>Select the number of people checking in as a group.</Text>

        <View style={s.grid}>
          {sizes.map(n => (
            <TouchableOpacity
              key={n}
              style={[s.cell, state.groupSize === n && s.cellActive]}
              onPress={() => setGroupSize(n)}
            >
              <Text style={[s.cellText, state.groupSize === n && s.cellTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
          {/* 10+ */}
          <TouchableOpacity
            style={[s.cell, state.groupSize > 10 && s.cellActive, { flex: 1 }]}
            onPress={() => setGroupSize(12)}
          >
            <Text style={[s.cellText, state.groupSize > 10 && s.cellTextActive]}>10+</Text>
          </TouchableOpacity>
        </View>

        <View style={s.summary}>
          <Text style={s.summaryText}>
            {state.groupSize} guest{state.groupSize !== 1 ? 's' : ''} — one form per person on the next step.
          </Text>
        </View>

        <TouchableOpacity style={s.nextBtn} onPress={() => router.push('/checkin/guests')}>
          <Text style={s.nextBtnText}>Next: Guest Details →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

// Wrap with provider so nested screens share state
export default function CheckInIndex() {
  return (
    <CheckInProvider>
      <GroupSizeSelector />
    </CheckInProvider>
  )
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bgBase },
  content: { padding: Spacing.lg, gap: Spacing.md },

  progress: { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm },
  progressStep: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: Colors.bgGlass,
    borderWidth: 1, borderColor: Colors.border,
  },
  progressActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },

  stepLabel: { fontSize: FontSize.xs, color: Colors.accent, fontWeight: FontWeight.bold, letterSpacing: 1.5 },
  title:     { fontSize: FontSize.xxl, fontWeight: FontWeight.heavy, color: Colors.textPrimary },
  subtitle:  { fontSize: FontSize.base, color: Colors.textMuted, lineHeight: 22 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: Spacing.sm },
  cell: {
    width: '18%', aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bgGlass, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cellActive:     { backgroundColor: Colors.accentDim, borderColor: Colors.accent },
  cellText:       { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  cellTextActive: { color: Colors.accent },

  summary: {
    backgroundColor: Colors.bgGlass, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md,
  },
  summaryText: { fontSize: FontSize.sm, color: Colors.textSecondary },

  nextBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm,
  },
  nextBtnText: { color: '#fff', fontWeight: FontWeight.bold, fontSize: FontSize.base },
})
