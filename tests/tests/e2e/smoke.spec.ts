import { test, expect } from '@playwright/test'

test.describe('Smoke — No Auth', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('unauthenticated request redirects to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Smoke — Auth + Navigation', () => {
  test('API health endpoint is healthy', async ({ page }) => {
    const res = await page.request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('healthy')
    expect(body.database).toBe('connected')
  })

  test('homepage loads with TIP Generator branding', async ({ page }) => {
    await page.goto('/')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('text=TIP Generator').first()).toBeVisible()
  })

  test('nav shows logout button', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('button[title="Sign out"]')).toBeVisible()
  })

  test('drafts page loads', async ({ page }) => {
    await page.goto('/drafts')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('generate page loads', async ({ page }) => {
    await page.goto('/generate')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('upload page loads', async ({ page }) => {
    await page.goto('/upload')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).toBeVisible()
  })

  test('template management page loads', async ({ page }) => {
    await page.goto('/admin/template')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('body')).toBeVisible()
  })
})
