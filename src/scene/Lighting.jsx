import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { C } from './palette'
import { DOOR, ANCHORS, LAMP, useReducedMotion, windowView, doorView } from './Room'
import { DIM, PRESETS, GLOW, LIGHTS } from './timeOfDay'
import { tvScreen, laptopScreen } from './Decor'

const DURATION = 2.4 // seconds for the opening light-up
const MOOD_CHANGE = 4 // seconds to cross-fade if the clock ticks into a new mood
const ease = (t) => t * t * (3 - 2 * t)
const DOOR_TOP = new THREE.Vector3((DOOR.x0 + DOOR.x1) / 2, DOOR.y1, 0)

// Preset values as THREE objects, so blending allocates nothing per frame.
function toLive(p) {
  return {
    ...p,
    bg: new THREE.Color(p.bg), sky: new THREE.Color(p.sky), ground: new THREE.Color(p.ground),
    sun: new THREE.Color(p.sun), beamColor: new THREE.Color(p.beamColor), outside: new THREE.Color(p.outside),
    target: p.target.clone(),
  }
}
const NUMS = ['hemi', 'fill', 'sunInt', 'beam', 'lamp', 'screen', 'tv', 'desk', 'bias', 'shelf']
const COLS = ['bg', 'sky', 'ground', 'sun', 'beamColor', 'outside']
const cloneLive = (l) => ({ ...l, ...Object.fromEntries(COLS.map((k) => [k, l[k].clone()])), target: l.target.clone() })
function mix(out, a, b, t) {
  for (const k of NUMS) out[k] = a[k] + (b[k] - a[k]) * t
  for (const k of COLS) out[k].copy(a[k]).lerp(b[k], t)
  out.target.copy(a.target).lerp(b.target, t)
  return out
}

// The visible shaft of light: the door opening extruded along the light's
// direction down to the floor, drawn additively so it reads as haze.
// Its vertices follow the light every frame (12 vertices, negligible cost).
function useBeam() {
  return useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(36), 3))
    g.setAttribute('alpha', new THREE.Float32BufferAttribute([1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0], 1))
    const a = new THREE.Vector3(DOOR.x0 + 0.03, DOOR.y1 - 0.02, 0)
    const b = new THREE.Vector3(DOOR.x1 - 0.03, DOOR.y1 - 0.02, 0)
    const c = new THREE.Vector3(DOOR.x1 - 0.03, 0, 0)
    const d = new THREE.Vector3(DOOR.x0 + 0.03, 0, 0)
    const a2 = new THREE.Vector3(), b2 = new THREE.Vector3()
    const update = (dir) => {
      a2.copy(a).addScaledVector(dir, -a.y / dir.y)
      b2.copy(b).addScaledVector(dir, -b.y / dir.y)
      const tris = [a, b, b2, a, b2, a2, d, a, a2, c, b, b2]
      const pos = g.attributes.position
      tris.forEach((p, i) => pos.setXYZ(i, p.x, p.y, p.z))
      pos.needsUpdate = true
      g.computeBoundingSphere()
    }
    return { geometry: g, update }
  }, [])
}

const beamMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  uniforms: { uColor: { value: new THREE.Color(C.sun) }, uOpacity: { value: 0 } },
  vertexShader: `attribute float alpha; varying float vA;
    void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying float vA;
    void main(){ gl_FragColor = vec4(uColor * uOpacity * (0.25 + 0.75*vA), 1.0); }`,
})

export function Lighting({ phase, picked, backdropRef, instant, lowPower }) {
  const reduce = useReducedMotion()
  const sun = useRef()
  const sunTarget = useMemo(() => new THREE.Object3D(), [])
  const hemi = useRef()
  const fill = useRef()
  const spot = useRef()
  const spotTarget = useMemo(() => new THREE.Object3D(), [])
  const lampLight = useRef()
  const screenLight = useRef()
  const tvLight = useRef()
  const biasLight = useRef()
  const shelfLight = useRef()
  const beam = useBeam()

  const dim = useMemo(() => toLive(DIM), [])
  const live = useMemo(() => toLive(PRESETS[phase]), []) // eslint-disable-line react-hooks/exhaustive-deps
  const from = useRef(toLive(PRESETS[phase]))
  const to = useRef(toLive(PRESETS[phase]))
  const blend = useRef(1)
  const mood = useMemo(() => toLive(PRESETS[phase]), []) // eslint-disable-line react-hooks/exhaustive-deps
  const intro = useRef(reduce || instant ? DURATION + 1 : -0.35)
  const dir = useMemo(() => new THREE.Vector3(), [])
  const onLight = useRef(null)

  // the clock moved into a new mood while the page was open: cross-fade to it
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    from.current = cloneLive(mood)
    to.current = toLive(PRESETS[phase])
    blend.current = reduce ? 1 : 0
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1)
    intro.current += step
    blend.current = Math.min(1, blend.current + step / MOOD_CHANGE)
    mix(mood, from.current, to.current, ease(blend.current))

    // opening: everything rises from DIM, the beam arrives a beat later
    const k = ease(THREE.MathUtils.clamp(intro.current / DURATION, 0, 1))
    const kb = ease(THREE.MathUtils.clamp((intro.current - DURATION * 0.45) / (DURATION * 0.55), 0, 1))
    mix(live, dim, mood, k)
    const pickDim = picked ? 0.72 : 1

    hemi.current.intensity = live.hemi * pickDim
    hemi.current.color.copy(live.sky)
    hemi.current.groundColor.copy(live.ground)
    fill.current.intensity = live.fill * pickDim

    // sun (or moon) always comes through the glass door
    dir.copy(mood.target).sub(DOOR_TOP).normalize()
    sun.current.position.copy(mood.target).addScaledVector(dir, -5)
    sunTarget.position.copy(mood.target)
    sun.current.intensity = mood.sunInt * kb
    sun.current.color.copy(mood.sun)
    beam.update(dir)
    beamMaterial.uniforms.uOpacity.value = mood.beam * kb * (picked ? 0.6 : 1)
    beamMaterial.uniforms.uColor.value.copy(mood.beamColor)

    // things that make their own light switch on during the opening
    lampLight.current.intensity = live.lamp
    // the screen only lights the room once the room itself is dark
    screenLight.current.intensity = Math.max(0, live.screen - 0.7) * 0.3
    tvLight.current.intensity = live.tv * 0.45
    for (const m of GLOW.lamp) m.emissiveIntensity = live.lamp * 0.45
    // track spots over the desk, and a soft glow on the wall behind the TV
    for (const l of LIGHTS.desk) l.intensity = live.desk
    for (const m of GLOW.desk) m.emissiveIntensity = 0.3 + live.desk * 0.35
    biasLight.current.intensity = live.bias
    shelfLight.current.intensity = live.shelf
    for (const m of GLOW.screen) m.emissiveIntensity = live.screen
    tvScreen.color.setScalar(0.35 + 0.65 * k) // pictures brighten with the room
    laptopScreen.color.setScalar(0.35 + 0.65 * k)

    windowView.color.copy(live.outside)
    doorView.color.copy(live.outside)

    const el = backdropRef.current
    if (el) {
      el.style.backgroundColor = `#${live.bg.getHexString()}`
      // header and hint switch to ink once the background is light enough
      const light = live.bg.r * 0.2126 + live.bg.g * 0.7152 + live.bg.b * 0.0722 > 0.35
      if (light !== onLight.current) {
        onLight.current = light
        el.dataset.light = light ? 'on' : 'off' // a data attribute React never overwrites
      }
    }

    // picked object gets its own warm pool of light
    const a = picked && ANCHORS[picked]
    if (a) {
      spotTarget.position.set(a[0], a[1] - 0.2, a[2])
      spot.current.position.set(a[0] + 0.9, a[1] + 1.6, a[2] + 0.9)
    }
    const want = a ? 9 : 0
    spot.current.intensity += (want - spot.current.intensity) * (reduce ? 1 : 1 - Math.exp(-dt * 8))
  })

  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={fill} position={[6, 8, 5]} color="#FFFFFF" />
      <primitive object={sunTarget} />
      <directionalLight
        ref={sun}
        target={sunTarget}
        castShadow
        shadow-mapSize={lowPower ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.1}
        shadow-camera-far={12}
      />
      {/* lamp, laptop and TV light: no shadows, so each costs only a few shader instructions */}
      <pointLight ref={lampLight} position={[LAMP[0], 0.78, LAMP[2]]} color="#F6C978" distance={2.2} decay={1.6} intensity={0} />
      <pointLight ref={screenLight} position={[0.42, 0.52, 1.47]} color="#9FB4C7" distance={0.8} decay={2} intensity={0} />
      <pointLight ref={tvLight} position={[1.15, 0.5, 0.4]} color="#8FA6D0" distance={1.4} decay={2} intensity={0} />
      <pointLight ref={biasLight} position={[1.16, 0.56, 0.035]} color="#FFD9A0" distance={0.55} decay={2} intensity={0} />
      {/* soft warm fill in the bookshelf corner, evening and night only */}
      <pointLight ref={shelfLight} position={[0.55, 0.95, 0.45]} color="#FFD9A8" distance={1.1} decay={1.4} intensity={0} />
      <primitive object={spotTarget} />
      <spotLight ref={spot} target={spotTarget} angle={0.32} penumbra={0.9} distance={5} decay={1.2} color={C.sun} intensity={0} />
      <mesh geometry={beam.geometry} material={beamMaterial} renderOrder={10} frustumCulled={false} />
    </>
  )
}
