import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import models from './inline.generated.js'
import media from './inline-media.generated.js'

// Inline build: models and the TV clip ship inside the JS bundle as base64.
const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
const loader = new GLTFLoader()
export const getModel = (name) => loader.parseAsync(bytes(models[name]).buffer, '')
export const getVideoUrl = async (name) => URL.createObjectURL(new Blob([bytes(media[name])], { type: 'video/mp4' }))
