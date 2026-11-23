import { useMemo } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import { suspend, preload } from 'suspend-react'
import { getModel } from '@model-source'
import * as THREE from 'three'
import { BASE } from './palette'
import { GLOW } from './timeOfDay'

// Suspends until the named model is loaded; cached after the first call.
export const useModel = (name: ModelName) => suspend(() => getModel(name), ['model', name])

// Loads a Kenney model, recolours it into the palette and turns on shadows.
// Kenney models face +z with their footprint in x [0, w], z [-d, 0].
// `rot` turns the model about y; `at` places the min corner of its rotated
// footprint (x, z) at floor height y, which makes room layout readable.
// `glow` maps a material name to a GLOW group ('lamp' | 'screen' | 'tv' | 'desk')
// so the time of day can turn it up or down.
// `deform(geometry)` may reshape a copy of each mesh (used to raise the sofa back).
interface ModelProps extends Omit<ThreeElements['group'], 'scale'> {
  name: ModelName
  palette?: Record<string, string>
  emissive?: Record<string, string>
  glow?: Record<string, keyof typeof GLOW>
  deform?: (g: THREE.BufferGeometry) => void
  rot?: number
  at: [number, number, number]
  scale?: number
}

export function Model({ name, palette = {}, emissive = {}, glow = {}, deform, rot = 0, at, scale = 1, ...props }: ModelProps) {
  const { scene } = useModel(name)
  const atKey = at?.join(',')
  const object = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      if (deform) {
        o.geometry = o.geometry.clone()
        deform(o.geometry)
        o.geometry.computeBoundingBox()
        o.geometry.computeBoundingSphere()
      }
      // Kenney models have one unlit (basic) or standard material per mesh, never an array.
      const src = o.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial
      const color = palette[src.name] ?? BASE[src.name] ?? `#${src.color.getHexString()}`
      const material = new THREE.MeshStandardMaterial({
        name: src.name,
        color,
        roughness: 0.85,
        metalness: 0,
        emissive: emissive[src.name] ?? '#000000',
        emissiveIntensity: emissive[src.name] ? 0.6 : 1,
      })
      o.material = material
      if (glow[src.name]) GLOW[glow[src.name]].add(material)
      o.castShadow = true
      o.receiveShadow = true
    })
    const holder = new THREE.Group()
    holder.add(clone)
    clone.rotation.y = rot
    clone.scale.setScalar(scale)
    if (at) {
      const box = new THREE.Box3().setFromObject(holder)
      clone.position.set(at[0] - box.min.x, at[1] - box.min.y, at[2] - box.min.z)
    }
    return holder
    // palette/emissive/glow/deform are inline literals at every call site, so
    // listing them would rebuild the model on every render; `at` is compared by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, rot, scale, atKey])
  return <primitive object={object} {...props} />
}

export const MODELS = [
  'chairDesk', 'bookcaseOpen', 'books', 'loungeSofa', 'cabinetTelevision',
  'televisionModern', 'pottedPlant', 'plantSmall1', 'plantSmall2', 'plantSmall3', 'tableCoffee',
  'raj',
] as const
export type ModelName = (typeof MODELS)[number]
MODELS.forEach((m) => preload(() => getModel(m), ['model', m]))
