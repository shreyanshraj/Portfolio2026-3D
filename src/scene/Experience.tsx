import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Room, ANCHORS, R, H, useReducedMotion } from './Room'
import { Lighting } from './Lighting'
import { isObjectId } from '../content'
import type { ObjectId } from '../content'
import type { Phase } from '../clock'

export type View = 'room' | 'projects'
type Size = { width: number; height: number }

const ISO = new THREE.Vector3(1, 0.816, 1).normalize()
const BOX = new THREE.Box3(new THREE.Vector3(-0.05, -0.18, -0.05), new THREE.Vector3(R, H, R))
// Fits the room to the viewport, and eases toward the laptop in project view.
function CameraRig({ view, narrow }: { view: View; narrow: boolean }) {
  const { camera, size } = useThree()
  const reduce = useReducedMotion()
  // right/up are filled in by the layout effect, before the first frame
  const fit = useRef<{ zoom: number; center: THREE.Vector3; right?: THREE.Vector3; up?: THREE.Vector3 }>({ zoom: 100, center: new THREE.Vector3(1.2, 0.5, 1.2) })
  const snapped = useRef(false)

  useLayoutEffect(() => {
    camera.position.copy(fit.current.center).addScaledVector(ISO, 20)
    camera.lookAt(fit.current.center)
    camera.updateMatrixWorld()
    // measure the room in camera space at zoom 1
    const inv = camera.matrixWorldInverse
    const pts: THREE.Vector3[] = []
    for (const x of [BOX.min.x, BOX.max.x]) for (const y of [BOX.min.y, BOX.max.y]) for (const z of [BOX.min.z, BOX.max.z]) pts.push(new THREE.Vector3(x, y, z).applyMatrix4(inv))
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
    const w = Math.max(...xs) - Math.min(...xs)
    const h = Math.max(...ys) - Math.min(...ys)
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2
    const availH = size.height - (narrow ? 150 : 140)
    const zoom = Math.min((size.width * (narrow ? 0.96 : 0.86)) / w, availH / h)
    // shift the look-at point so the room's projected centre lands mid-screen
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    const center = new THREE.Vector3(1.2, 0.5, 1.2).addScaledVector(right, cx).addScaledVector(up, cy - 6 / zoom)
    fit.current = { zoom, center, right, up }
    snapped.current = false // a resize re-frames instantly instead of drifting
  }, [size.width, size.height, narrow, camera])

  const look = useRef(new THREE.Vector3(1.2, 0.5, 1.2))
  useFrame((_, dt) => {
    const f = fit.current
    let target = f.center
    let zoom = f.zoom
    if (view === 'projects') {
      zoom = f.zoom * (narrow ? 2.4 : 2.8)
      const a = new THREE.Vector3(...ANCHORS.laptop)
      // laptop sits left of centre on desktop, high on a phone, leaving room for the panel
      // `!`: set by the layout effect above, which runs before any frame
      target = narrow
        ? a.addScaledVector(f.up!, -(size.height * 0.22) / zoom)
        : a.addScaledVector(f.right!, (size.width * 0.22) / zoom)
    }
    // First frame (and every resize): jump straight to the framing. Easing in
    // from a placeholder zoom is what made the wall edges crawl on load.
    const k = reduce || !snapped.current ? 1 : 1 - Math.exp(-dt * 3.2)
    snapped.current = true
    look.current.lerp(target, k)
    camera.zoom += (zoom - camera.zoom) * k
    camera.position.copy(look.current).addScaledVector(ISO, 20)
    camera.lookAt(look.current)
    camera.updateProjectionMatrix()
  })
  return null
}

const EDGE = 24 // px kept clear around speech bubbles
const HEADER_SAFE = 96 // px below the top edge, clear of the header buttons
const GAP = 40 // px between an object's anchor point and its bubble
const CLEAR = 56 // px above and below an anchor point treated as the object itself

// Positions a speech bubble beside the object at screen point (x, y). It goes
// on its preferred side (.side-right / .side-left), kept fully on screen: clear
// of the header buttons and EDGE pixels from every side. If keeping it on
// screen would push it over the object, it tries the other side. The corner
// nearest the object is the pointed one (data-tail, styled in styles.css).
function placeBubble(bubble: HTMLElement, x: number, y: number, size: Size) {
  const w = bubble.offsetWidth, h = bubble.offsetHeight
  const place = (side: 'left' | 'right') => {
    const left = Math.min(Math.max(side === 'right' ? x + GAP : x - GAP - w, EDGE), size.width - w - EDGE)
    const top = Math.min(Math.max(y - h * 0.7, HEADER_SAFE), size.height - h - EDGE)
    // how far the bubble was pushed onto the object: into the GAP beside the
    // anchor point, within CLEAR of it vertically (0 when placed normally)
    const ox = Math.max(0, Math.min(left + w, x + GAP - 0.5) - Math.max(left, x - GAP + 0.5))
    const oy = Math.max(0, Math.min(top + h, y + CLEAR) - Math.max(top, y - CLEAR))
    return { left, top, cover: ox * oy }
  }
  const preferred = bubble.classList.contains('side-left') ? 'left' : 'right'
  const first = place(preferred)
  const other = first.cover > 0 ? place(preferred === 'right' ? 'left' : 'right') : first
  const { left, top } = other.cover < first.cover ? other : first
  bubble.style.transform = `translate(${(left - x).toFixed(1)}px, ${(top - y).toFixed(1)}px)`

  const across = x <= left ? 'left' : x >= left + w ? 'right' : null
  const tail = across ? `${y < top + h / 2 ? 'top' : 'bottom'}-${across}` : 'none'
  if (bubble.dataset.tail !== tail) bubble.dataset.tail = tail
}

// Projects each anchor to screen space every frame and moves the DOM overlay
// elements (hotspot buttons, the speech bubble) that carry a matching data-anchor.
// The element list is cached and only refreshed when the overlay's DOM changes.
function OverlayTracker({ overlayRef }: { overlayRef: RefObject<HTMLDivElement | null> }) {
  const { camera, size } = useThree()
  const v = useRef(new THREE.Vector3())
  const els = useRef<HTMLElement[]>([])
  useEffect(() => {
    const root = overlayRef.current
    if (!root) return
    const refresh = () => (els.current = [...root.querySelectorAll<HTMLElement>('[data-anchor]')])
    refresh()
    const mo = new MutationObserver(refresh)
    mo.observe(root, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [overlayRef])
  useFrame(() => {
    for (const el of els.current) {
      const id = el.dataset.anchor
      const a = isObjectId(id) ? ANCHORS[id] : undefined
      if (!a) continue
      v.current.set(a[0], a[1], a[2]).project(camera)
      const x = ((v.current.x + 1) / 2) * size.width
      const y = ((1 - v.current.y) / 2) * size.height
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      const bubble = el.querySelector<HTMLElement>('.bubble-anchor')
      if (bubble) placeBubble(bubble, x, y, size)
    }
  })
  return null
}

// Phones and machines with few CPU cores get a lower pixel ratio and a smaller
// shadow map: the room looks nearly the same and the device stays cool.
const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4

interface ExperienceProps {
  view: View
  picked: ObjectId | null
  onPick: (id: ObjectId) => void
  onClose: () => void
  backdropRef: RefObject<HTMLDivElement | null>
  overlayRef: RefObject<HTMLDivElement | null>
  narrow: boolean
  phase: Phase
  instant: boolean
  windowOpen: boolean | null
}

export default function Experience({ view, picked, onPick, onClose, backdropRef, overlayRef, narrow, phase, instant, windowOpen }: ExperienceProps) {
  const [hovered, setHovered] = useState<ObjectId | null>(null)
  const doorOpen = picked === 'door'
  // decided once: three.js doesn't resize an existing shadow map
  const [lowPower] = useState(() => narrow || fewCores)
  useEffect(
    () => () => {
      document.body.style.cursor = ''
    },
    []
  )
  return (
    <Canvas
      shadows
      orthographic
      dpr={[1, lowPower ? 1.5 : 2]}
      camera={{ position: [21, 17, 21], zoom: 100, near: 0.1, far: 100 }}
      gl={{ antialias: true, toneMapping: THREE.NeutralToneMapping }}
      onPointerMissed={() => picked && onClose()}
    >
      <CameraRig view={view} narrow={narrow} />
      <Lighting phase={phase} picked={view === 'room' ? picked : null} backdropRef={backdropRef} instant={instant} lowPower={lowPower} />
      <Suspense fallback={null}>
        <Room picked={picked} hovered={hovered} setHovered={setHovered} onPick={onPick} doorOpen={doorOpen} phase={phase} windowOpen={windowOpen} />
      </Suspense>
      <OverlayTracker overlayRef={overlayRef} />
    </Canvas>
  )
}
