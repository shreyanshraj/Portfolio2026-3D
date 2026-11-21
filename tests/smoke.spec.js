import { test, expect } from '@playwright/test'

// Fail any test where the page throws.
test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => {
    throw e
  })
})

test('the room loads and an object opens its bubble', async ({ page }) => {
  await page.goto('./?start=now&time=morning')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByText('Click anything in the room.')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Raj at the desk' }).click()
  await expect(page.getByRole('heading', { name: "Hi, I'm Raj." })).toBeVisible()
})

test('without WebGL, visitors get the résumé instead of a blank page', async ({ page }) => {
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return type.startsWith('webgl') ? null : real.call(this, type, ...rest)
    }
  })
  await page.goto('./')
  await expect(page.getByRole('heading', { name: "The room didn't load on this device." })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Raj at the desk' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Read the résumé' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Shreyansh Raj' })).toBeVisible()
})

test('a model that fails to load shows the fallback', async ({ page }) => {
  page.removeAllListeners('pageerror') // the failed load is expected here
  await page.route('**/models/raj.glb', (route) => route.abort())
  await page.goto('./?start=now')
  await expect(page.getByRole('heading', { name: "The room didn't load on this device." })).toBeVisible({ timeout: 20_000 })
})

test('#resume renders the résumé', async ({ page }) => {
  await page.goto('./#resume')
  await expect(page.getByRole('heading', { level: 1, name: 'Shreyansh Raj' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Experience' })).toBeVisible()
})

test.describe('static résumé page', () => {
  test.use({ javaScriptEnabled: false })
  test('reads fine with JavaScript off', async ({ page }) => {
    await page.goto('./resume.html')
    await expect(page).toHaveTitle('Shreyansh Raj, résumé')
    await expect(page.getByRole('heading', { level: 1, name: 'Shreyansh Raj' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', './resume/Shreyansh_Raj_Resume.pdf')
    await expect(page.getByRole('link', { name: 'Back to the room' })).toHaveAttribute('href', './')
  })
})

test('the contact form posts to Formspree', async ({ page }) => {
  let sent
  await page.route('https://formspree.io/**', async (route) => {
    sent = route.request().postDataJSON()
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  })
  await page.goto('./?start=now')
  await page.getByRole('button', { name: 'Get in touch' }).first().click()
  await page.getByLabel('Your name').fill('Test Visitor')
  await page.getByLabel('Your email').fill('visitor@example.com')
  await page.getByLabel('Message').fill('Hello!')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByText('Message sent.')).toBeVisible()
  expect(sent).toMatchObject({ name: 'Test Visitor', email: 'visitor@example.com', message: 'Hello!' })
})

test.describe("the glass door's What's next bubble", () => {
  const AWAKE = "so I'll likely see your message today."
  const ASLEEP = "so I'm probably offline. Leave a note and I'll reply to you in the morning."
  // Tempe is UTC-7 all year (no daylight saving)
  for (const [label, utc, expected] of [
    ['2:14 pm', '2026-11-20T21:14:00Z', AWAKE],
    ['9:59 pm', '2026-11-21T04:59:00Z', AWAKE],
    ['10:00 pm', '2026-11-21T05:00:00Z', ASLEEP],
    ['6:59 am', '2026-11-21T13:59:00Z', ASLEEP],
    ['7:00 am', '2026-11-21T14:00:00Z', AWAKE],
  ]) {
    test(`at ${label} in Tempe it says "${expected.slice(0, 30)}…"`, async ({ page }) => {
      await page.clock.setFixedTime(new Date(utc))
      await page.goto('./?start=now&time=morning')
      await expect(page.getByText('Click anything in the room.')).toBeVisible({ timeout: 20_000 })
      await page.getByRole('button', { name: 'Glass door' }).click()
      const line = page.getByRole('dialog', { name: "What's next." }).locator('.bubble-time')
      await expect(line).toHaveText(`It's ${label.toUpperCase()} in Tempe, ${expected}`)
    })
  }

  test('the time ticks while open, and "Let\'s talk" opens the contact form', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-21T04:58:30Z') }) // 9:58:30 pm
    await page.clock.resume() // let time (and the 3D scene) run normally
    await page.goto('./?start=now&time=morning')
    await expect(page.getByText('Click anything in the room.')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: 'Glass door' }).click()
    const bubble = page.getByRole('dialog', { name: "What's next." })
    await expect(bubble).toContainText("I'm looking for a full-stack role")
    const line = bubble.locator('.bubble-time')
    await expect(line).toHaveText(`It's 9:58 PM in Tempe, ${AWAKE}`)
    await page.clock.fastForward('02:00') // past 10:00 pm
    await expect(line).toHaveText(`It's 10:00 PM in Tempe, ${ASLEEP}`)
    await bubble.getByRole('button', { name: "Let's talk" }).click()
    await expect(page.getByRole('dialog', { name: 'Get in touch' })).toBeVisible()
  })
})

// Desktop bubbles: on screen, below the header buttons, never pushed onto
// their object, with the pointed corner on the object's side.
test('speech bubbles stay on screen and beside their object', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones show the text in a bottom sheet instead')
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 640 }]) {
    await page.setViewportSize(viewport)
    await page.goto('./?start=now&time=morning')
    await expect(page.getByText('Click anything in the room.')).toBeVisible({ timeout: 20_000 })
    const header = await page.evaluate(() => Math.max(...[...document.querySelectorAll('.top-link')].map((b) => b.getBoundingClientRect().bottom)))
    for (const id of ['raj', 'laptop', 'coffee', 'books', 'medals', 'tv', 'showPoster', 'gamePoster', 'door']) {
      await page.locator(`.anchor[data-anchor="${id}"] .spot`).click()
      await expect(page.locator('.bubble-anchor[data-tail]')).toBeVisible()
      await page.waitForTimeout(300) // let the camera settle
      const r = await page.evaluate((id) => {
        const a = document.querySelector(`.anchor[data-anchor="${id}"]`).getBoundingClientRect()
        const b = document.querySelector('.bubble').getBoundingClientRect()
        return { ax: a.left, ay: a.top, l: b.left, t: b.top, r: b.right, b: b.bottom, tail: document.querySelector('.bubble-anchor').dataset.tail }
      }, id)
      const where = `${id} at ${viewport.width}x${viewport.height}`
      expect(r.t, `${where}: below the header`).toBeGreaterThanOrEqual(header)
      expect(r.l, `${where}: left edge`).toBeGreaterThanOrEqual(23.5)
      expect(viewport.width - r.r, `${where}: right edge`).toBeGreaterThanOrEqual(23.5)
      expect(viewport.height - r.b, `${where}: bottom edge`).toBeGreaterThanOrEqual(23.5)
      const gap = r.ax <= r.l ? r.l - r.ax : r.ax >= r.r ? r.ax - r.r : -1
      expect(gap, `${where}: 40px clear of its object`).toBeGreaterThanOrEqual(39.5)
      expect(r.tail, `${where}: pointed corner faces the object`).toMatch(r.ax <= r.l ? /-left$/ : /-right$/)
      await page.keyboard.press('Escape')
    }
  }
})
