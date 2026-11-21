import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Normal build: models are static files in public/models.
const loader = new GLTFLoader()
export const getModel = (name) => loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`)
export const getVideoUrl = async (name) => `${import.meta.env.BASE_URL}media/${name}.mp4`
