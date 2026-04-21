import { test, expect } from '@playwright/test'

test.describe('Drafts — List & API', () => {
  test('drafts API returns list', async ({ page }) => {
    const res = await page.request.get('/api/generate/drafts')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBeTruthy()
  })

  test('drafts page shows list or empty state', async ({ page }) => {
    await page.goto('/drafts')
    await page.waitForLoadState('networkidle')
    const content = await page.locator('main').first().innerText()
    expect(content.length).toBeGreaterThan(10)
  })

  test('drafts page has Generate TIP link or button', async ({ page }) => {
    await page.goto('/drafts')
    const generateLink = page.locator('a[href*="generate"], button:has-text("Generate")')
    await expect(generateLink.first()).toBeVisible()
  })

  test('invalid draft ID returns 404', async ({ page }) => {
    const res = await page.request.get('/api/generate/drafts/999999')
    expect(res.status()).toBe(404)
  })

  test('progress endpoint returns structure for valid draft', async ({ page }) => {
    // First get drafts list to find a real ID
    const listRes = await page.request.get('/api/generate/drafts')
    const drafts = await listRes.json()
    if (drafts.length === 0) {
      test.skip()
      return
    }
    const draftId = drafts[0].id
    const res = await page.request.get(`/api/generate/drafts/${draftId}/progress`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('draft_id')
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('title')
  })

  test('clicking completed draft navigates to draft view', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts')
    const drafts = await listRes.json()
    const completed = drafts.find((d: any) => d.status === 'completed')
    if (!completed) {
      test.skip()
      return
    }
    await page.goto('/drafts')
    await page.locator(`text=${completed.title}`).first().click()
    await expect(page).toHaveURL(new RegExp(`/drafts/${completed.id}`))
  })
})
