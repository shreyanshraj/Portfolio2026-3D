# shreyanshraj.com: the room

A small isometric room on a Tempe morning. When the page loads, the sun rises
and a beam of light comes through the glass door. Visitors click things in the
room to learn about Raj. There's also a plain résumé view at `#resume` that
never loads the 3D code, and the same résumé as static HTML at `/resume`
for search engines and visitors without JavaScript.

If the room can't be shown (WebGL turned off, a model that fails to load, a
crash in the scene), visitors see a short note with links to the résumé and
the contact form instead of a blank page.

Built with React, TypeScript, Vite, three.js and React Three Fiber.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ (plus the prerendered dist/resume.html)
npm run build:inline  # same site with the models bundled into the JS (dist-inline/),
                      # for hosts that won't serve .glb files
npm run typecheck  # TypeScript (tsc --noEmit)
npm run lint     # ESLint
npm test         # Playwright smoke tests against a production build
```

Before the first `npm test`, run `npx playwright install chromium` once.

## Tests and deploys

`tests/smoke.spec.ts` checks, on a desktop and a phone screen size: the room
loads and a bubble opens, the fallback appears without WebGL or when a model
fails to load, `#resume` renders, `resume.html` reads fine with JavaScript off,
and the contact form posts to Formspree (the request is intercepted, so nothing
is sent).

`.github/workflows/ci.yml` runs the type check, lint and the tests on every
push and pull request.

## Hosting (Vercel + Cloudflare DNS)

Vercel builds and deploys from Git: `main` goes to production, and every other
branch and pull request gets a preview URL. `vercel.json` sets the build
(`npm run build`, output `dist/`), turns on clean URLs (so the static résumé
is at `/resume`, and `/resume.html` redirects there), caches the hashed
`assets/` files for a year and the models and clips for a day.

The domain's DNS is on Cloudflare and points at Vercel. Keep those records
"DNS only" (grey cloud) so Vercel can issue and renew the HTTPS certificate.

## Link previews and search

`index.html` has the Open Graph and Twitter tags, the favicon
(`public/favicon.svg`, `public/apple-touch-icon.png`) and a preview image
(`public/og-image.png`, a 1200×630 screenshot of the room). `public/robots.txt`
and `public/sitemap.xml` list the room and `/resume`. The absolute URLs in
these files assume the site is at https://shreyanshraj.com/; change them, and
`SITE` in `scripts/prerender-resume.mjs`, if it lives elsewhere.

## Performance

Phones and machines with 4 or fewer CPU cores render at up to 1.5× pixel
density (instead of 2×) with a 1024px shadow map (instead of 2048px). This is
decided once on load in `src/scene/Experience.tsx`.

## Time of day

The room follows the visitor's local clock:

| Hours | Mood |
|---|---|
| 5:00 to 11:00 | Morning: low gold sun through the door |
| 11:00 to 16:00 | Day: bright, high sun |
| 16:00 to 18:00 | Evening: long orange light, floor lamp on |
| 18:00 to 5:00 | Night: moonlight, stars, lamp and TV glowing, string lights on the patio; Raj has logged off and the laptop sleeps |

The clock is checked every minute, and the room fades across if the mood
changes while someone has the page open. While developing, `?time=night` (or
`morning`, `day`, `evening`) forces a mood and `?start=now` skips the opening
light-up. Moods are tuned in `src/scene/timeOfDay.ts`.

## Contact form

"Get in touch" (in the header, and in the glass door's bubble) opens a small
form. Messages are posted to the Formspree form set as `CONTACT_FORM.endpoint`
in `src/content.ts`, which emails them to you. Set the endpoint to `null` and
Send opens the visitor's email app with their message filled in instead.

## Résumé PDF

The "Download PDF" button on `#resume` serves `public/resume/Shreyansh_Raj_Resume.pdf`.
Replace that file to update it; keep the same name or change `PDF_URL` in
`src/ui/Resume.tsx`.

## Where things live

| What you want to change | File |
|---|---|
| Any text a visitor reads (bubbles, projects, contact links, the whole résumé page) | `src/content.ts` |
| The résumé page layout (its text is `RESUME` in `src/content.ts`) | `src/ui/Resume.tsx` |
| Furniture placement, the room, the door | `src/scene/Room.tsx` |
| Light-up timing, sunbeam, the gold light on a clicked object | `src/scene/Lighting.tsx` |
| Colours and light levels for each time of day | `src/scene/timeOfDay.ts` |
| Colours | `src/scene/palette.ts` and the top of `src/styles.css` |
| Camera framing and the zoom into the laptop | `src/scene/Experience.tsx` |

### Placing a model

Kenney models face +z, so `Model` takes a turn and a corner position instead
of a raw transform:

```jsx
<Model name="desk" rot={Math.PI / 2} at={[0, 0, 1.2]} />
```

- `rot`: turn about the vertical axis. `Math.PI / 2` faces the room's +x side.
- `at`: where the corner of the rotated footprint sits, as `[x, floorHeight, z]`.

In room coordinates, x runs along the right-hand wall (shelf, TV, door) and z
runs along the left-hand wall (window, desk). Both go from 0 to 2.4.

## Posters

The two posters above the TV can show any image: put the files in
`public/posters/` and set their paths in `POSTER_IMAGES` in `src/content.ts`.
Images are cropped to fit the frame. Until then they show original painted
prints (a cook's flat-lay and a gamepad). Only use artwork you have the rights
to show on a public site.

## The screen clips

- `public/media/tv-loop.mp4`: a 4-second desert racing loop (about 50 KB),
  drawn by `scripts/tv-video.py`.
- `public/media/laptop-loop.mp4`: code being typed in an editor (about 18 KB),
  drawn by `scripts/code-video.py`.

Both scripts use Python + Pillow and ffmpeg. To use your own clip, replace the
file with any short muted MP4; clips loop and start after the room is on
screen. Visitors with reduced motion see a still frame.

## Models and licences

All models are CC0 (public domain), so no attribution is required. Credit is
still nice:

- **Kenney Furniture Kit**: https://kenney.nl/assets/furniture-kit (chair,
  bookcase, books, sofa, TV and cabinet, coffee table, plants)
- **Kenney Mini Characters**: https://kenney.nl/assets/mini-characters (the
  seated figure, `public/models/raj.glb`, "Male C" with its `sit` animation)

The mug, the Xbox, the walls, the window and the sliding glass door are built in
code (`src/scene/Room.tsx`). The desk, laptop, rug, floor lamp, posters, 24-hour
digital clock, coffee steam and screen videos are in `src/scene/Decor.tsx`; the posters are
original art painted in code, and the clock shows the visitor's real time. The two outside views are painted in code too
(`src/scene/timeOfDay.ts`): the window looks out on a distant ridge, and the
glass door opens onto a small walled garden with a lawn, a stone path, flowers
and a citrus tree.

To swap the character, drop another Mini Characters GLB at
`public/models/raj.glb`. Every character in that pack has the same `sit` clip.

The whole model folder is under 0.5 MB, and the 3D code only loads on the room
view.
