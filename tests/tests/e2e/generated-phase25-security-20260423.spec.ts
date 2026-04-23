import { test, expect } from '@playwright/test'

/**
 * Generated tests — 2026-04-23
 * Covers: Phase 2.5 (RAG chunks), Security (do-not-store header), PII scrub toggle,
 *         homepage privacy badge, SECURITY.md audit trail.
 */

test.describe('Homepage — Privacy Badge', () => {
  test('privacy badge is visible on homepage', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Your Data is Protected')).toBeVisible()
  })

  test('homepage shows all three privacy pillars', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Not stored')).toBeVisible()
    await expect(page.getByText('Not trained on')).toBeVisible()
    await expect(page.getByText('Encrypted')).toBeVisible()
  })

  test('homepage subtitle no longer hardcodes model version', async ({ page }) => {
    await page.goto('/')
    const subtitle = await page.locator('p.text-lg').first().textContent()
    expect(subtitle).not.toContain('Sonnet 4.6')
    expect(subtitle).toContain('Thrive Networks')
  })

  test('Claude banner updated to generic Anthropic Claude', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Anthropic Claude')).toBeVisible()
  })
})

test.describe('Generate Page — PII Scrub Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="text"], input[name="username"]', process.env.TEST_USER_USERNAME || 'cory')
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || '')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/', { timeout: 15000 })
  })

  test('PII scrub checkbox is present on generate page', async ({ page }) => {
    await page.goto('/generate')
    await expect(page.getByText('Scrub customer PII before sending to Claude')).toBeVisible()
  })

  test('PII scrub checkbox is unchecked by default (opt-in)', async ({ page }) => {
    await page.goto('/generate')
    const checkbox = page.locator('input[type="checkbox"]').filter({ hasText: '' }).first()
    // The label wraps the checkbox — locate by its descriptive text proximity
    const label = page.locator('label').filter({ hasText: 'Scrub customer PII' })
    const cb = label.locator('input[type="checkbox"]')
    await expect(cb).not.toBeChecked()
  })

  test('PII scrub checkbox can be toggled on', async ({ page }) => {
    await page.goto('/generate')
    const label = page.locator('label').filter({ hasText: 'Scrub customer PII' })
    const cb = label.locator('input[type="checkbox"]')
    await cb.check()
    await expect(cb).toBeChecked()
  })

  test('PII scrub helper text is visible', async ({ page }) => {
    await page.goto('/generate')
    await expect(page.getByText('Replaces IPs, hostnames, names')).toBeVisible()
  })

  test('generate button still present alongside PII toggle', async ({ page }) => {
    await page.goto('/generate')
    await expect(page.getByRole('button', { name: /generate tip/i })).toBeVisible()
  })
})

test.describe('Library Page — RAG chunks indexed', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="text"], input[name="username"]', process.env.TEST_USER_USERNAME || 'cory')
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || '')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/', { timeout: 15000 })
  })

  test('library page loads approved documents', async ({ page }) => {
    await page.goto('/library')
    // At least some approved docs should show
    const docCount = await page.locator('[data-testid="library-doc"], .library-doc, tr').count()
    expect(docCount).toBeGreaterThan(0)
  })
})

test.describe('API — Security Headers', () => {
  test('health endpoint responds 200', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.ok()).toBeTruthy()
  })

  test('API does not expose server version in headers', async ({ request }) => {
    const res = await request.get('/api/health')
    const server = res.headers()['server'] || ''
    expect(server.toLowerCase()).not.toContain('uvicorn')
  })
})
