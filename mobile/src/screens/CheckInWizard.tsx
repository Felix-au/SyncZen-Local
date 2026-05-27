import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, SafeAreaView, Image, ActivityIndicator, Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { colors, radius, font, space } from '../theme'
import { smartCheckin } from '../sync'
import { fetchAvailableRooms, uploadPhoto } from '../api'
import PhotoWidget from '../components/PhotoWidget'

type Step = 'party' | 'guest' | 'document' | 'rooms' | 'confirm'
type Guest = { name: string; phone: string; age: string; sex: string; photoUri: string | null; skipped: boolean }
type Room = { id: number; room_number: string; room_type: string; floor: number; price_per_night: number }
const blank = (): Guest => ({ name: '', phone: '', age: '', sex: '', photoUri: null, skipped: false })

// ── Step bar ──────────────────────────────────────────────────────────────────
function StepBar({ step, party, gi }: { step: Step; party: number; gi: number }) {
  const steps = [
    { id: 'party',    label: 'Size' },
    { id: 'guest',    label: party > 0 ? `Guests ${Math.min(gi+1,party)}/${party}` : 'Guests' },
    { id: 'document', label: 'Document' },
    { id: 'rooms',    label: 'Rooms' },
    { id: 'confirm',  label: 'Confirm' },
  ]
  const order = ['party','guest','document','rooms','confirm']
  const cur = order.indexOf(step)
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.stepScroll} contentContainerStyle={s.stepRow}>
      {steps.map((st, i) => (
        <React.Fragment key={st.id}>
          <View style={[s.step, i === cur && s.stepActive, i < cur && s.stepDone]}>
            <View style={[s.stepDot, i === cur && s.stepDotActive, i < cur && s.stepDotDone]}>
              <Text style={[s.stepDotTxt, (i === cur || i < cur) && { color: '#fff' }]}>{i < cur ? '✓' : i + 1}</Text>
            </View>
            <Text style={[s.stepLbl, i === cur && { color: colors.accent }, i < cur && { color: colors.green }]}>{st.label}</Text>
          </View>
          {i < steps.length - 1 && <View style={[s.stepLine, i < cur && { backgroundColor: colors.green }]} />}
        </React.Fragment>
      ))}
    </ScrollView>
  )
}

export default function CheckInWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep]       = useState<Step>('party')
  const [party, setParty]     = useState(0)
  const [custom, setCustom]   = useState('')
  const [gi, setGi]           = useState(0)
  const [guests, setGuests]   = useState<Guest[]>([])
  const [docUri, setDocUri]   = useState<string | null>(null)
  const [rooms, setRooms]     = useState<Room[]>([])
  const [selRooms, setSelRooms] = useState<number[]>([])
  const [nights, setNights]   = useState('1')
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [result, setResult]   = useState<{ ok: boolean; offline: boolean; ref?: string } | null>(null)

  useEffect(() => { if (step === 'rooms') fetchAvailableRooms().then(setRooms).catch(() => setRooms([])) }, [step])

  const checkout = () => { const d = new Date(); d.setDate(d.getDate() + (parseInt(nights)||1)); return d.toISOString().slice(0,10) }

  const start = (n: number) => { setParty(n); setGuests(Array.from({length:n},blank)); setGi(0); setStep('guest') }

  const g = guests[gi]
  const setG = (f: keyof Guest, v: any) => setGuests(p => p.map((x,i) => i===gi ? {...x,[f]:v} : x))

  const nextGuest = (skip=false) => {
    if (skip) setGuests(p => p.map((x,i) => i===gi ? {...x,skipped:true} : x))
    gi < party-1 ? setGi(gi+1) : setStep('document')
  }
  const skipAll = () => { setGuests(p => p.map((x,i) => i>=gi ? {...x,skipped:true} : x)); setStep('document') }

  const back = () => {
    if (step==='guest')    { gi>0 ? setGi(gi-1) : setStep('party') }
    if (step==='document') { setGi(party-1); setStep('guest') }
    if (step==='rooms')    setStep('document')
    if (step==='confirm')  setStep('rooms')
  }

  const pickDocCamera = async () => { const r = await ImagePicker.launchCameraAsync({quality:0.85}); if(!r.canceled) setDocUri(r.assets[0].uri) }
  const pickDocGallery = async () => { const r = await ImagePicker.launchImageLibraryAsync({quality:0.85}); if(!r.canceled) setDocUri(r.assets[0].uri) }

  const submit = async () => {
    setSaving(true)
    try {
      const sexMap: Record<string,string> = { M:'male', F:'female', O:'other' }

      // Upload guest photos in parallel
      const photoPaths = await Promise.all(
        guests.map((x, i) => x.photoUri ? uploadPhoto(x.photoUri, `guest${i+1}`) : Promise.resolve(null))
      )
      // Upload document photo
      const docPath = docUri ? await uploadPhoto(docUri, 'doc') : null

      const res = await smartCheckin({
        guests: guests.map((x,i) => ({
          name: x.name.trim()||`Guest ${i+1}`,
          phone: x.phone||undefined,
          age: x.age?parseInt(x.age):undefined,
          sex: x.sex?sexMap[x.sex]??x.sex:undefined,
          photo_path: photoPaths[i]??undefined,
          is_primary: i===0
        })),
        room_ids: selRooms, check_out_date: checkout(), document_path: docPath??undefined, notes: notes.trim()||undefined
      }, {
        // Only store URIs that failed to upload — they'll be retried on sync
        guests: guests.map((x, i) => photoPaths[i] === null ? x.photoUri : null),
        document: docPath === null ? docUri : null
      })
      setResult(res)
    } catch(e:any) { Alert.alert('Error', e.message) }
    setSaving(false)
  }

  // Result screen
  if (result) return (
    <SafeAreaView style={s.root}><View style={s.center}>
      <Text style={{fontSize:60,marginBottom:space.md}}>{result.ok?'✅':'📶'}</Text>
      <Text style={s.title}>{result.ok?'Checked In!':'Saved Offline'}</Text>
      <Text style={s.sub}>{result.ok?`Reference: ${result.ref??'N/A'}`:'Will sync when server is reachable.'}</Text>
      <TouchableOpacity style={s.btn} onPress={onDone}><Text style={s.btnTxt}>← Back to Home</Text></TouchableOpacity>
    </View></SafeAreaView>
  )

  // Party size
  if (step==='party') return (
    <SafeAreaView style={s.root}>
      <StepBar step={step} party={0} gi={0} />
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>How many guests?</Text>
        <Text style={s.sub}>Select or enter the number of people checking in</Text>
        <View style={s.grid}>
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>(
            <TouchableOpacity key={n} style={[s.gridBtn,party===n&&s.gridBtnSel]} onPress={()=>setParty(n)}>
              <Text style={[s.gridNum,party===n&&{color:'#fff'}]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={s.orRow}><View style={s.orLine}/><Text style={s.orTxt}>or custom</Text><View style={s.orLine}/></View>
        <View style={{flexDirection:'row',gap:space.sm}}>
          <TextInput style={[s.input,{flex:1}]} keyboardType="number-pad" placeholder="Enter number…" placeholderTextColor={colors.textMute} value={custom} onChangeText={t=>{setCustom(t);setParty(0)}}/>
          {custom&&parseInt(custom)>0&&<TouchableOpacity style={s.ghost} onPress={()=>setParty(parseInt(custom))}><Text style={s.ghostTxt}>Select {custom}</Text></TouchableOpacity>}
        </View>
        {party>0&&<View style={s.infoBox}><Text style={s.infoTxt}>{party} guest{party>1?'s':''} selected</Text></View>}
        <View style={s.nav}>
          <TouchableOpacity style={s.ghost} onPress={onDone}><Text style={s.ghostTxt}>✕ Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn,!(party||(custom&&parseInt(custom)>0))&&{opacity:0.4}]} disabled={!(party||(custom&&parseInt(custom)>0))} onPress={()=>start(party||parseInt(custom))}>
            <Text style={s.btnTxt}>Next → Guest Details</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )

  // Guest
  if (step==='guest'&&g) {
    const remaining = party-gi-1
    return (
      <SafeAreaView style={s.root}>
        <StepBar step={step} party={party} gi={gi}/>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'}}>
            <View>
              <Text style={s.title}>Guest {gi+1} of {party}
                {gi===0&&<Text style={s.primaryBadge}> PRIMARY</Text>}
              </Text>
              <Text style={s.sub}>All fields optional — fill what's available</Text>
            </View>
            <View style={s.dots}>{guests.map((x,i)=>(
              <View key={i} style={[s.dot, i===gi&&s.dotCur, i<gi&&(x.name||x.photoUri?s.dotDone:x.skipped?s.dotSkip:undefined)]}/>
            ))}</View>
          </View>
          <View style={s.guestLayout}>
            <View style={{alignItems:'center',gap:4}}>
              <Text style={s.lbl}>PHOTO</Text>
              <PhotoWidget uri={g.photoUri} onChange={v=>setG('photoUri',v)} size={110}/>
            </View>
            <View style={{flex:1,gap:12}}>
              <View><Text style={s.lbl}>FULL NAME</Text><TextInput style={s.input} value={g.name} onChangeText={v=>setG('name',v)} placeholder="Leave blank to skip" placeholderTextColor={colors.textMute}/></View>
              <View><Text style={s.lbl}>MOBILE</Text><TextInput style={s.input} value={g.phone} onChangeText={v=>setG('phone',v)} keyboardType="phone-pad" placeholder="+91 9876543210" placeholderTextColor={colors.textMute}/></View>
              <View style={{flexDirection:'row',gap:10}}>
                <View style={{flex:1}}><Text style={s.lbl}>AGE</Text><TextInput style={s.input} value={g.age} onChangeText={v=>setG('age',v)} keyboardType="number-pad" placeholder="—" placeholderTextColor={colors.textMute}/></View>
                <View style={{flex:1}}>
                  <Text style={s.lbl}>SEX</Text>
                  <View style={{flexDirection:'row',gap:4}}>
                    {['M','F','O'].map(sx=>(
                      <TouchableOpacity key={sx} style={[s.sexBtn,g.sex===sx&&s.sexSel]} onPress={()=>setG('sex',g.sex===sx?'':sx)}>
                        <Text style={[{fontWeight:'800',fontSize:font.md,color:colors.textSec},g.sex===sx&&{color:'#fff'}]}>{sx}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </View>
          <View style={s.nav}>
            <TouchableOpacity style={s.ghost} onPress={back}><Text style={s.ghostTxt}>← Back</Text></TouchableOpacity>
            <View style={{flexDirection:'row',gap:8}}>
              {remaining>0&&<TouchableOpacity style={s.ghost} onPress={skipAll}><Text style={s.ghostTxt}>Skip All ({remaining})</Text></TouchableOpacity>}
              <TouchableOpacity style={s.ghost} onPress={()=>nextGuest(true)}><Text style={s.ghostTxt}>Skip →</Text></TouchableOpacity>
              <TouchableOpacity style={s.btn} onPress={()=>nextGuest(false)}>
                <Text style={s.btnTxt}>{gi<party-1?'Next Guest →':'Next: Document →'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  // Document
  if (step==='document') return (
    <SafeAreaView style={s.root}>
      <StepBar step={step} party={party} gi={gi}/>
      <ScrollView contentContainerStyle={s.page}>
        <Text style={s.title}>Group ID Document</Text>
        <Text style={s.sub}>Capture or attach the group's ID proof (passport, Aadhaar, licence…)</Text>
        <TouchableOpacity style={s.docBox} onPress={pickDocCamera}>
          {docUri ? <Image source={{uri:docUri}} style={s.docImg}/> : <>
            <Text style={{fontSize:42,opacity:0.4}}>🪪</Text>
            <Text style={{fontWeight:'600',fontSize:14,color:colors.textMute}}>Tap to capture or attach</Text>
          </>}
        </TouchableOpacity>
        <View style={{flexDirection:'row',gap:10,marginBottom:space.md,flexWrap:'wrap'}}>
          <TouchableOpacity style={s.ghost} onPress={pickDocCamera}><Text style={s.ghostTxt}>📷 Camera</Text></TouchableOpacity>
          <TouchableOpacity style={s.ghost} onPress={pickDocGallery}><Text style={s.ghostTxt}>🗂 Browse</Text></TouchableOpacity>
          {docUri&&<TouchableOpacity style={[s.ghost,{borderColor:colors.red}]} onPress={()=>setDocUri(null)}><Text style={[s.ghostTxt,{color:colors.red}]}>✕ Remove</Text></TouchableOpacity>}
        </View>
        <View style={s.nav}>
          <TouchableOpacity style={s.ghost} onPress={back}><Text style={s.ghostTxt}>← Back</Text></TouchableOpacity>
          <TouchableOpacity style={s.btn} onPress={()=>setStep('rooms')}><Text style={s.btnTxt}>Next: Rooms →</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )

  // Rooms
  if (step==='rooms') return (
    <SafeAreaView style={s.root}>
      <StepBar step={step} party={party} gi={gi}/>
      <ScrollView contentContainerStyle={s.page}>
        <Text style={s.title}>Select Room(s)</Text>
        <Text style={s.sub}>{selRooms.length?`${selRooms.length} selected`:'Pick one or more available rooms'}</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:space.md,marginBottom:space.md,flexWrap:'wrap'}}>
          <View><Text style={s.lbl}>NIGHTS</Text><TextInput style={[s.input,{width:80,textAlign:'center'}]} value={nights} onChangeText={setNights} keyboardType="number-pad"/></View>
          <View style={{marginTop:18}}><Text style={s.lbl}>CHECK-OUT</Text><Text style={{fontSize:font.md,fontWeight:'700',color:colors.accent}}>{checkout()}</Text></View>
        </View>
        {!rooms.length?<Text style={{color:colors.textMute,textAlign:'center',padding:space.xl}}>No available rooms.</Text>:
          rooms.map(r=>{const sel=selRooms.includes(r.id);return(
            <TouchableOpacity key={r.id} style={[s.roomCard,sel&&s.roomSel]} onPress={()=>setSelRooms(p=>p.includes(r.id)?p.filter(x=>x!==r.id):[...p,r.id])}>
              {sel&&<Text style={s.roomCheck}>✓</Text>}
              <Text style={[{fontSize:font.lg,fontWeight:'900',color:colors.textPri},sel&&{color:colors.accent}]}>Room {r.room_number}</Text>
              <Text style={{fontSize:font.sm,color:colors.textMute}}>{r.room_type} · Floor {r.floor}</Text>
              <Text style={{fontSize:font.md,fontWeight:'700',color:colors.accent,marginTop:4}}>₹{Number(r.price_per_night).toLocaleString('en-IN')}/night</Text>
            </TouchableOpacity>
          )})}
        <View><Text style={s.lbl}>NOTES (optional)</Text><TextInput style={[s.input,{minHeight:56}]} multiline value={notes} onChangeText={setNotes} placeholder="Special requests…" placeholderTextColor={colors.textMute}/></View>
        <View style={s.nav}>
          <TouchableOpacity style={s.ghost} onPress={back}><Text style={s.ghostTxt}>← Back</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn,!selRooms.length&&{opacity:0.4}]} disabled={!selRooms.length} onPress={()=>setStep('confirm')}><Text style={s.btnTxt}>Review & Confirm →</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )

  // Confirm
  return (
    <SafeAreaView style={s.root}>
      <StepBar step="confirm" party={party} gi={gi}/>
      <ScrollView contentContainerStyle={s.page}>
        <Text style={s.title}>Review & Confirm</Text>
        <View style={s.section}><Text style={s.sectionLbl}>GUESTS ({party})</Text>
          {guests.map((x,i)=>(
            <View key={i} style={s.summaryRow}>
              {x.photoUri&&<Image source={{uri:x.photoUri}} style={s.avatar}/>}
              {!x.photoUri&&<View style={[s.avatar,{alignItems:'center',justifyContent:'center'}]}><Text style={{fontSize:20}}>👤</Text></View>}
              <View style={{flex:1}}>
                <Text style={{fontWeight:'700',fontSize:font.md,color:colors.textPri}}>{x.name||`Guest ${i+1}`}{i===0?' ★':''}</Text>
                <Text style={{fontSize:font.sm,color:colors.textMute}}>{[x.phone,x.age&&`Age ${x.age}`,x.sex].filter(Boolean).join(' · ')||'No details'}</Text>
              </View>
            </View>
          ))}
        </View>
        {docUri&&<View style={s.section}><Text style={s.sectionLbl}>DOCUMENT</Text><Image source={{uri:docUri}} style={{width:'100%',height:120,borderRadius:radius.sm,resizeMode:'contain'}}/></View>}
        <View style={s.section}><Text style={s.sectionLbl}>ROOMS & STAY</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
            {selRooms.map(id=>{const r=rooms.find(x=>x.id===id);return r?(<View key={id} style={{backgroundColor:colors.accentDim,borderRadius:radius.sm,padding:'8px 14px' as any,paddingHorizontal:14,paddingVertical:8}}>
              <Text style={{fontWeight:'900',color:colors.accent}}>Room {r.room_number}</Text>
              <Text style={{fontSize:font.sm,color:colors.textMute}}>{r.room_type}</Text>
            </View>):null})}
          </View>
          <Text style={{fontSize:font.md,color:colors.textSec,marginTop:8}}>{parseInt(nights)||1} night{parseInt(nights)!==1?'s':''} · Check-out {checkout()}</Text>
          {notes?<Text style={{fontSize:font.sm,color:colors.textMute,marginTop:4}}>Note: {notes}</Text>:null}
        </View>
        <View style={s.nav}>
          <TouchableOpacity style={s.ghost} onPress={back} disabled={saving}><Text style={s.ghostTxt}>← Back</Text></TouchableOpacity>
          <TouchableOpacity style={[s.btn,saving&&{opacity:0.5}]} disabled={saving} onPress={submit}>
            {saving?<ActivityIndicator color="#fff"/>:<Text style={s.btnTxt}>✓ Confirm Check-In</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bg },
  page:        { padding: space.lg, paddingBottom: 80 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  title:       { fontSize: font.xl, fontWeight: '800', color: colors.textPri, marginBottom: 4 },
  sub:         { fontSize: font.md, color: colors.textMute, marginBottom: space.lg, lineHeight: 20 },
  primaryBadge:{ fontSize: font.xs, color: colors.accent, fontWeight: '700' },
  stepScroll:  { flexGrow: 0, backgroundColor: colors.elevated, borderBottomWidth: 1, borderBottomColor: colors.border },
  stepRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: 12 },
  step:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepActive:  {},
  stepDone:    {},
  stepDot:     { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.textMute, alignItems: 'center', justifyContent: 'center' },
  stepDotActive:{ backgroundColor: colors.accent, borderColor: colors.accent },
  stepDotDone: { backgroundColor: colors.green, borderColor: colors.green },
  stepDotTxt:  { fontSize: font.xs, fontWeight: '800', color: colors.textMute },
  stepLbl:     { fontSize: 10, fontWeight: '600', color: colors.textMute },
  stepLine:    { width: 18, height: 1, backgroundColor: colors.border, marginHorizontal: 4 },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md },
  gridBtn:     { width: '22%', height: 48, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  gridBtnSel:  { backgroundColor: colors.accent, borderColor: colors.accent },
  gridNum:     { fontSize: font.lg, fontWeight: '800', color: colors.textSec },
  orRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.sm },
  orLine:      { flex: 1, height: 1, backgroundColor: colors.border },
  orTxt:       { fontSize: font.xs, color: colors.textMute, fontWeight: '600' },
  infoBox:     { backgroundColor: colors.accentDim, borderRadius: radius.sm, padding: space.sm, marginTop: space.sm, marginBottom: space.md },
  infoTxt:     { color: colors.accent, fontWeight: '700', fontSize: font.sm, textAlign: 'center' },
  dots:        { flexDirection: 'row', gap: 5, flexWrap: 'wrap', maxWidth: 80 },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotCur:      { width: 18, borderRadius: 4, backgroundColor: colors.accent },
  dotDone:     { backgroundColor: colors.green },
  dotSkip:     { backgroundColor: colors.textMute, opacity: 0.5 },
  guestLayout: { flexDirection: 'row', gap: space.md, marginBottom: space.md, alignItems: 'flex-start' },
  sexBtn:      { flex: 1, height: 40, borderRadius: radius.xs, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  sexSel:      { backgroundColor: colors.accent, borderColor: colors.accent },
  lbl:         { fontSize: font.xs, fontWeight: '700', color: colors.textSec, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  input:       { backgroundColor: colors.elevated, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 11, color: colors.textPri, fontSize: font.md },
  docBox:      { width: '100%', minHeight: 160, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderHi, borderRadius: radius.lg, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: space.md, overflow: 'hidden' },
  docImg:      { width: '100%', height: 240, resizeMode: 'contain' },
  roomCard:    { backgroundColor: colors.elevated, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: space.md, marginBottom: space.sm, position: 'relative' },
  roomSel:     { borderColor: colors.accent, backgroundColor: colors.accentDim },
  roomCheck:   { position: 'absolute', top: 10, right: 12, color: colors.accent, fontWeight: '900', fontSize: font.lg },
  section:     { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.md, marginBottom: space.md },
  sectionLbl:  { fontSize: font.xs, fontWeight: '800', color: colors.textMute, letterSpacing: 0.8, marginBottom: space.sm },
  summaryRow:  { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.elevated, overflow: 'hidden' },
  nav:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.lg, flexWrap: 'wrap', gap: 8 },
  btn:         { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 20 },
  btnTxt:      { color: '#fff', fontWeight: '800', fontSize: font.md },
  ghost:       { backgroundColor: colors.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderHi, paddingVertical: 12, paddingHorizontal: 16 },
  ghostTxt:    { color: colors.textSec, fontWeight: '700', fontSize: font.md },
})
