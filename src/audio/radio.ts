// The room's little stereo: an original lo-fi loop synthesized live with the
// Web Audio API. Nothing is downloaded and nothing is copyrighted: the chords,
// bass line, drums and the gentle melody are all generated here.
//
//   toggleRadio()  start or stop (call it straight from a click, so the
//                  browser allows the sound to start)
//   isPlaying()    whether it's on
//   onRadio(fn)    listen for events: 'note' (a melody note, for the floating
//                  music notes), 'kick' (for the speaker cone), 'state'
//
// Everything plays quietly through a warm low-pass filter.

export type RadioEvent = 'note' | 'kick' | 'state'
type Listener = (type: RadioEvent, at: number) => void

const BPM = 76
const BEAT = 60 / BPM
const STEP = BEAT / 2 // eighth notes
const VOLUME = 0.22

// a four-chord loop, two bars each (MIDI note numbers)
const CHORDS = [
  { root: 41, notes: [53, 57, 60, 64] }, // Fmaj7
  { root: 40, notes: [52, 55, 59, 62] }, // Em7
  { root: 38, notes: [50, 53, 57, 60] }, // Dm7
  { root: 36, notes: [48, 52, 55, 59] }, // Cmaj7
]
// melody notes drawn from C major pentatonic, one phrase per chord
const PHRASES: (number | null)[][] = [
  [72, null, 69, null, 67, 69, null, null, 72, null, 74, null, 72, null, null, null],
  [71, null, 67, null, 64, null, 67, null, 69, null, null, 67, null, null, null, null],
  [69, null, 72, null, 74, 72, null, 69, null, null, 67, null, 69, null, null, null],
  [67, null, 64, null, 67, 69, null, null, 72, null, 69, null, 67, null, null, null],
]
// drums over one bar of 8 eighths: kick, snare, hat (1 = hit)
const KICK = [1, 0, 0, 1, 0, 0, 0, 0]
const SNARE = [0, 0, 1, 0, 0, 0, 1, 0]
const HAT = [1, 1, 1, 1, 1, 1, 1, 1]

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)

interface Engine {
  ctx: AudioContext
  master: GainNode
  input: BiquadFilterNode // everything connects here; it feeds the master gain
  noise: AudioBuffer
}

let engine: Engine | null = null
let crackle: AudioBufferSourceNode | null = null
let timer: ReturnType<typeof setInterval> | null = null
let playing = false
let step = 0
let nextTime = 0
const listeners = new Set<Listener>()
const emit = (type: RadioEvent, at: number) => listeners.forEach((fn) => fn(type, at))

export const isPlaying = () => playing
export function onRadio(fn: Listener) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function setup(): Engine {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AC()
  const warm = ctx.createBiquadFilter()
  warm.type = 'lowpass'
  warm.frequency.value = 2200
  warm.Q.value = 0.4
  const master = ctx.createGain()
  master.gain.value = 0
  warm.connect(master).connect(ctx.destination)

  // one second of white noise, reused for drums and the vinyl crackle
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return { ctx, master, input: warm, noise }
}

function startCrackle({ ctx, input }: Engine) {
  // sparse clicks and a soft hiss, like an old record
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.012 + (Math.random() < 0.0004 ? (Math.random() - 0.5) * 0.5 : 0)
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  const g = ctx.createGain()
  g.gain.value = 0.5
  src.connect(g).connect(input)
  src.start()
  return src
}

// a soft electric-piano note: sine plus a quieter octave, slow decay
function keys({ ctx, input }: Engine, m: number, t: number, len: number, vel = 0.12) {
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vel, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0008, t + len)
  g.connect(input)
  const partials: [number, number, OscillatorType][] = [
    [1, 1, 'sine'],
    [2, 0.25, 'triangle'],
  ]
  for (const [mult, amp, type] of partials) {
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.value = hz(m) * mult
    o.detune.value = (Math.random() - 0.5) * 8 // a little tape wobble
    const a = ctx.createGain()
    a.gain.value = amp
    o.connect(a).connect(g)
    o.start(t)
    o.stop(t + len + 0.05)
  }
}

function bass({ ctx, input }: Engine, m: number, t: number, len: number) {
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.value = hz(m)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.32, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.001, t + len)
  o.connect(g).connect(input)
  o.start(t)
  o.stop(t + len + 0.05)
}

function kick({ ctx, input }: Engine, t: number) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(120, t)
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.5, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  o.connect(g).connect(input)
  o.start(t)
  o.stop(t + 0.3)
}

function hiss({ ctx, input, noise }: Engine, t: number, len: number, vol: number, freq: number, type: BiquadFilterType) {
  const s = ctx.createBufferSource()
  s.buffer = noise
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + len)
  s.connect(f).connect(g).connect(input)
  s.start(t, Math.random() * 0.5)
  s.stop(t + len + 0.02)
}

function schedule(e: Engine) {
  while (nextTime < e.ctx.currentTime + 0.15) {
    const t = nextTime
    const inBar = step % 8
    const bar = Math.floor(step / 8)
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length]
    const swing = step % 2 ? STEP * 0.16 : 0 // lazy swung eighths

    if (step % 16 === 0) chord.notes.forEach((m, i) => keys(e, m, t + i * 0.025, BEAT * 7.5, 0.06))
    if (inBar === 0 || inBar === 5) bass(e, chord.root, t + swing, BEAT * 1.6)
    if (KICK[inBar]) {
      kick(e, t)
      emit('kick', t)
    }
    if (SNARE[inBar]) hiss(e, t, 0.18, 0.16, 1800, 'bandpass')
    if (HAT[inBar]) hiss(e, t + swing, 0.04, step % 2 ? 0.03 : 0.05, 7000, 'highpass')

    const phrase = PHRASES[Math.floor(bar / 2) % PHRASES.length]
    const m = phrase[step % 16]
    if (m) {
      keys(e, m, t + swing, BEAT * 1.4, 0.07)
      emit('note', t + swing)
    }
    step++
    nextTime += STEP
  }
}

function start() {
  const e = (engine ??= setup())
  const { ctx, master } = e
  void ctx.resume()
  crackle ??= startCrackle(e)
  step = 0
  nextTime = ctx.currentTime + 0.08
  schedule(e)
  timer = setInterval(() => schedule(e), 30)
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setTargetAtTime(VOLUME, ctx.currentTime, 0.3)
  playing = true
  emit('state', ctx.currentTime)
}

function stop() {
  if (timer) clearInterval(timer)
  timer = null
  playing = false
  if (!engine) return
  const { ctx, master } = engine
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.15)
  emit('state', ctx.currentTime)
  // let the fade finish, then let the audio thread rest
  setTimeout(() => {
    if (!playing) void ctx.suspend()
  }, 900)
}

export function toggleRadio() {
  if (playing) stop()
  else start()
  return playing
}

// the time on the audio clock, so visuals can line up with scheduled sounds
export const audioNow = () => (engine ? engine.ctx.currentTime : 0)
