import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

// What `@model-source` provides. Vite points that alias at url.ts or inline.ts
// depending on the build mode; both type their exports against this.
export interface ModelSource {
  getModel(name: string): Promise<GLTF>
  getVideoUrl(name: string): Promise<string>
}
