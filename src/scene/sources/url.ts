import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { ModelSource } from './types'

// Normal build: models are static files in public/models.
const loader = new GLTFLoader()
export const getModel: ModelSource['getModel'] = (name) => loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`)
export const getVideoUrl: ModelSource['getVideoUrl'] = async (name) => `${import.meta.env.BASE_URL}media/${name}.mp4`
