import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { C } from './palette'
import { getVideoUrl } from '@model-source'
import { GLOW, LIGHTS } from './timeOfDay'
import { onRadio, audioNow } from '../audio/radio'
import type { Phase } from '../clock'
import { ctx2d } from './canvas'

type Vec3 = [number, number, number]
type GroupProps = ThreeElements['group']
type Paint = (g: CanvasRenderingContext2D, w: number, h: number) => void

// A box with rounded edges (stands in for drei's RoundedBox).
interface RoundedBoxProps extends Omit<ThreeElements['mesh'], 'args'> {
  args: Vec3
  radius: number
  smoothness?: number
  children?: ReactNode
}
function RoundedBox({ args: [w, h, d], radius, smoothness = 3, children, ...props }: RoundedBoxProps) {
  const geometry = useMemo(() => new RoundedBoxGeometry(w, h, d, smoothness, radius), [w, h, d, smoothness, radius])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} {...props}>
      {children}
    </mesh>
  )
}

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function canvasTexture(w: number, h: number, paint: Paint, srgb = true) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  paint(ctx2d(c), w, h)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/* ------------------------------------------------------------------ steam */

// Smooth value noise, tiled, used to carve wisps out of a plane.
function noiseTexture() {
  const t = canvasTexture(
    128,
    128,
    (g) => {
      const small = document.createElement('canvas')
      small.width = small.height = 16
      const s = ctx2d(small)
      const img = s.createImageData(16, 16)
      let seed = 11
      for (let i = 0; i < 256; i++) {
        seed = (seed * 16807) % 2147483647
        const v = (seed / 2147483647) * 255
        img.data.set([v, v, v, 255], i * 4)
      }
      s.putImageData(img, 0, 0)
      g.imageSmoothingEnabled = true
      g.imageSmoothingQuality = 'high'
      // draw 3x3 so the bilinear upscale wraps cleanly at the edges
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) g.drawImage(small, x * 128, y * 128, 128, 128)
    },
    false
  )
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// Two twisting ribbons of steam rising from the mug.
export function Steam({ ref, height = 0.2, width = 0.07, ...props }: { ref?: Ref<THREE.Group>; height?: number; width?: number } & GroupProps) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uNoise: { value: noiseTexture() },
          uColor: { value: new THREE.Color(C.paper) },
          uOpacity: { value: 0.7 },
        },
        vertexShader: /* glsl */ `
          uniform float uTime; uniform sampler2D uNoise; varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            // sway more the higher the steam rises
            float n = texture2D(uNoise, vec2(0.25, uv.y * 0.35 - uTime * 0.02)).r - 0.5;
            float m = texture2D(uNoise, vec2(0.75, uv.y * 0.25 - uTime * 0.015)).r - 0.5;
            p.x += n * 0.06 * uv.y * uv.y * 2.0;
            p.z += m * 0.04 * uv.y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform sampler2D uNoise; uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
          void main() {
            vec2 suv = vec2(vUv.x * 0.5, vUv.y * 0.3 - uTime * 0.035);
            float s = smoothstep(0.42, 0.95, texture2D(uNoise, suv).r);
            s *= smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);   // soft sides
            s *= smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.35, vUv.y);   // fade in at the cup, out at the top
            gl_FragColor = vec4(uColor, s * uOpacity);
          }`,
      }),
    []
  )
  const still = useMemo(reducedMotion, [])
  useFrame((_, dt) => {
    if (!still) material.uniforms.uTime.value += dt * 10
  })
  return (
    <group ref={ref} {...props}>
      {/* the camera never rotates, so face the planes towards it once */}
      {[0, 1].map((i) => (
        <mesh key={i} material={material} position={[0, height / 2, 0]} rotation={[0, Math.PI / 4 + i * 0.5, 0]} renderOrder={5}>
          <planeGeometry args={[width, height, 4, 24]} />
        </mesh>
      ))}
    </group>
  )
}

/* --------------------------------------------------------------- screens */

// Exported so Lighting can dim the pictures during the opening light-up.
export const tvScreen = new THREE.MeshBasicMaterial({ toneMapped: false, color: '#ffffff' })
export const laptopScreen = new THREE.MeshBasicMaterial({ toneMapped: false, color: '#ffffff' })

// A muted clip looping on a screen. Clips are tiny (20 to 50 KB), load after the
// room is on screen, and are decoded by the browser's video hardware.
interface ScreenVideoProps extends Omit<ThreeElements['mesh'], 'material'> {
  clip: string
  material: THREE.MeshBasicMaterial
  width: number
  height: number
  paused?: boolean
}
export function ScreenVideo({ clip, material, width, height, paused = false, ...props }: ScreenVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  useEffect(() => {
    let video: HTMLVideoElement | undefined
    let texture: THREE.VideoTexture | undefined
    let cancelled = false
    getVideoUrl(clip).then((src) => {
      if (cancelled) return
      video = document.createElement('video')
      Object.assign(video, { src, muted: true, loop: true, playsInline: true, crossOrigin: 'anonymous', preload: 'auto' })
      video.setAttribute('muted', '')
      video.setAttribute('playsinline', '')
      videoRef.current = video
      texture = new THREE.VideoTexture(video)
      texture.colorSpace = THREE.SRGBColorSpace
      material.map = texture
      material.needsUpdate = true
      if (reducedMotion()) {
        // `!`: assigned just above; the nested closure loses that narrowing
        video.addEventListener('loadeddata', () => (video!.currentTime = 4.5), { once: true })
      } else if (!pausedRef.current) {
        video.play().catch(() => {}) // muted autoplay is allowed; ignore a browser that refuses
      }
    })
    return () => {
      cancelled = true
      videoRef.current = null
      video?.pause()
      texture?.dispose()
      material.map = null
    }
  }, [clip, material])
  // pause while hidden (e.g. the laptop asleep at night) so it costs nothing
  useEffect(() => {
    const v = videoRef.current
    if (!v || reducedMotion()) return
    if (paused) v.pause()
    else v.play().catch(() => {})
  }, [paused])
  return (
    <mesh material={material} {...props}>
      <planeGeometry args={[width, height]} />
    </mesh>
  )
}

/* ---------------------------------------------------------------- laptop */

// The laptop's sleep screen for the night: deep blue with a crescent moon
// and a few stars, in place of the code.
function sleepTexture() {
  return canvasTexture(256, 160, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#1B2140')
    sky.addColorStop(1, '#0E1226')
    g.fillStyle = sky
    g.fillRect(0, 0, w, h)
    g.fillStyle = 'rgba(233, 238, 242, 0.55)'
    for (const [x, y, r] of [[40, 30, 1.4], [70, 112, 1], [190, 36, 1.2], [214, 104, 1.6], [150, 128, 1], [104, 46, 0.9]]) {
      g.beginPath()
      g.arc(x, y, r, 0, Math.PI * 2)
      g.fill()
    }
    // crescent: a pale disc with a sky-coloured disc over it
    g.fillStyle = '#F3EBDD'
    g.beginPath()
    g.arc(w / 2, h / 2, 22, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#18203C'
    g.beginPath()
    g.arc(w / 2 + 10, h / 2 - 7, 20, 0, Math.PI * 2)
    g.fill()
  })
}

// A slim silver laptop: aluminium body, black bezel, code on screen.
// Built facing +z; rotate it to face the person using it.
// `asleep` swaps the code for a sleep screen and pauses the clip.
export function Laptop({ asleep = false, ...props }: { asleep?: boolean } & GroupProps) {
  const sleepMap = useMemo(sleepTexture, [])
  const W = 0.27, D = 0.19, T = 0.009
  const LID_H = 0.172
  const silver = '#C9CCD1'
  return (
    <group {...props}>
      {/* base */}
      <mesh castShadow receiveShadow position={[0, T / 2, 0]}>
        <boxGeometry args={[W, T, D]} />
        <meshStandardMaterial color={silver} roughness={0.35} metalness={0.2} />
      </mesh>
      {/* keyboard area */}
      <mesh position={[0, T + 0.0005, -0.022]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W * 0.84, D * 0.44]} />
        <meshStandardMaterial color="#2B2F38" roughness={0.8} />
      </mesh>
      {/* trackpad: a dark square below the keyboard */}
      <mesh position={[0, T + 0.0005, 0.06]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.07, 0.056]} />
        <meshStandardMaterial color="#4A4F5A" roughness={0.5} />
      </mesh>
      {/* lid, hinged at the back edge and leaning back a little */}
      <group position={[0, T, -D / 2]} rotation={[-0.26, 0, 0]}>
        <mesh castShadow position={[0, LID_H / 2, -0.003]}>
          <boxGeometry args={[W, LID_H, 0.006]} />
          <meshStandardMaterial color={silver} roughness={0.35} metalness={0.2} />
        </mesh>
        <mesh position={[0, LID_H / 2, 0.0002]}>
          <planeGeometry args={[W - 0.006, LID_H - 0.006]} />
          <meshStandardMaterial color="#0E1018" roughness={0.3} />
        </mesh>
        <ScreenVideo
          clip="laptop-loop"
          material={laptopScreen}
          width={0.25}
          height={0.156}
          position={[0, LID_H / 2 + 0.003, 0.0006]}
          paused={asleep}
          visible={!asleep}
        />
        <mesh position={[0, LID_H / 2 + 0.003, 0.0006]} visible={asleep}>
          <planeGeometry args={[0.25, 0.156]} />
          <meshBasicMaterial map={sleepMap} toneMapped={false} color="#B8BFD0" />
        </mesh>
      </group>
    </group>
  )
}

/* ----------------------------------------------------------------- clock */

// Seven-segment digits, drawn rather than typeset so no font is needed.
const SEGMENTS: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' }
function drawDigit(g: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number, on: string, off: string) {
  const t = w * 0.18
  const segs: Record<string, [x: number, y: number, w: number, h: number]> = {
    a: [x + t, y, w - 2 * t, t], d: [x + t, y + h - t, w - 2 * t, t], g: [x + t, y + h / 2 - t / 2, w - 2 * t, t],
    f: [x, y + t, t, h / 2 - t], b: [x + w - t, y + t, t, h / 2 - t],
    e: [x, y + h / 2, t, h / 2 - t], c: [x + w - t, y + h / 2, t, h / 2 - t],
  }
  for (const [k, r] of Object.entries(segs)) {
    g.fillStyle = SEGMENTS[ch].includes(k) ? on : off
    g.fillRect(...r)
  }
}

// A walnut-framed digital clock in 24-hour time, showing the visitor's real
// local time: big digits and a seconds bar along the bottom.
export function DigitalClock({ at, facing = 'z' }: { at: Vec3; facing?: 'x' | 'z' }) {
  const W = 0.3, H = 0.12, D = 0.03
  const { texture, draw } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 192
    const g = ctx2d(c)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    const on = '#F6E7C1', off = 'rgba(246,231,193,0.07)'
    const draw = (d: Date) => {
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      const sec = d.getSeconds()
      g.fillStyle = '#141826'
      g.fillRect(0, 0, 512, 192)
      // digits fill the face; the date line was too small to read, so it's gone
      const xs = [58, 146, 292, 380]
      ;`${hh}${mm}`.split('').forEach((ch, i) => drawDigit(g, ch, xs[i], 22, 74, 136, on, off))
      g.fillStyle = sec % 2 === 0 ? C.sun : off
      g.fillRect(249, 58, 14, 14)
      g.fillRect(249, 106, 14, 14)
      // seconds bar along the bottom
      g.fillStyle = 'rgba(246,231,193,0.12)'
      g.fillRect(58, 172, 396, 6)
      g.fillStyle = C.sun
      g.fillRect(58, 172, 396 * (sec / 59), 6)
      t.needsUpdate = true
    }
    return { texture: t, draw }
  }, [])
  const last = useRef(-1)
  useFrame(() => {
    const d = new Date()
    if (d.getSeconds() !== last.current) {
      last.current = d.getSeconds()
      draw(d) // redraws once a second
    }
  })
  return (
    <group position={at} rotation={facing === 'x' ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
      <RoundedBox args={[W, H, D]} radius={0.012} smoothness={3} position={[0, 0, D / 2]} castShadow>
        <meshStandardMaterial color="#6B4F3A" roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0, D + 0.0005]}>
        <planeGeometry args={[W - 0.026, H - 0.024]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* --------------------------------------------------------------- posters */

// Original art, painted in code so it costs no downloads.
const POSTERS = {
  // a cook's flat-lay: pan, knife, herbs and tomatoes
  kitchen(g, w, h) {
    g.fillStyle = '#F3EEE2'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#E2D6C0'
    g.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.72)
    const u = w / 100
    // pan
    g.fillStyle = C.ink
    g.beginPath()
    g.arc(w * 0.46, h * 0.36, 24 * u, 0, Math.PI * 2)
    g.fill()
    g.fillRect(w * 0.46 + 20 * u, h * 0.36 - 3 * u, 30 * u, 6 * u)
    g.fillStyle = '#4A5170'
    g.beginPath()
    g.arc(w * 0.46, h * 0.36, 19 * u, 0, Math.PI * 2)
    g.fill()
    // a tomato slice and a basil leaf in the pan
    g.fillStyle = '#D9654F'
    g.beginPath()
    g.arc(w * 0.42, h * 0.33, 7 * u, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#5E7A5A'
    g.beginPath()
    g.ellipse(w * 0.52, h * 0.39, 6 * u, 3 * u, 0.6, 0, Math.PI * 2)
    g.fill()
    // knife
    g.fillStyle = '#C9CCD1'
    g.beginPath()
    g.moveTo(w * 0.18, h * 0.64)
    g.lineTo(w * 0.62, h * 0.6)
    g.lineTo(w * 0.62, h * 0.63)
    g.lineTo(w * 0.2, h * 0.67)
    g.fill()
    g.fillStyle = '#5C4A39'
    g.fillRect(w * 0.62, h * 0.595, 20 * u, 4 * u)
    // tomatoes
    ;[[0.2, 0.2], [0.27, 0.15], [0.76, 0.66]].forEach(([x, y]) => {
      g.fillStyle = '#D9654F'
      g.beginPath()
      g.arc(w * x, h * y, 6 * u, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#5E7A5A'
      g.fillRect(w * x - u, h * y - 7 * u, 2 * u, 3 * u)
    })
    g.fillStyle = C.ink
    g.font = `600 ${w * 0.075}px system-ui, sans-serif`
    g.textAlign = 'center'
    g.fillText('Mise en place', w / 2, h * 0.9)
  },
  // a gamepad, drawn as an original shape
  controller(g, w, h) {
    g.fillStyle = '#2E3550'
    g.fillRect(0, 0, w, h)
    const u = w / 100
    g.strokeStyle = 'rgba(247,248,245,0.08)'
    g.lineWidth = u * 0.6
    for (let y = h * 0.1; y < h * 0.8; y += 6 * u) {
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(w, y)
      g.stroke()
    }
    const cx = w / 2, cy = h * 0.42
    g.fillStyle = '#E9EEF2'
    g.beginPath()
    g.ellipse(cx - 22 * u, cy + 6 * u, 18 * u, 22 * u, 0.35, 0, Math.PI * 2)
    g.ellipse(cx + 22 * u, cy + 6 * u, 18 * u, 22 * u, -0.35, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.roundRect(cx - 30 * u, cy - 12 * u, 60 * u, 26 * u, 12 * u)
    g.fill()
    g.fillStyle = '#2E3550'
    g.fillRect(cx - 30 * u, cy - 1.5 * u, 14 * u, 4 * u)
    g.fillRect(cx - 24.5 * u, cy - 7 * u, 4 * u, 14 * u)
    g.fillStyle = C.sun
    ;[[0, -5], [5, 0], [0, 5], [-5, 0]].forEach(([dx, dy]) => {
      g.beginPath()
      g.arc(cx + 23 * u + dx * u, cy + dy * u, 2.6 * u, 0, Math.PI * 2)
      g.fill()
    })
    g.fillStyle = '#7C8DA6'
    g.beginPath()
    g.arc(cx - 9 * u, cy + 12 * u, 5 * u, 0, Math.PI * 2)
    g.arc(cx + 9 * u, cy + 12 * u, 5 * u, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#F7F8F5'
    g.font = `600 ${w * 0.08}px system-ui, sans-serif`
    g.textAlign = 'center'
    g.fillText('Player one', w / 2, h * 0.88)
  },
  sun(g, w, h) {
    g.fillStyle = '#F3EEE2'
    g.fillRect(0, 0, w, h)
    const m = w * 0.1
    const iw = w - m * 2, ih = h - m * 2.6
    const sky = g.createLinearGradient(0, m, 0, m + ih)
    sky.addColorStop(0, '#E9C9A8')
    sky.addColorStop(1, '#F2D79A')
    g.fillStyle = sky
    g.fillRect(m, m, iw, ih)
    g.fillStyle = C.sun
    g.beginPath()
    g.arc(m + iw * 0.5, m + ih * 0.5, iw * 0.26, 0, Math.PI * 2)
    g.fill()
    ;([['#C98F72', 0.62], ['#A86F63', 0.72], ['#7E5A5C', 0.82], [C.ink, 0.92]] as const).forEach(([c, y], i) => {
      g.fillStyle = c
      g.beginPath()
      g.moveTo(m, m + ih)
      for (let x = 0; x <= iw; x += 4) g.lineTo(m + x, m + ih * y - Math.sin((x / iw) * Math.PI * (1.5 + i * 0.6) + i) * ih * 0.05)
      g.lineTo(m + iw, m + ih)
      g.fill()
    })
    g.fillStyle = C.ink
    g.font = `600 ${w * 0.06}px system-ui, sans-serif`
    g.textAlign = 'center'
    g.fillText('Sonoran morning', w / 2, h - m * 0.75)
  },
  saguaro(g, w, h) {
    g.fillStyle = '#5E7A5A'
    g.fillRect(0, 0, w, h)
    g.fillStyle = '#F3EEE2'
    g.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.88)
    const cx = w * 0.5
    const unit = w * 0.07
    g.fillStyle = '#5E7A5A'
    const pill = (x: number, y: number, ww: number, hh: number) => {
      g.beginPath()
      g.roundRect(x, y, ww, hh, ww / 2)
      g.fill()
    }
    pill(cx - unit, h * 0.2, unit * 2, h * 0.62)
    pill(cx - unit * 4, h * 0.36, unit * 1.6, h * 0.22)
    pill(cx - unit * 4, h * 0.5, unit * 3.4, unit * 1.6)
    pill(cx + unit * 2.4, h * 0.3, unit * 1.6, h * 0.2)
    pill(cx + unit * 0.6, h * 0.44, unit * 3.4, unit * 1.6)
    g.fillStyle = C.sun
    g.beginPath()
    g.arc(w * 0.74, h * 0.17, unit * 1.2, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#C9B497'
    g.fillRect(w * 0.08, h * 0.82, w * 0.84, h * 0.12)
  },
  contours(g, w, h) {
    g.fillStyle = '#E9EEF2'
    g.fillRect(0, 0, w, h)
    g.lineWidth = Math.max(1.5, w * 0.004)
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = i % 4 === 0 ? '#2E3550' : '#7C8DA6'
      g.beginPath()
      for (let a = 0; a <= Math.PI * 2 + 0.05; a += 0.05) {
        const r = (0.08 + i * 0.03) * h * (1 + 0.18 * Math.sin(a * 3 + i * 0.4) + 0.08 * Math.cos(a * 5 - i * 0.3))
        const x = w * 0.42 + Math.cos(a) * r * 1.6
        const y = h * 0.52 + Math.sin(a) * r
        a === 0 ? g.moveTo(x, y) : g.lineTo(x, y)
      }
      g.stroke()
    }
    g.fillStyle = C.sun
    g.beginPath()
    g.arc(w * 0.42, h * 0.52, h * 0.035, 0, Math.PI * 2)
    g.fill()
  },
} satisfies Record<string, Paint>

// Fills the frame like CSS object-fit: cover, so any image size works.
function coverFit(texture: THREE.Texture<HTMLImageElement>, frameAspect: number) {
  const img = texture.image
  const aspect = img.width / img.height
  texture.repeat.set(1, 1)
  texture.offset.set(0, 0)
  if (aspect > frameAspect) {
    texture.repeat.x = frameAspect / aspect
    texture.offset.x = (1 - texture.repeat.x) / 2
  } else {
    texture.repeat.y = aspect / frameAspect
    texture.offset.y = (1 - texture.repeat.y) / 2
  }
}

// A framed print. `facing` is 'x' for the left wall, 'z' for the right wall.
// `src` shows an image file instead of the painted `art` (which stays as the
// fallback if the image is missing or fails to load).
interface PosterProps {
  art: keyof typeof POSTERS
  src?: string | null
  facing: 'x' | 'z'
  at: Vec3
  size: [number, number]
  frame?: string
}
export function Poster({ art, src, facing, at, size, frame = '#3A3A3A' }: PosterProps) {
  const [w, h] = size
  const painted = useMemo(() => canvasTexture(Math.round(w * 1400), Math.round(h * 1400), POSTERS[art]), [art, w, h])
  const [image, setImage] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!src) return
    let alive = true
    new THREE.TextureLoader().load(
      src,
      (t) => {
        if (!alive) return t.dispose()
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 4
        coverFit(t, (w - 0.024) / (h - 0.024))
        setImage(t)
      },
      undefined,
      () => {} // keep the painted fallback
    )
    return () => {
      alive = false
    }
  }, [src, w, h])
  const texture = image ?? painted
  const rot: Vec3 = facing === 'x' ? [0, Math.PI / 2, 0] : [0, 0, 0]
  const depth = 0.014
  const b = 0.012
  return (
    <group position={at} rotation={rot}>
      {/* frame: four bars, then the print set just inside */}
      {[
        [0, h / 2 - b / 2, w, b],
        [0, -h / 2 + b / 2, w, b],
        [-w / 2 + b / 2, 0, b, h],
        [w / 2 - b / 2, 0, b, h],
      ].map(([x, y, bw, bh], i) => (
        <mesh key={i} position={[x, y, depth / 2]} castShadow receiveShadow>
          <boxGeometry args={[bw, bh, depth]} />
          <meshStandardMaterial color={frame} roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0, depth * 0.4]} receiveShadow>
        <planeGeometry args={[w - b * 2, h - b * 2]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------- rug */

// An abstract, colourful rug: a mosaic of tiles, each with its own quarter
// circles, half moons, discs or stripes in the room's palette, so every part
// that peeks out from under the furniture is colourful.
function paintRug(g: CanvasRenderingContext2D, w: number, h: number) {
  const colors = ['#5E7A5A', C.sun, '#E8A27A', '#7C8DA6', C.ink, '#EFE7D6', '#B5684B', '#9FB4C7']
  let seed = 9
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const pick = (not?: string) => {
    let c: string
    do c = colors[Math.floor(rnd() * colors.length)]
    while (c === not)
    return c
  }
  const rows = 5
  const size = h / rows
  const cols = Math.ceil(w / size)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * size, y = r * size
      const bg = pick()
      const fg = pick(bg)
      g.fillStyle = bg
      g.fillRect(x, y, size + 1, size + 1)
      g.fillStyle = fg
      g.save()
      g.translate(x + size / 2, y + size / 2)
      g.rotate(Math.floor(rnd() * 4) * (Math.PI / 2))
      g.translate(-size / 2, -size / 2)
      g.beginPath()
      switch (Math.floor(rnd() * 5)) {
        case 0: // quarter circle from a corner
          g.moveTo(0, 0)
          g.arc(0, 0, size, 0, Math.PI / 2)
          break
        case 1: // half moon on an edge
          g.moveTo(0, size / 2)
          g.arc(size / 2, size, size / 2, Math.PI, Math.PI * 2)
          break
        case 2: // disc
          g.arc(size / 2, size / 2, size * 0.32, 0, Math.PI * 2)
          break
        case 3: // two stripes
          g.rect(0, size * 0.15, size, size * 0.18)
          g.rect(0, size * 0.6, size, size * 0.18)
          break
        default: // triangle
          g.moveTo(0, 0)
          g.lineTo(size, 0)
          g.lineTo(0, size)
      }
      g.fill()
      if (rnd() < 0.35) {
        g.fillStyle = pick(fg)
        g.beginPath()
        g.arc(size * 0.72, size * 0.72, size * 0.1, 0, Math.PI * 2)
        g.fill()
      }
      g.restore()
    }
  }
  // a fine woven texture over everything
  g.fillStyle = 'rgba(46,53,80,0.06)'
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1)
}

export function Rug({ size, at }: { size: [number, number]; at: Vec3 }) {
  const [L, D] = size
  const texture = useMemo(() => canvasTexture(1024, Math.round((1024 * D) / L), paintRug), [L, D])
  return (
    <group position={[at[0] + L / 2, at[1], at[2] + D / 2]}>
      <mesh receiveShadow position={[0, 0.004, 0]}>
        <boxGeometry args={[L, 0.008, D]} />
        <meshStandardMaterial color="#D8CCB4" roughness={1} />
      </mesh>
      <mesh receiveShadow position={[0, 0.0085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L, D]} />
        <meshStandardMaterial map={texture} roughness={1} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------ floor lamp */

// One round base, a thin pole and a fabric shade that glows at night.
export function FloorLamp({ at, glowSet }: { at: Vec3; glowSet?: Set<THREE.MeshStandardMaterial> }) {
  const shade = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#F2D79A', emissive: '#F2C14E', emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide })
    glowSet?.add(m)
    return m
  }, [glowSet])
  useEffect(
    () => () => {
      glowSet?.delete(shade)
    },
    [glowSet, shade]
  )
  return (
    <group position={at}>
      <mesh castShadow receiveShadow position={[0, 0.008, 0]}>
        <cylinderGeometry args={[0.075, 0.08, 0.016, 32]} />
        <meshStandardMaterial color={C.ink} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.69, 12]} />
        <meshStandardMaterial color={C.ink} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, 0.77, 0]} material={shade}>
        <cylinderGeometry args={[0.055, 0.085, 0.17, 24, 1, true]} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------ gamepad */

// The controller's top-view outline: a body with two rounded grips.
function gamepadShape() {
  const s = new THREE.Shape()
  s.moveTo(-0.05, 0.03)
  s.lineTo(0.05, 0.03)
  s.quadraticCurveTo(0.074, 0.03, 0.076, 0.004)
  s.quadraticCurveTo(0.082, -0.032, 0.07, -0.052)
  s.quadraticCurveTo(0.055, -0.068, 0.04, -0.052)
  s.quadraticCurveTo(0.026, -0.026, 0, -0.024)
  s.quadraticCurveTo(-0.026, -0.026, -0.04, -0.052)
  s.quadraticCurveTo(-0.055, -0.068, -0.07, -0.052)
  s.quadraticCurveTo(-0.082, -0.032, -0.076, 0.004)
  s.quadraticCurveTo(-0.074, 0.03, -0.05, 0.03)
  return s
}

// A generic game controller: a bevelled body with grips, offset thumbsticks,
// a d-pad, four face buttons, a home button and shoulder bumpers. No logos.
export function Gamepad({ color = '#2B2F38', ...props }: { color?: string } & GroupProps) {
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(gamepadShape(), {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 4,
      curveSegments: 16,
    })
    g.rotateX(-Math.PI / 2) // lie flat: outline in x/z, thickness up
    g.translate(0, 0.006, 0)
    return g
  }, [])
  const TOP = 0.0245 // top surface of the body
  const trim = '#3A3F4A'
  // positions are [x, z] in the controller's own top view (−z is the far edge)
  const stick = (x: number, z: number) => (
    <group position={[x, TOP, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.009, 0.01, 0.006, 20]} />
        <meshStandardMaterial color={trim} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.004, 0]}>
        <cylinderGeometry args={[0.0075, 0.0075, 0.002, 20]} />
        <meshStandardMaterial color="#555B68" roughness={0.9} />
      </mesh>
    </group>
  )
  return (
    <group {...props}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* shoulder bumpers along the far edge */}
      {[-1, 1].map((side) => (
        <RoundedBox key={side} args={[0.036, 0.008, 0.01]} radius={0.003} position={[side * 0.042, 0.014, -0.036]}>
          <meshStandardMaterial color={trim} roughness={0.6} />
        </RoundedBox>
      ))}
      {stick(-0.042, -0.008)}
      {stick(0.022, 0.018)}
      {/* d-pad */}
      <group position={[-0.022, TOP + 0.001, 0.018]}>
        <mesh>
          <boxGeometry args={[0.016, 0.003, 0.005]} />
          <meshStandardMaterial color={trim} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.005, 0.003, 0.016]} />
          <meshStandardMaterial color={trim} />
        </mesh>
      </group>
      {/* face buttons */}
      {[[0, -0.0075], [0.0075, 0], [0, 0.0075], [-0.0075, 0]].map(([dx, dz], i) => (
        <mesh key={i} position={[0.046 + dx, TOP + 0.001, -0.006 + dz]}>
          <cylinderGeometry args={[0.0034, 0.0034, 0.003, 14]} />
          <meshStandardMaterial color="#9AA1AC" roughness={0.4} />
        </mesh>
      ))}
      {/* home button */}
      <mesh position={[0, TOP + 0.0008, -0.014]}>
        <cylinderGeometry args={[0.005, 0.005, 0.002, 18]} />
        <meshStandardMaterial color="#C9CCD1" roughness={0.3} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------ flat book */

// A single hardback lying flat: cover, spine and a cream page block.
export function FlatBook({ size = [0.1, 0.016, 0.145], cover = C.saguaro, ...props }: { size?: Vec3; cover?: string } & GroupProps) {
  const [w, h, d] = size
  return (
    <group {...props}>
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={cover} roughness={0.8} />
      </mesh>
      {/* pages show on the three open edges */}
      <mesh position={[0.004, h / 2, 0]}>
        <boxGeometry args={[w - 0.004, h * 0.72, d - 0.008]} />
        <meshStandardMaterial color="#F3EEE2" roughness={0.95} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------ running shoe */

// Measurements of the shoe, in room units (about 16 cm long).
const SHOE = { L: 0.16, W: 0.056, SOLE: 0.02 }

// Half the foot's width along its length (x from heel −0.08 to toe +0.08):
// narrow heel, widest across the ball of the foot, rounding off at the toe.
const footHalfWidth = (x: number) => {
  const t = (x + 0.08) / 0.16
  return (SHOE.W / 2) * (0.74 + 0.3 * Math.sin(Math.PI * Math.min(1, t * 1.15)) - 0.12 * Math.max(0, t - 0.85) * 6)
}
// The toe lifts off the ground a little, like a real running shoe.
const toeSpring = (x: number) => 5 * Math.max(0, x - 0.03) ** 2

// Side profile of the upper (x: heel -> toe, y: up from the top of the sole).
const UPPER_TOP = [
  [0.079, 0.0], [0.08, 0.008], [0.072, 0.019], [0.05, 0.03], [0.02, 0.039], [-0.008, 0.046],
  [-0.028, 0.043], [-0.05, 0.046], [-0.068, 0.054], [-0.08, 0.048], [-0.081, 0.0],
]
const upperTopAt = (x: number) => {
  for (let i = 0; i < UPPER_TOP.length - 1; i++) {
    const [x0, y0] = UPPER_TOP[i], [x1, y1] = UPPER_TOP[i + 1]
    if ((x <= x0 && x >= x1) || (x >= x0 && x <= x1)) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1)
  }
  return 0
}

function useShoeGeometry() {
  return useMemo(() => {
    // upper: extrude the side profile, then pinch it so it's narrow at the top
    // and follows the foot's outline, which rounds it into a shoe shape
    const prof = new THREE.Shape()
    prof.moveTo(-0.081, 0)
    prof.lineTo(0.079, 0)
    prof.splineThru(UPPER_TOP.slice(1).map(([x, y]) => new THREE.Vector2(x, y)))
    const upper = new THREE.ExtrudeGeometry(prof, { depth: 1, bevelEnabled: false, curveSegments: 24, steps: 6 })
    upper.translate(0, 0, -0.5)
    const p = upper.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      const top = Math.max(0.012, upperTopAt(x))
      const pinch = 1 - 0.55 * Math.min(1, y / top) ** 2
      p.setZ(i, z * 2 * footHalfWidth(x) * pinch)
      p.setY(i, y + SHOE.SOLE + toeSpring(x))
    }
    upper.computeVertexNormals()

    // sole: the foot outline seen from above, extruded to the sole's thickness
    const outline = new THREE.Shape()
    const N = 40
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      const x = Math.cos(a) * 0.082
      const z = Math.sin(a) * (footHalfWidth(x) + 0.004)
      i === 0 ? outline.moveTo(x, z) : outline.lineTo(x, z)
    }
    const sole = (thick: number, bevel: number) => {
      const g = new THREE.ExtrudeGeometry(outline, { depth: thick, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 })
      g.rotateX(Math.PI / 2) // outline in x/z, thickness downward
      g.translate(0, thick + bevel, 0)
      const q = g.attributes.position
      for (let i = 0; i < q.count; i++) q.setY(i, q.getY(i) + toeSpring(q.getX(i)))
      g.computeVertexNormals()
      return g
    }
    return { upper, midsole: sole(SHOE.SOLE - 0.008, 0.003), outsole: sole(0.002, 0.001) }
  }, [])
}

// A thin tube that runs along the side of the upper at a fixed height.
function useSideLine(y: number, x0: number, x1: number, sideSign: number) {
  return useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 12; i++) {
      const x = x0 + ((x1 - x0) * i) / 12
      const top = Math.max(0.012, upperTopAt(x))
      const pinch = 1 - 0.55 * Math.min(1, y / top) ** 2
      pts.push(new THREE.Vector3(x, y + SHOE.SOLE + toeSpring(x), sideSign * (footHalfWidth(x) * pinch + 0.0008)))
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0013, 6, false)
  }, [y, x0, x1, sideSign])
}

// A running shoe: dark outsole, white midsole with toe spring, a black upper
// that tapers like a foot, two thin white stripes along each side, white
// laces, a heel pull tab and a dark collar opening.
export function RunningShoe({ upper = '#1C1E24', accent = '#F2F2EE', ...props }: { upper?: string; accent?: string } & GroupProps) {
  const g = useShoeGeometry()
  const stripes = [
    useSideLine(0.017, -0.06, 0.01, 1), useSideLine(0.025, -0.055, 0.0, 1),
    useSideLine(0.017, -0.06, 0.01, -1), useSideLine(0.025, -0.055, 0.0, -1),
  ]
  const laceXs = [-0.002, 0.012, 0.026, 0.04]
  return (
    <group {...props}>
      <mesh geometry={g.outsole} castShadow receiveShadow>
        <meshStandardMaterial color="#2A2C31" roughness={0.9} />
      </mesh>
      <mesh geometry={g.midsole} position={[0, 0.003, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={accent} roughness={0.7} />
      </mesh>
      <mesh geometry={g.upper} castShadow receiveShadow>
        <meshStandardMaterial color={upper} roughness={0.8} />
      </mesh>
      {stripes.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial color={accent} roughness={0.6} />
        </mesh>
      ))}
      {/* laces across the top */}
      {laceXs.map((x) => {
        const y = upperTopAt(x) + SHOE.SOLE + toeSpring(x) - 0.002
        return (
          <mesh key={x} position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.0016, footHalfWidth(x) * 0.7, 3, 6]} />
            <meshStandardMaterial color={accent} roughness={0.6} />
          </mesh>
        )
      })}
      {/* collar opening and heel pull tab */}
      <mesh position={[-0.046, SHOE.SOLE + 0.0445, 0]} rotation={[-Math.PI / 2, -0.12, 0]} scale={[1.35, 0.85, 1]}>
        <circleGeometry args={[0.014, 20]} />
        <meshStandardMaterial color="#0B0C0F" roughness={1} />
      </mesh>
      <mesh position={[-0.076, SHOE.SOLE + 0.054, 0]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.004, 0.014, 0.01]} />
        <meshStandardMaterial color={accent} roughness={0.6} />
      </mesh>
    </group>
  )
}

/* -------------------------------------------------------------- medal case */

// One medal hanging from a V of ribbon, built facing +z, hung from its top.
interface Medal {
  metal: string
  ribbon: [string, string]
  length?: number
}
function HangingMedal({ metal, ribbon, length = 0.07 }: Medal) {
  const R = 0.02
  const spread = 0.012
  return (
    <group>
      {[-1, 1].map((s, i) => (
        <mesh key={s} position={[(s * spread) / 2, -length / 2, 0]} rotation={[0, 0, (s * spread) / length]}>
          <planeGeometry args={[0.009, length]} />
          <meshStandardMaterial color={ribbon[i]} roughness={0.8} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <group position={[0, -length - R + 0.004, 0.002]}>
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[R, R, 0.004, 32]} />
          <meshStandardMaterial color={metal} roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.0022]}>
          <torusGeometry args={[R * 0.8, 0.0014, 8, 32]} />
          <meshStandardMaterial color={metal} roughness={0.2} metalness={0.5} />
        </mesh>
      </group>
    </group>
  )
}

// A walnut shadow box with a navy back, a glass front and medals hanging
// inside. Stands on its base, facing +z. `size` is [width, height, depth].
export function MedalCase({ size = [0.24, 0.17, 0.05], medals, ...props }: { size?: Vec3; medals: Medal[] } & GroupProps) {
  const [w, h, d] = size
  const b = 0.012 // frame thickness
  const wood = '#6B4F3A'
  return (
    <group {...props}>
      {/* back panel */}
      <mesh position={[0, h / 2, -d / 2 + 0.003]} receiveShadow>
        <boxGeometry args={[w, h, 0.006]} />
        <meshStandardMaterial color="#2E3550" roughness={0.95} />
      </mesh>
      {/* frame: top, bottom, sides */}
      {[
        [0, h - b / 2, w, b],
        [0, b / 2, w, b],
        [-w / 2 + b / 2, h / 2, b, h],
        [w / 2 - b / 2, h / 2, b, h],
      ].map(([x, y, bw, bh], i) => (
        <mesh key={i} position={[x, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[bw, bh, d]} />
          <meshStandardMaterial color={wood} roughness={0.6} />
        </mesh>
      ))}
      {/* a thin rail inside the top that the ribbons hang from */}
      <mesh position={[0, h - b - 0.004, -d / 2 + 0.012]}>
        <boxGeometry args={[w - 2 * b, 0.004, 0.004]} />
        <meshStandardMaterial color="#C9A24A" roughness={0.4} metalness={0.3} />
      </mesh>
      {medals.map((m, i) => (
        <group key={i} position={[(i - (medals.length - 1) / 2) * ((w - 2 * b) / medals.length) * 0.85, h - b - 0.006, -d / 2 + 0.014]}>
          <HangingMedal {...m} />
        </group>
      ))}
      {/* glass front */}
      <mesh position={[0, h / 2, d / 2 - 0.002]} renderOrder={6}>
        <planeGeometry args={[w - 2 * b, h - 2 * b]} />
        <meshStandardMaterial color="#DCEAF0" transparent opacity={0.16} roughness={0.05} metalness={0.1} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ desk */

// A walnut writing desk, built in code so it can have real detail: a top with
// a lighter edge, a three-drawer pedestal on one end with recessed fronts,
// dark reveals between drawers and metal bar pulls, a slim pencil drawer under
// the top, a side panel and a back panel.
// Built in room space: back against the wall at x = 0, front facing +x,
// running from z0 to z0 + length. The top surface sits at `height`.
interface DeskProps {
  z0?: number
  length?: number
  depth?: number
  height?: number
  color?: string
}
export function Desk({ z0 = 1.2, length = 0.73, depth = 0.4, height = 0.384, color = '#6B4F3A' }: DeskProps) {
  const TOP = 0.026
  const under = height - TOP // underside of the top
  const PED = 0.3 // pedestal width along z
  const pedZ0 = z0 + length - PED - 0.01
  const front = depth - 0.012 // x of the drawer fronts
  const face = '#7A5B44'
  const reveal = '#3A2A1F'
  const metal = '#C9CCD1'
  const zc = (a: number, b: number) => (a + b) / 2

  const box = (from: Vec3, to: Vec3, c: string, cast = true) => {
    // map keeps the tuple's length; TypeScript only knows it returns number[]
    const size = to.map((v, i) => v - from[i]) as Vec3
    const pos = to.map((v, i) => (v + from[i]) / 2) as Vec3
    return (
      <mesh position={pos} castShadow={cast} receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={c} roughness={0.65} />
      </mesh>
    )
  }
  // a bar pull: a metal rod on two short posts, running along z
  const pull = (x: number, y: number, z: number, len = 0.1) => (
    <group position={[x, y, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.012, 0, 0]} castShadow>
        <cylinderGeometry args={[0.0035, 0.0035, len, 10]} />
        <meshStandardMaterial color={metal} roughness={0.3} metalness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[0, 0, Math.PI / 2]} position={[0.006, 0, (s * len) / 2 - s * 0.006]}>
          <cylinderGeometry args={[0.0025, 0.0025, 0.012, 8]} />
          <meshStandardMaterial color={metal} roughness={0.3} metalness={0.6} />
        </mesh>
      ))}
    </group>
  )

  // drawer heights from the top of the pedestal down
  const drawers = [0.1, 0.11, under - 0.21 - 0.03]
  let y = under - 0.004
  const drawerFronts = drawers.map((h, i) => {
    const top = y, bottom = y - h
    y = bottom - 0.006 // reveal between drawers
    return (
      <group key={i}>
        {/* the dark reveal behind, then the drawer front slightly proud of it */}
        {box([front - 0.004, bottom - 0.003, pedZ0 + 0.008], [front, top + 0.003, z0 + length - 0.018], reveal, false)}
        {box([front, bottom, pedZ0 + 0.012], [front + 0.012, top, z0 + length - 0.022], face)}
        {/* a recessed panel line just inside each drawer front */}
        {box([front + 0.012, bottom + 0.012, pedZ0 + 0.026], [front + 0.0135, top - 0.012, z0 + length - 0.036], '#694C38', false)}
        {pull(front + 0.0135, (top + bottom) / 2 + (i === 2 ? h * 0.18 : 0), zc(pedZ0, z0 + length - 0.01))}
      </group>
    )
  })

  return (
    <group>
      {/* top, with a lighter strip along the front edge */}
      {box([0, under, z0], [depth, height, z0 + length], color)}
      {box([depth - 0.004, under + 0.002, z0], [depth + 0.002, height - 0.002, z0 + length], '#8A6A50', false)}

      {/* pedestal carcass and drawers */}
      {box([0.01, 0.012, pedZ0], [front, under, z0 + length - 0.01], color)}
      {box([0.01, 0, pedZ0 + 0.01], [front - 0.01, 0.012, z0 + length - 0.02], reveal)}
      {drawerFronts}

      {/* slim pencil drawer under the top, between the side panel and the pedestal */}
      {box([front - 0.004, under - 0.05, z0 + 0.03], [front, under, pedZ0 - 0.012], reveal, false)}
      {box([front, under - 0.046, z0 + 0.034], [front + 0.01, under - 0.004, pedZ0 - 0.016], face)}
      {pull(front + 0.01, under - 0.025, zc(z0 + 0.034, pedZ0 - 0.016), 0.08)}

      {/* side panel at the open end, and a back panel for cables */}
      {box([0.01, 0, z0 + 0.008], [depth - 0.01, under, z0 + 0.03], color)}
      {box([0.004, under - 0.2, z0 + 0.03], [0.018, under, pedZ0], '#5E4433')}

    </group>
  )
}

/* ----------------------------------------------------------- track light */

// One adjustable spot on the track: a cylinder head with a glowing lens,
// aimed at `target`, with a real spotlight inside it. `at` and `target` are
// room coordinates, so the light and its aim point live outside the head's group.
function TrackSpot({ at, target }: { at: Vec3; target: Vec3 }) {
  const head = useRef<THREE.Group>(null)
  const light = useRef<THREE.SpotLight>(null)
  const aim = useMemo(() => new THREE.Object3D(), [])
  const lens = useMemo(() => new THREE.MeshStandardMaterial({ color: '#FFF1D0', emissive: '#FFE2A8', emissiveIntensity: 0.3 }), [])
  const key = `${at.join(',')}|${target.join(',')}`
  useEffect(() => {
    // `!`: effects run after mount, when both refs are set and the head has a parent group
    const h = head.current!
    const l = light.current!
    aim.position.set(...target)
    h.parent!.updateMatrixWorld(true)
    h.lookAt(...target) // the head's +z points at the target
    l.target = aim
    LIGHTS.desk.add(l)
    GLOW.desk.add(lens)
    return () => {
      LIGHTS.desk.delete(l)
      GLOW.desk.delete(lens)
    }
  }, [aim, lens, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <group position={at}>
        {/* short stem down from the rail */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.04, 8]} />
          <meshStandardMaterial color={C.ink} roughness={0.5} />
        </mesh>
        <group ref={head}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.012]}>
            <cylinderGeometry args={[0.016, 0.019, 0.05, 20]} />
            <meshStandardMaterial color={C.ink} roughness={0.45} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.0375]} material={lens}>
            <circleGeometry args={[0.015, 20]} />
          </mesh>
        </group>
      </group>
      <primitive object={aim} />
      {/* lights default to sitting one unit up, so give it its position explicitly */}
      <spotLight ref={light} position={at} color="#FFE6B8" angle={0.36} penumbra={0.55} distance={2} decay={1.2} intensity={0} />
    </>
  )
}

// A slim ceiling-style track rail fixed high on the left wall, with spots
// aimed down at the desk. `spots` is a list of { z, target }.
interface DeskTrackLightProps {
  y?: number
  z0: number
  z1: number
  spots: { z: number; target: Vec3 }[] // one spot per entry, aimed at `target`
}
export function DeskTrackLight({ y = 1.19, z0, z1, spots }: DeskTrackLightProps) {
  return (
    <group>
      <mesh position={[0.03, y, (z0 + z1) / 2]} castShadow>
        <boxGeometry args={[0.014, 0.014, z1 - z0]} />
        <meshStandardMaterial color={C.ink} roughness={0.5} />
      </mesh>
      {[z0 + 0.03, z1 - 0.03].map((z) => (
        <mesh key={z} position={[0.014, y, z]}>
          <boxGeometry args={[0.028, 0.008, 0.012]} />
          <meshStandardMaterial color={C.ink} roughness={0.5} />
        </mesh>
      ))}
      {spots.map((s) => (
        <TrackSpot key={s.z} at={[0.04, y - 0.04, s.z]} target={s.target} />
      ))}
    </group>
  )
}

/* ---------------------------------------------------------------- stereo */

// A music note drawn on a canvas: a single eighth note, or two beamed ones.
function noteTexture(beamed: boolean) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#FFFFFF'
    g.strokeStyle = '#FFFFFF'
    g.lineWidth = 9
    g.lineCap = 'round'
    const head = (x: number, y: number) => {
      g.save()
      g.translate(x, y)
      g.rotate(-0.45)
      g.beginPath()
      g.ellipse(0, 0, 17, 12, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
    if (beamed) {
      head(34, 100)
      head(92, 88)
      g.beginPath()
      g.moveTo(48, 96)
      g.lineTo(48, 26)
      g.moveTo(106, 84)
      g.lineTo(106, 14)
      g.stroke()
      g.beginPath() // the beam
      g.moveTo(44, 22)
      g.lineTo(110, 8)
      g.lineTo(110, 26)
      g.lineTo(44, 40)
      g.closePath()
      g.fill()
    } else {
      head(52, 98)
      g.beginPath()
      g.moveTo(66, 94)
      g.lineTo(66, 18)
      g.stroke()
      g.beginPath() // the flag
      g.moveTo(66, 18)
      g.bezierCurveTo(78, 34, 104, 40, 96, 72)
      g.bezierCurveTo(94, 52, 80, 46, 66, 44)
      g.fill()
    }
  })
}

interface FloatingNote {
  age: number // seconds since it was let out; -1 while it waits in the pool
  side: number
  drift: number
  kind: number // 0 = single note, 1 = beamed pair
}

// Music notes that drift up from the record player while it plays, like the steam
// over the mug: each melody note sends one up, swaying and fading out.
function MusicNotes({ playing, color, origin }: { playing: boolean; color: string; origin: Vec3 }) {
  const textures = useMemo(() => [noteTexture(false), noteTexture(true)], [])
  const POOL = 10
  const sprites = useRef<(THREE.Sprite | null)[]>([])
  const notes = useMemo<FloatingNote[]>(() => Array.from({ length: POOL }, () => ({ age: -1, side: 0, drift: 0, kind: 0 })), [])
  const pending = useRef<number[]>([])
  const still = useMemo(reducedMotion, [])
  const last = useRef(0)
  useEffect(
    () =>
      onRadio((type, at) => {
        if (type === 'note') pending.current.push(at)
        if (type === 'state') pending.current.length = 0
      }),
    []
  )
  useEffect(() => {
    for (const s of sprites.current) if (s) s.material.color.set(color)
  }, [color])
  const LIFE = 2.8
  useFrame((_, dt) => {
    // let a note out when its sound is due, at most one every 0.35 s
    const now = audioNow()
    while (pending.current.length && pending.current[0] <= now) {
      pending.current.shift()
      if (still || !playing || now - last.current < 0.35) continue
      const n = notes.find((x) => x.age < 0)
      if (!n) continue
      last.current = now
      n.age = 0
      n.side = (Math.random() - 0.5) * 0.07
      n.drift = Math.random() < 0.5 ? -1 : 1
      n.kind = Math.random() < 0.35 ? 1 : 0
    }
    notes.forEach((n, i) => {
      const s = sprites.current[i]
      if (!s) return
      if (n.age < 0) {
        s.visible = false
        return
      }
      n.age += dt
      const k = n.age / LIFE
      if (k >= 1) {
        n.age = -1
        s.visible = false
        return
      }
      s.visible = true
      s.material.map = textures[n.kind]
      s.position.set(
        origin[0] + n.side + Math.sin(n.age * 2.2) * 0.035 * n.drift,
        origin[1] + k * 0.5,
        origin[2] + n.side * 0.5
      )
      s.material.rotation = Math.sin(n.age * 1.8) * 0.25 * n.drift
      s.material.opacity = Math.min(1, k * 6) * (1 - k) ** 1.1
      const size = 0.075 + k * 0.025
      s.scale.set(size, size, 1)
    })
  })
  return notes.map((_, i) => (
    <sprite
      key={i}
      ref={(el) => {
        sprites.current[i] = el
      }}
      visible={false}
      renderOrder={6}
      raycast={() => null}
    >
      <spriteMaterial map={textures[0]} color={color} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  ))
}

// The record's face: fine grooves, a couple of gaps between tracks, and a
// coloured centre label with a spindle hole.
function recordTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const c = w / 2
    g.fillStyle = '#121419'
    g.fillRect(0, 0, w, h)
    for (let r = 46; r < 126; r += 1.6) {
      const gap = (r > 74 && r < 77) || (r > 100 && r < 103) // spaces between songs
      g.strokeStyle = gap ? '#08090C' : r % 3.2 < 1.6 ? '#1E2128' : '#15171C'
      g.lineWidth = 1
      g.beginPath()
      g.arc(c, c, r, 0, Math.PI * 2)
      g.stroke()
    }
    // a soft sheen across the vinyl so the spin is visible
    const sheen = g.createLinearGradient(0, 0, w, h)
    sheen.addColorStop(0.35, 'rgba(255,255,255,0)')
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.10)')
    sheen.addColorStop(0.65, 'rgba(255,255,255,0)')
    g.fillStyle = sheen
    g.beginPath()
    g.arc(c, c, 126, 0, Math.PI * 2)
    g.arc(c, c, 44, 0, Math.PI * 2, true)
    g.fill()
    g.fillStyle = C.sun
    g.beginPath()
    g.arc(c, c, 42, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#B5684B'
    g.fillRect(c - 42, c - 6, 84, 12) // a band across the label
    g.fillStyle = '#121419'
    g.beginPath()
    g.arc(c, c, 3.5, 0, Math.PI * 2)
    g.fill()
  })
}

// Where the tonearm swings to: angle about its pivot that puts the stylus on
// the record's outer grooves, and how far the arm tilts (down to play, up to rest).
const ARM = { pivot: [0.1, -0.065] as const, length: 0.13, play: -0.65, down: 0.004, up: -0.12 }

// A turntable on a low walnut record stand with a shelf of LPs. While the music
// plays the record spins and the tonearm sits on it; when it stops, the arm
// lifts and swings back to its rest. `at` is the centre of the stand's
// footprint on the floor; the front faces +z.
export function RecordPlayer({ at, playing, phase }: { at: Vec3; playing: boolean; phase: Phase }) {
  // the stand
  const SW = 0.34
  const SD = 0.24
  const LEG = 0.07
  const BOX = 0.15
  const top = LEG + BOX
  const walnut = '#7A5B44'
  // the turntable sitting on it
  const PW = 0.28
  const PD = 0.21
  const PH = 0.035
  const deck = top + PH // the turntable's top surface
  const P = [-0.035, 0] as const // platter centre (x, z) relative to the turntable centre
  const disc = useRef<THREE.Mesh>(null)
  const spin = useRef(0)
  const swing = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)
  const arm = useRef({ yaw: 0, pitch: ARM.up })
  const recordMap = useMemo(recordTexture, [])
  const sleeves = ['#2E3550', '#B5684B', '#5E7A5A', '#E0A43A', '#7C8DA6', '#C9A24A', '#3A3F4D', '#9FB4C7', '#8E7356']

  useFrame((_, dt) => {
    // the platter speeds up to 33⅓ rpm and coasts to a stop
    const target = playing ? (33.33 / 60) * Math.PI * 2 : 0
    spin.current += (target - spin.current) * (1 - Math.exp(-dt * (playing ? 3 : 1.5)))
    if (disc.current) disc.current.rotation.y -= spin.current * dt

    // tonearm: to play, swing over the record and then lower; to stop, lift
    // first and then swing home
    const a = arm.current
    const ease = (v: number, to: number, rate: number) => v + (to - v) * (1 - Math.exp(-dt * rate))
    if (playing) {
      a.yaw = ease(a.yaw, ARM.play, 5)
      if (Math.abs(a.yaw - ARM.play) < 0.03) a.pitch = ease(a.pitch, ARM.down, 7)
    } else {
      a.pitch = ease(a.pitch, ARM.up, 8)
      if (a.pitch < ARM.up + 0.03) a.yaw = ease(a.yaw, 0, 5)
    }
    if (swing.current) swing.current.rotation.y = a.yaw
    if (tilt.current) tilt.current.rotation.x = a.pitch
  })

  const box = (pos: Vec3, size: Vec3, color: string, rest: ThreeElements['mesh'] = {}) => (
    <mesh position={pos} castShadow receiveShadow {...rest}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  )
  const T = 0.016 // stand panel thickness
  return (
    <group position={at}>
      {/* tapered legs */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * (SW / 2 - 0.03), LEG / 2, sz * (SD / 2 - 0.03)]} castShadow>
          <cylinderGeometry args={[0.009, 0.006, LEG, 10]} />
          <meshStandardMaterial color="#5A4130" roughness={0.6} />
        </mesh>
      ))}
      {/* open-fronted box: top, bottom, sides, back */}
      {box([0, top - T / 2, 0], [SW, T, SD], walnut)}
      {box([0, LEG + T / 2, 0], [SW, T, SD], walnut)}
      {box([-SW / 2 + T / 2, LEG + BOX / 2, 0], [T, BOX, SD], walnut)}
      {box([SW / 2 - T / 2, LEG + BOX / 2, 0], [T, BOX, SD], walnut)}
      {box([0, LEG + BOX / 2, -SD / 2 + T / 2], [SW, BOX, T], walnut)}
      {/* LPs standing in a row, spines out */}
      {sleeves.map((c, i) => (
        <mesh key={i} position={[-SW / 2 + T + 0.02 + i * 0.032, LEG + T + 0.058, 0.005]} rotation={[0, 0, ((i % 3) - 1) * 0.04]} castShadow>
          <boxGeometry args={[0.012, 0.115, SD - 0.05]} />
          <meshStandardMaterial color={c} roughness={0.85} />
        </mesh>
      ))}

      {/* turntable */}
      <group position={[0, top, 0]}>
        {box([0, PH / 2, 0], [PW, PH, PD], '#C9A27A')}
        {box([0, PH + 0.0015, 0], [PW - 0.012, 0.003, PD - 0.012], '#2B2F38')}
        {/* little feet showing under the plinth edge */}
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
          <mesh key={`f${sx}${sz}`} position={[sx * (PW / 2 - 0.02), 0.003, sz * (PD / 2 - 0.02)]}>
            <cylinderGeometry args={[0.012, 0.012, 0.006, 12]} />
            <meshStandardMaterial color="#1F2229" />
          </mesh>
        ))}
        {/* platter and the spinning record */}
        <mesh position={[P[0], PH + 0.009, P[1]]} castShadow>
          <cylinderGeometry args={[0.088, 0.088, 0.012, 40]} />
          <meshStandardMaterial color="#8A8F99" roughness={0.35} metalness={0.6} />
        </mesh>
        <mesh ref={disc} position={[P[0], PH + 0.0165, P[1]]}>
          <cylinderGeometry args={[0.082, 0.082, 0.003, 48]} />
          <meshStandardMaterial attach="material-0" color="#121419" roughness={0.4} />
          <meshStandardMaterial attach="material-1" map={recordMap} roughness={0.35} />
          <meshStandardMaterial attach="material-2" color="#121419" roughness={0.4} />
        </mesh>
        {/* start button and speed knob, front right */}
        <mesh position={[0.1, PH + 0.004, 0.075]}>
          <cylinderGeometry args={[0.011, 0.011, 0.006, 16]} />
          <meshStandardMaterial color="#C9CCD1" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0.06, PH + 0.0035, 0.085]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.004, 12]} />
          <meshStandardMaterial color="#4A3A20" emissive={C.sun} emissiveIntensity={playing ? 2 : 0} toneMapped={false} />
        </mesh>
        {/* tonearm: pivot post, arm rest, then the arm itself */}
        <mesh position={[ARM.pivot[0], PH + 0.015, ARM.pivot[1]]} castShadow>
          <cylinderGeometry args={[0.013, 0.015, 0.03, 16]} />
          <meshStandardMaterial color="#C9CCD1" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[ARM.pivot[0], PH + 0.0197, ARM.pivot[1] + ARM.length - 0.02]}>
          <cylinderGeometry args={[0.003, 0.003, 0.0395, 8]} />
          <meshStandardMaterial color="#C9CCD1" metalness={0.5} roughness={0.3} />
        </mesh>
        <group ref={swing} position={[ARM.pivot[0], PH + 0.03, ARM.pivot[1]]}>
          <group ref={tilt}>
            {/* tube */}
            <mesh position={[0, 0, ARM.length / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.0035, 0.0035, ARM.length, 10]} />
              <meshStandardMaterial color="#D8DBE0" metalness={0.6} roughness={0.25} />
            </mesh>
            {/* counterweight */}
            <mesh position={[0, 0, -0.028]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.011, 0.011, 0.024, 16]} />
              <meshStandardMaterial color="#2B2F38" metalness={0.4} roughness={0.4} />
            </mesh>
            {/* headshell with the cartridge */}
            <mesh position={[0, -0.006, ARM.length + 0.006]} castShadow>
              <boxGeometry args={[0.014, 0.01, 0.026]} />
              <meshStandardMaterial color="#1F2229" roughness={0.5} />
            </mesh>
          </group>
        </group>
      </group>

      {/* near-black notes at night: cream got lost against the lamp-lit floor */}
      <MusicNotes playing={playing} color={phase === 'night' ? '#14161C' : C.ink} origin={[P[0], deck + 0.05, P[1]]} />
    </group>
  )
}
