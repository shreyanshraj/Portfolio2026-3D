import { useEffect, useMemo, useRef } from 'react'
import type { Dispatch, ReactNode, Ref, SetStateAction } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeElements } from '@react-three/fiber'
import * as THREE from 'three'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Model, useModel } from './Model'
import { C } from './palette'
import { paintOutside, paintDoorView } from './timeOfDay'
import { Steam, ScreenVideo, tvScreen, Laptop, Poster, DigitalClock, Rug, FloorLamp, Gamepad, FlatBook, MedalCase, Desk, DeskTrackLight, RecordPlayer } from './Decor'
import { GLOW } from './timeOfDay'
import { POSTER_IMAGES } from '../content'
import type { ObjectId } from '../content'
import type { Phase } from '../clock'

type Vec3 = [number, number, number]
type GroupProps = ThreeElements['group']

// Room footprint: x runs along the right-hand wall (bookshelf, TV, door),
// z runs along the left-hand wall (window, desk). The back corner is the origin.
export const R = 2.4
const HALF = Math.PI / 2
const DESK_Y = 0.384
const RAJ_POS: Vec3 = [0.62, 0.23 + 0.034, 1.47] // 0.034 = lift from the chair's casters
const RAJ_SCALE = 0.56
const TORSO_STRETCH = 2.0
// floor lamp position (centre of its base); Lighting hangs a point light at its shade
export const LAMP: Vec3 = [2.28, 0, 1.7]
const WAINSCOT = 0.36
// Caster wheels under the desk chair. The chair is lifted by CASTER_H so its
// five legs rest on them. LEG_TIPS are the ends of the legs in room space
// (x, z), measured from the chair model; CHAIR_HUB is the centre of its star base.
const CASTER_H = 0.034
const CHAIR_HUB = [0.614, 1.467]
const LEG_TIPS = [[0.73, 1.383], [0.73, 1.552], [0.569, 1.6045], [0.47, 1.4675], [0.569, 1.3305]]
const TABLE_Y = 0.23 // coffee table top
const TABLE_Z = 0.48 // coffee table's edge nearest the TV; the books and plant follow it
const MUG_COLOR = '#E0A43A'
const MUG_REST: Vec3 = [0.2, DESK_Y, 1.83] // the mug's spot on the desk
const COFFEE_COLOR = '#4B2A16'
// the row of prints over the desk: one height, one size, evenly spaced along z
const DESK_ART: { y: number; size: [number, number]; z: number[] } = { y: 0.78, size: [0.24, 0.32], z: [1.36, 1.68, 2.0] }
// Kenney's sofa back is low; lift every vertex above the armrests (only the
// back cushion reaches that high) to make it taller.
// Lengthen the coffee table by sliding each end outward; the legs keep their
// thickness because the vertices move rather than scale.
const widenTable = (g: THREE.BufferGeometry) => {
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + (pos.getX(i) > -0.13 ? 0.11 : -0.11))
  pos.needsUpdate = true
}
const raiseSofaBack = (g: THREE.BufferGeometry) => {
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.4) pos.setY(i, pos.getY(i) + 0.12)
  pos.needsUpdate = true
}
// tops of the bookcase's shelf boards, measured from the model
const SHELVES = [0.13, 0.37, 0.61, 0.88]
// the TV's screen face, where the video plays
const TV: { at: Vec3; w: number; h: number } = { at: [1.161, 0.548, 0.141], w: 0.53, h: 0.28 }
const SAGE = '#AEB8A0'
export const H = 1.25
const T = 0.05
export const DOOR = { x0: 1.62, x1: 2.28, y1: 1.12 }
const WIN = { z0: 0.3, z1: 1.0, y0: 0.45, y1: 1.0 }
// how far the window sashes swing open (radians) for each time of day
const WINDOW_OPEN: Record<Phase, number> = { morning: 0.7, day: 0.9, evening: 0.3, night: 0 }

// World-space anchors for hotspots and speech bubbles.
export const ANCHORS: Record<ObjectId, Vec3> = {
  raj: [0.6, 0.74, 1.47],
  laptop: [0.13, 0.5, 1.47],
  coffee: [0.2, 0.45, 1.83],
  books: [0.28, 0.6, 0.12],
  tv: [1.15, 0.55, 0.1],
  door: [1.95, 0.62, 0.04],
  medals: [0.28, 0.97, 0.12],
  showPoster: [1.02, 0.94, 0.02],
  gamePoster: [1.3, 0.94, 0.02],
  window: [0.02, 0.74, 0.65],
  record: [0.97, 0.3, 2.2],
}

interface BoxProps extends Omit<ThreeElements['mesh'], 'from' | 'to'> {
  from: Vec3
  to: Vec3
  color?: string
  cast?: boolean
}

function Box({ from, to, color = C.plaster, cast = true, ...rest }: BoxProps) {
  // map keeps the tuple's length; TypeScript only knows it returns number[]
  const size = to.map((v, i) => v - from[i]) as Vec3
  const pos = to.map((v, i) => (v + from[i]) / 2) as Vec3
  return (
    <mesh position={pos} castShadow={cast} receiveShadow {...rest}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  )
}

// Invisible geometry that only blocks sunlight, so the sun reaches the room
// through the glass door and nowhere else.
function ShadowOnly({ from, to }: { from: Vec3; to: Vec3 }) {
  // map keeps the tuple's length; TypeScript only knows it returns number[]
  const size = to.map((v, i) => v - from[i]) as Vec3
  const pos = to.map((v, i) => (v + from[i]) / 2) as Vec3
  return (
    <mesh position={pos} castShadow>
      <boxGeometry args={size} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
    </mesh>
  )
}

// The window and the door each get their own view; Lighting tints both.
export const windowView = new THREE.MeshBasicMaterial({ toneMapped: false })
export const doorView = new THREE.MeshBasicMaterial({ toneMapped: false })

function paintInto(material: THREE.MeshBasicMaterial, paint: (phase: Phase, c: HTMLCanvasElement) => void, phase: Phase, w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  paint(phase, c)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  material.map?.dispose()
  material.map = t
  material.needsUpdate = true
}

function useOutsideViews(phase: Phase) {
  useMemo(() => {
    paintInto(windowView, paintOutside, phase, 256, 256)
    paintInto(doorView, paintDoorView, phase, 256, 416)
  }, [phase])
}

function Shell({ phase, windowOpen, p }: { phase: Phase; windowOpen: boolean | null; p: PickState }) {
  useOutsideViews(phase)
  return (
    <group>
      {/* floor slab and boards */}
      <Box from={[-T, -0.18, -T]} to={[R, 0, R]} color="#C9B497" cast={false} receiveShadow={false} />
      <mesh position={[(R - T) / 2, 0.0005, (R - T) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[R + T, R + T]} />
        <meshStandardMaterial color="#C9B497" roughness={0.95} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[R / 2, 0.0015, (i + 1) * (R / 10)]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[R, 0.006]} />
          <meshStandardMaterial color="#B9A385" roughness={1} />
        </mesh>
      ))}

      {/* left wall (x = 0) with the window */}
      <Box from={[-T, 0, -T]} to={[0, H, WIN.z0]} />
      <Box from={[-T, 0, WIN.z1]} to={[0, H, R]} />
      <Box from={[-T, 0, WIN.z0]} to={[0, WIN.y0, WIN.z1]} />
      <Box from={[-T, WIN.y1, WIN.z0]} to={[0, H, WIN.z1]} />
      <Box from={[-T, WIN.y0 - 0.02, WIN.z0 - 0.02]} to={[0.075, WIN.y0, WIN.z1 + 0.02]} color={C.paper} />
      <WindowDetail phase={phase} manual={windowOpen} p={p} />
      <mesh position={[-0.35, 0.44, 0.3]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.76, 0.64]} />
        <primitive object={windowView} attach="material" />
      </mesh>

      {/* right wall (z = 0) with the glass door */}
      <Box from={[-T, 0, -T]} to={[DOOR.x0, H, 0]} />
      <Box from={[DOOR.x1, 0, -T]} to={[R, H, 0]} />
      <Box from={[DOOR.x0, DOOR.y1, -T]} to={[DOOR.x1, H, 0]} />
      <mesh position={[1.6, 0.265, -0.35]}>
        <planeGeometry args={[0.76, 1.23]} />
        <primitive object={doorView} attach="material" />
      </mesh>

      {/* sage wainscot on the lower wall, capped with a paper-white rail */}
      <Box from={[0, 0.04, 0]} to={[0.006, WAINSCOT, R]} color={SAGE} cast={false} />
      <Box from={[0, 0.04, 0]} to={[DOOR.x0, WAINSCOT, 0.006]} color={SAGE} cast={false} />
      <Box from={[DOOR.x1, 0.04, 0]} to={[R, WAINSCOT, 0.006]} color={SAGE} cast={false} />
      <Box from={[0, WAINSCOT, 0]} to={[0.014, WAINSCOT + 0.014, R]} color={C.paper} cast={false} />
      <Box from={[0, WAINSCOT, 0]} to={[DOOR.x0, WAINSCOT + 0.014, 0.014]} color={C.paper} cast={false} />
      <Box from={[DOOR.x1, WAINSCOT, 0]} to={[R, WAINSCOT + 0.014, 0.014]} color={C.paper} cast={false} />

      {/* skirting */}
      <Box from={[0, 0, 0]} to={[0.012, 0.04, R]} color="#CFC6B3" cast={false} />
      <Box from={[0, 0, 0]} to={[DOOR.x0, 0.04, 0.012]} color="#CFC6B3" cast={false} />

      {/* sun blockers: ceiling and the two missing front walls */}
      <ShadowOnly from={[-1, H, -1]} to={[R + 1, H + 0.05, R + 1]} />
      <ShadowOnly from={[R, -0.2, -1]} to={[R + 0.05, H, R + 1]} />
      <ShadowOnly from={[-1, -0.2, R]} to={[R + 1, H, R + 0.05]} />
    </group>
  )
}

// The window in the left wall: lined reveal, painted casing and apron, a
// frame with two casement sashes (glass, a glazing bar each, a latch), and
// linen curtains on a rod. Everything is in room space on the x = 0 wall.
function WindowDetail({ phase, manual, p }: { phase: Phase; manual: boolean | null; p: PickState }) {
  const { z0, z1, y0, y1 } = WIN
  const white = '#F3F1EA'
  const frame = '#E9E6DE'
  const zm = (z0 + z1) / 2
  const GX = -0.026 // depth of the glass inside the wall
  const S = 0.022 // sash bar width
  const sash = (za: number, zb: number) => {
    const zc = (za + zb) / 2
    return (
      <>
        <Box from={[-0.009, y0, za]} to={[0.009, y1, za + S]} color={frame} />
        <Box from={[-0.009, y0, zb - S]} to={[0.009, y1, zb]} color={frame} />
        <Box from={[-0.009, y0, za]} to={[0.009, y0 + S * 1.3, zb]} color={frame} />
        <Box from={[-0.009, y1 - S, za]} to={[0.009, y1, zb]} color={frame} />
        <Box from={[-0.004, (y0 + y1) / 2 - 0.006, za]} to={[0.005, (y0 + y1) / 2 + 0.006, zb]} color={frame} cast={false} />
        <mesh position={[0, (y0 + y1) / 2, zc]} rotation={[0, Math.PI / 2, 0]} renderOrder={4}>
          <planeGeometry args={[zb - za - 2 * S, y1 - y0 - 2 * S]} />
          <meshStandardMaterial color="#DCEAF0" transparent opacity={0.14} roughness={0.05} metalness={0.1} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </>
    )
  }
  // How far the sashes swing out: open in the day, shut at night.
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  const reduce = useReducedMotion()
  useFrame((_, dt) => {
    // a visitor's click wins over the time of day until the mood next changes
    const auto = WINDOW_OPEN[phase] ?? 0
    const open = manual === null || manual === undefined ? auto : manual ? auto || WINDOW_OPEN.morning : 0
    const target = -open // negative swings out, away from the room
    const k = reduce ? 1 : 1 - Math.exp(-dt * 1.5)
    // `!`: both sash groups are mounted before the first frame
    const l = left.current!, r = right.current!
    l.rotation.y += (target - l.rotation.y) * k
    r.rotation.y = -l.rotation.y
  })
  const half = (z1 - z0) / 2 - 0.008
  // a curtain panel: a flat backing with soft vertical folds in front of it
  const curtain = (za: number, zb: number) => {
    const folds = 5
    const w = (zb - za) / folds
    const top = y1 + 0.06
    const bottom = WAINSCOT - 0.02
    return (
      <group key={za}>
        <Box from={[0.018, bottom, za]} to={[0.026, top, zb]} color="#E4DBCB" />
        {Array.from({ length: folds }, (_, i) => (
          <mesh key={i} castShadow receiveShadow position={[0.03, (top + bottom) / 2, za + w * (i + 0.5)]}>
            <cylinderGeometry args={[w * 0.55, w * 0.55, top - bottom, 10, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color="#EDE6D8" roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    )
  }
  return (
    <group>
      {/* lining boards inside the wall opening */}
      <Box from={[-T, y0, z0]} to={[0, y1, z0 + 0.008]} color={white} cast={false} />
      <Box from={[-T, y0, z1 - 0.008]} to={[0, y1, z1]} color={white} cast={false} />
      <Box from={[-T, y1 - 0.008, z0]} to={[0, y1, z1]} color={white} cast={false} />

      {/* the window frame and two sashes meeting in the middle */}
      <Box from={[GX - 0.012, y0, z0]} to={[GX + 0.012, y0 + 0.012, z1]} color={frame} />
      {/* left sash hinged at the back edge, right sash at the front edge; both
          swing outward. Clicking either one opens or closes the window. */}
      <Pickable id="window" {...p}>
        <group ref={left} position={[GX, 0, z0 + 0.008]}>
          {sash(0, half + 0.004)}
        </group>
        <group ref={right} position={[GX, 0, z1 - 0.008]}>
          {sash(-half - 0.004, 0)}
          {/* latch on the meeting stile */}
          <Box from={[0.009, (y0 + y1) / 2 - 0.03, -half - 0.004]} to={[0.017, (y0 + y1) / 2 + 0.01, -half + 0.004]} color="#9AA1AC" cast={false} />
        </group>
      </Pickable>

      {/* painted casing around the opening, and an apron under the sill */}
      <Box from={[0, y0 - 0.02, z0 - 0.035]} to={[0.01, y1 + 0.035, z0]} color={white} />
      <Box from={[0, y0 - 0.02, z1]} to={[0.01, y1 + 0.035, z1 + 0.035]} color={white} />
      <Box from={[0, y1, z0 - 0.035]} to={[0.012, y1 + 0.04, z1 + 0.035]} color={white} />
      <Box from={[0, y0 - 0.07, z0 - 0.01]} to={[0.01, y0 - 0.02, z1 + 0.01]} color={white} />

      {/* curtain rod with round finials, and a curtain drawn back on each side */}
      <mesh position={[0.04, y1 + 0.075, zm]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, z1 - z0 + 0.4, 10]} />
        <meshStandardMaterial color={C.ink} roughness={0.4} metalness={0.3} />
      </mesh>
      {[z0 - 0.2, z1 + 0.2].map((z) => (
        <mesh key={z} position={[0.04, y1 + 0.075, z]}>
          <sphereGeometry args={[0.011, 12, 10]} />
          <meshStandardMaterial color={C.ink} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      {/* drawn back just outside the casing, so they clear the sill and trim */}
      {curtain(z0 - 0.175, z0 - 0.04)}
      {curtain(z1 + 0.04, z1 + 0.175)}
    </group>
  )
}

// Five swivel casters, one under each leg tip, each wheel lined up with its leg.
function ChairCasters() {
  const r = 0.017
  return (
    <group>
      {LEG_TIPS.map(([x, z], i) => {
        const a = Math.atan2(z - CHAIR_HUB[1], x - CHAIR_HUB[0]) // leg direction
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, -a, 0]}>
            {/* fork holding the wheel, up to the leg */}
            <mesh position={[-0.008, CASTER_H - 0.006, 0]} castShadow>
              <boxGeometry args={[0.018, 0.012, 0.02]} />
              <meshStandardMaterial color="#2B2F38" roughness={0.6} />
            </mesh>
            {/* wheel: axle runs across the leg, so it rolls along it */}
            <mesh position={[0, r, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[r, r, 0.014, 16]} />
              <meshStandardMaterial color="#1D2026" roughness={0.7} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function GlassDoor({ open }: { open: boolean }) {
  const slide = useRef<THREE.Group>(null)
  const reduce = useReducedMotion()
  useFrame((_, dt) => {
    const target = open ? -0.3 : 0
    const k = reduce ? 1 : 1 - Math.exp(-dt * 5)
    const s = slide.current! // mounted before the first frame
    s.position.x += (target - s.position.x) * k
  })
  const w = (DOOR.x1 - DOOR.x0) / 2
  const frame = C.ink
  return (
    <group position={[DOOR.x0, 0, -0.012]}>
      <Box from={[0, 0, -0.02]} to={[0.025, DOOR.y1, 0.02]} color={frame} />
      <Box from={[DOOR.x1 - DOOR.x0 - 0.025, 0, -0.02]} to={[DOOR.x1 - DOOR.x0, DOOR.y1, 0.02]} color={frame} />
      <Box from={[0, DOOR.y1 - 0.025, -0.02]} to={[DOOR.x1 - DOOR.x0, DOOR.y1, 0.02]} color={frame} />
      <Box from={[0, 0, -0.02]} to={[DOOR.x1 - DOOR.x0, 0.022, 0.02]} color={frame} />
      {/* fixed panel */}
      <group position={[0, 0, -0.01]}>
        <Box from={[w - 0.012, 0, -0.008]} to={[w + 0.012, DOOR.y1, 0.008]} color={frame} />
        <mesh position={[w / 2, DOOR.y1 / 2, 0]}>
          <planeGeometry args={[w, DOOR.y1]} />
          <meshStandardMaterial color="#DCEAF0" transparent opacity={0.18} roughness={0.1} depthWrite={false} />
        </mesh>
      </group>
      {/* sliding panel */}
      <group ref={slide} position={[0, 0, 0.012]}>
        <group position={[w, 0, 0]}>
          <Box from={[0, 0, -0.008]} to={[0.02, DOOR.y1, 0.008]} color={frame} cast={false} />
          <Box from={[w - 0.02, 0, -0.008]} to={[w, DOOR.y1, 0.008]} color={frame} cast={false} />
          <Box from={[0.04, 0.5, 0.008]} to={[0.05, 0.62, 0.02]} color={C.paper} cast={false} />
          <mesh position={[w / 2, DOOR.y1 / 2, 0]}>
            <planeGeometry args={[w, DOOR.y1]} />
            <meshStandardMaterial color="#DCEAF0" transparent opacity={0.22} roughness={0.1} depthWrite={false} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

// A glazed mug. Its handle points along +x, so turn the mug to show it.
function Mug({ ref, color = MUG_COLOR, ...props }: { ref?: Ref<THREE.Group>; color?: string } & GroupProps) {
  return (
    <group ref={ref} {...props}>
      <mesh castShadow receiveShadow position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.022, 0.02, 0.06, 24]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      {/* cream rim and the coffee, laid just above the mug's top so the
          mustard cap underneath can't show through */}
      <mesh position={[0, 0.0606, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.0185, 0.022, 24]} />
        <meshStandardMaterial color="#F3EEE2" />
      </mesh>
      <mesh position={[0, 0.0604, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.0186, 24]} />
        <meshStandardMaterial color={COFFEE_COLOR} roughness={0.25} />
      </mesh>
      <mesh castShadow position={[0.026, 0.032, 0]}>
        <torusGeometry args={[0.013, 0.0045, 10, 20]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
    </group>
  )
}

function Xbox(props: GroupProps) {
  return (
    <group {...props}>
      <mesh castShadow receiveShadow position={[0, 0.075, 0]}>
        <boxGeometry args={[0.07, 0.15, 0.07]} />
        <meshStandardMaterial color="#20222B" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.151, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.024, 24]} />
        <meshStandardMaterial color="#14161C" emissive={C.saguaro} emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

function Raj(props: GroupProps) {
  const { scene, animations } = useModel('raj')
  const clone = useMemo(() => {
    const c = SkeletonUtils.clone(scene)
    c.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true
        o.receiveShadow = true
        if (o.material) {
          // raj.glb has one standard material per mesh
          const m = (o.material as THREE.MeshStandardMaterial).clone()
          o.material = m
          m.roughness = 0.9
          m.metalness = 0
        }
      }
    })
    return c
  }, [scene])
  const mixer = useMemo(() => new THREE.AnimationMixer(clone), [clone])
  useEffect(() => {
    const clip = THREE.AnimationClip.findByName(animations, 'sit') ?? THREE.AnimationClip.findByName(animations, 'idle')
    clip && mixer.clipAction(clip).reset().play()
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(clone)
    }
  }, [mixer, animations, clone])

  // Hidden meshes still catch pointer rays in three.js, so while Raj is hidden
  // (logged off at night) let clicks pass through him to the chair and laptop.
  const hidden = props.visible === false
  useEffect(() => {
    clone.traverse((o) => {
      if (o instanceof THREE.Mesh) o.raycast = hidden ? () => {} : THREE.Mesh.prototype.raycast
    })
  }, [clone, hidden])

  // Taller, not bigger: the Kenney figure is short and stocky, so stretch the
  // torso upward and undo that stretch on the head and arms. The sit clip
  // keys every bone at scale 1, so we set absolute values after the mixer runs
  // (multiplying would compound, since the mixer skips unchanged values).
  const bones = useMemo(
    () => ({ torso: clone.getObjectByName('torso'), head: clone.getObjectByName('head'), arms: ['arm-left', 'arm-right'].map((n) => clone.getObjectByName(n)) }),
    [clone]
  )
  useFrame((_, dt) => {
    mixer.update(dt)
    const { torso, head, arms } = bones
    if (!torso) return
    torso.scale.y = TORSO_STRETCH
    // `!`: raj.glb has all of these bones whenever it has a torso
    head!.scale.y = 1 / TORSO_STRETCH
    for (const a of arms) a!.scale.y = 1 / Math.sqrt(TORSO_STRETCH) // arms get a little longer, not stretched as far
  })

  return (
    <group {...props}>
      <primitive object={clone} />
    </group>
  )
}

export function useReducedMotion() {
  return useMemo(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
      return false
    }
  }, [])
}

// Hover and pick state, passed through to every Pickable.
interface PickState {
  picked: ObjectId | null
  hovered: ObjectId | null
  setHovered: Dispatch<SetStateAction<ObjectId | null>>
  onPick: (id: ObjectId) => void
}

// Each clickable object. Glows gold on hover, brighter when picked.
function Pickable({ id, picked, hovered, setHovered, onPick, children }: PickState & { id: ObjectId; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  const mats = useRef<THREE.MeshStandardMaterial[]>([])
  useEffect(() => {
    const list: THREE.MeshStandardMaterial[] = []
    // `!`: effects run after mount, when the group is set
    ref.current!.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m instanceof THREE.MeshStandardMaterial) list.push(m)
      }
    })
    mats.current = list
  }, [])
  const gold = useMemo(() => new THREE.Color(C.sun), [])
  const amt = useRef(0)
  const saved = useRef<[THREE.Color, number][] | null>(null)
  useFrame((_, dt) => {
    const target = picked === id ? 0.28 : hovered === id ? 0.18 : 0
    amt.current += (target - amt.current) * (1 - Math.exp(-dt * 10))
    const active = amt.current > 0.002
    if (active) {
      // remember each material's own glow (lamp, screen) so we can hand it back
      const own = (saved.current ??= mats.current.map((m) => [m.emissive.clone(), m.emissiveIntensity]))
      mats.current.forEach((m, i) => {
        m.emissive.copy(own[i][0]).lerp(gold, Math.min(1, amt.current * 6))
        m.emissiveIntensity = Math.max(own[i][1] * (1 - amt.current * 3), amt.current)
      })
    } else if (saved.current) {
      const own = saved.current
      mats.current.forEach((m, i) => {
        m.emissive.copy(own[i][0])
        m.emissiveIntensity = own[i][1]
      })
      saved.current = null
    }
  })
  return (
    <group
      ref={ref}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(id)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered((h) => (h === id ? null : h))
        document.body.style.cursor = ''
      }}
      onClick={(e) => {
        e.stopPropagation()
        onPick(id)
      }}
    >
      {children}
    </group>
  )
}

interface RoomProps extends PickState {
  doorOpen: boolean
  phase: Phase
  windowOpen: boolean | null
  musicOn: boolean
}

export function Room({ picked, hovered, setHovered, onPick, doorOpen, phase, windowOpen, musicOn }: RoomProps) {
  const p: PickState = { picked, hovered, setHovered, onPick }
  return (
    <group>
      <Shell phase={phase} windowOpen={windowOpen} p={p} />
      <GlassDoor open={doorOpen} />
      <Pickable id="door" {...p}>
        <mesh position={[(DOOR.x0 + DOOR.x1) / 2, DOOR.y1 / 2, 0.01]} visible={false}>
          <planeGeometry args={[DOOR.x1 - DOOR.x0, DOOR.y1]} />
        </mesh>
      </Pickable>

      {/* left wall: the desk corner */}
      <Model name="plantSmall2" at={[0.0, WIN.y0, 0.72]} />
      <Desk z0={1.2} length={0.73} depth={0.4} height={DESK_Y} />
      <Pickable id="laptop" {...p}>
        <Laptop position={[0.17, DESK_Y, 1.47]} rotation={[0, HALF, 0]} asleep={phase === 'night'} />
      </Pickable>
      <Pickable id="coffee" {...p}>
        <Mug position={MUG_REST} rotation={[0, 0.5, 0]} scale={1.6} />
      </Pickable>
      <Steam position={[MUG_REST[0], DESK_Y + 0.09, MUG_REST[2]]} />
      <Model name="plantSmall3" at={[0.04, DESK_Y, 1.22]} />
      {/* track light high on the wall, two spots aimed at the laptop and the mug */}
      <DeskTrackLight
        z0={1.28}
        z1={2.04}
        spots={[
          { z: 1.38, target: [0.2, DESK_Y, 1.47] },
          { z: 1.95, target: [0.22, DESK_Y, 1.76] },
        ]}
      />
      {/* Raj works at the desk by day and has logged off at night. The chair is
          part of his clickable area, so his bubble still opens from the empty chair. */}
      <Pickable id="raj" {...p}>
        <Model name="chairDesk" rot={-HALF} at={[0.46, CASTER_H, 1.3]} palette={{ carpet: C.predawn }} />
        <ChairCasters />
        <Raj position={RAJ_POS} rotation={[0, -HALF, 0]} scale={RAJ_SCALE} visible={phase !== 'night'} />
      </Pickable>
      {/* three prints in a row over the desk, the clock centred above the middle one */}
      <Poster art="sun" facing="x" at={[0.002, DESK_ART.y, DESK_ART.z[0]]} size={DESK_ART.size} frame="#8E7356" />
      <Poster art="saguaro" facing="x" at={[0.002, DESK_ART.y, DESK_ART.z[1]]} size={DESK_ART.size} frame={C.ink} />
      <Poster art="contours" facing="x" at={[0.002, DESK_ART.y, DESK_ART.z[2]]} size={DESK_ART.size} frame="#8E7356" />
      <DigitalClock at={[0.002, DESK_ART.y + DESK_ART.size[1] / 2 + 0.11, DESK_ART.z[1]]} facing="x" />
      <Model name="pottedPlant" at={[0.03, 0, 2.03]} />
      {/* a record player on a low stand along the front edge, between the plant
          by the desk and the front plants: click it to play or stop the music */}
      <Pickable id="record" {...p}>
        <RecordPlayer at={[1.0, 0, 2.2]} playing={musicOn} phase={phase} />
      </Pickable>

      {/* right wall: shelf, TV, Xbox */}
      <Pickable id="books" {...p}>
        <Model name="bookcaseOpen" at={[0.08, 0, 0]} />
        <Model name="books" at={[0.1, SHELVES[0], 0.08]} palette={{ carpetDarker: C.ink, carpetWhite: '#C9A24A' }} />
        <Model name="books" at={[0.27, SHELVES[0], 0.08]} palette={{ carpetDarker: '#B5684B' }} />
        <Model name="books" at={[0.11, SHELVES[1], 0.08]} palette={{ carpetDarker: C.saguaro, carpetWhite: C.plaster }} />
        <Model name="plantSmall2" at={[0.33, SHELVES[1], 0.09]} />
        <Model name="plantSmall3" at={[0.12, SHELVES[2], 0.09]} />
        <Model name="books" at={[0.26, SHELVES[2], 0.08]} palette={{ carpetDarker: '#7C8DA6' }} />
        <Model name="plantSmall1" at={[0.35, SHELVES[3], 0.15]} />
      </Pickable>
      {/* race medals in a glass-fronted case on top of the bookshelf, beside the plant */}
      <Pickable id="medals" {...p}>
        <MedalCase
          size={[0.19, 0.15, 0.045]}
          position={[0.28, SHELVES[3], 0.06]} // centred on the shelf (x 0.08 to 0.48)
          medals={[
            { metal: '#D4A537', ribbon: ['#2E3550', '#F2C14E'], length: 0.06 },
            { metal: '#C3C8CF', ribbon: ['#5E7A5A', '#F7F8F5'], length: 0.075 },
            { metal: '#B07A4A', ribbon: ['#B5684B', '#2E3550'], length: 0.065 },
          ]}
        />
      </Pickable>
      <Pickable id="tv" {...p}>
        <Model name="cabinetTelevision" at={[0.72, 0, 0]} palette={{ wood: '#ECE7DC' }} />
        <Model name="televisionModern" scale={0.85} at={[0.87, 0.31, 0.06]} palette={{ metalDark: '#1D2238' }} />
        <ScreenVideo clip="tv-loop" material={tvScreen} width={TV.w} height={TV.h} position={TV.at} />
        <Xbox position={[0.79, 0.31, 0.12]} />
        <Gamepad position={[1.43, 0.31, 0.2]} rotation={[0, -0.5, 0]} color="#1E2128" />
      </Pickable>
      {/* the media wall: a show and a game above the TV, a 24-hour clock over the door */}
      <Pickable id="showPoster" {...p}>
        <Poster art="kitchen" src={POSTER_IMAGES.show} facing="z" at={[1.02, 0.94, 0.002]} size={[0.22, 0.3]} frame={C.ink} />
      </Pickable>
      <Pickable id="gamePoster" {...p}>
        <Poster art="controller" src={POSTER_IMAGES.game} facing="z" at={[1.3, 0.94, 0.002]} size={[0.22, 0.3]} frame={C.ink} />
      </Pickable>

      {/* doormat inside the glass door */}
      <mesh receiveShadow position={[1.94, 0.003, 0.11]}>
        <boxGeometry args={[0.36, 0.006, 0.16]} />
        <meshStandardMaterial color="#8E7356" roughness={1} />
      </mesh>

      {/* lounge */}
      <Rug size={[1.65, 0.97]} at={[0.52, 0, 0.28]} />
      <Model name="tableCoffee" at={[0.83, 0, TABLE_Z]} deform={widenTable} />
      {/* on the coffee table: two books lying flat and a plant */}
      <FlatBook position={[1.05, TABLE_Y, TABLE_Z + 0.2]} rotation={[0, 0.25, 0]} cover="#B5684B" />
      <FlatBook position={[1.22, TABLE_Y, TABLE_Z + 0.18]} rotation={[0, -0.15, 0]} cover={C.saguaro} size={[0.11, 0.018, 0.15]} />
      <Model name="plantSmall3" scale={1.7} at={[1.5, TABLE_Y, TABLE_Z + 0.06]} />
      <Model name="loungeSofa" rot={Math.PI} at={[0.9, 0, 1.12]} deform={raiseSofaBack} />
      <FloorLamp at={LAMP} glowSet={GLOW.lamp} />
      <Model name="pottedPlant" at={[2.12, 0, 2.06]} />
      <Model name="pottedPlant" at={[1.82, 0, 2.12]} />
    </group>
  )
}
