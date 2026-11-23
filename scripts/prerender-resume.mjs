// Renders the résumé page to dist/resume.html as plain HTML, so search engines,
// link previews and visitors without JavaScript can read it. Runs after
// `vite build` (see the build script in package.json).
import { readFileSync, writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const SITE = 'https://shreyanshraj.com/'
const dist = new URL('../dist/', import.meta.url)

// The dev server always uses base '/', but the built site is relative ('./')
// so it works from any folder; match that in the rendered links.
const vite = await createServer({
  appType: 'custom',
  mode: 'production',
  server: { middlewareMode: true },
  logLevel: 'error',
  define: { 'import.meta.env.BASE_URL': JSON.stringify('./') },
})
const { Resume } = await vite.ssrLoadModule('/src/ui/Resume.tsx')
const { RESUME } = await vite.ssrLoadModule('/src/content.ts')
const body = renderToStaticMarkup(createElement(Resume, { roomHref: './' }))
await vite.close()

const escape = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const title = `${RESUME.name}, résumé`
const description = RESUME.summary

let html = readFileSync(new URL('index.html', dist), 'utf8')
  .replace(/<script type="module"[^>]*><\/script>\s*/g, '') // no JS needed
  .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
  .replace(/<noscript>[\s\S]*?<\/noscript>\s*/g, '')
  .replace(/<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`)
  .replace(/(<meta name="description" content=")[^"]*/, `$1${escape(description)}`)
  .replace(/(<meta property="og:title" content=")[^"]*/, `$1${escape(title)}`)
  .replace(/(<meta property="og:description" content=")[^"]*/, `$1${escape(description)}`)
  .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}resume`)
  .replace(/(<link rel="canonical" href=")[^"]*/, `$1${SITE}resume`)
  .replace('<div id="root"></div>', `<div id="root">${body}</div>`)

if (!html.includes('class="resume"')) throw new Error('prerender-resume: résumé markup was not inserted')
writeFileSync(new URL('resume.html', dist), html)
console.log('prerendered dist/resume.html')
