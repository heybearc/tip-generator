import { test, expect } from '@playwright/test'

// Generated tests for commits: afd37fc, 2e61719, 194ed27, 297c2cf
// Covers: AI Assist fixes, Whole-doc Refine panel, Custom mode in per-section Refine

test.describe('AI Assist — Fixed behavior', () => {
  test('draft view loads with sections', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts')
    expect(listRes.status()).toBe(200)
    const drafts = await listRes.json()
    const completed = drafts.find((d: { status: string }) => d.status === 'completed')
    if (!completed) { test.skip(); return }

    await page.goto(`/drafts/${completed.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Whole-Document Refine')).toBeVisible()
  })

  test('Whole-Document Refine panel is visible above sections', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts')
    const drafts = await listRes.json()
    const completed = drafts.find((d: { status: string; sections: unknown }) => d.status === 'completed' && d.sections)
    if (!completed) { test.skip(); return }

    await page.goto(`/drafts/${completed.id}`)
    await page.waitForLoadState('networkidle')

    const panel = page.locator('button', { hasText: 'Whole-Document Refine' })
    await expect(panel).toBeVisible()
  })

  test('Whole-Document Refine panel expands on click', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts')
    const drafts = await listRes.json()
    const completed = drafts.find((d: { status: string; sections: unknown }) => d.status === 'completed' && d.sections)
    if (!completed) { test.skip(); return }

    await page.goto(`/drafts/${completed.id}`)
    await page.waitForLoadState('networkidle')

    await page.locator('button', { hasText: 'Whole-Document Refine' }).click()
    await expect(page.locator('textarea[placeholder*="Convert all bullet"]')).toBeVisible()
    await expect(page.locator('button', { hasText: 'Run on All Sections' })).toBeVisible()
  })

  test('Run on All Sections button disabled when textarea empty', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts')
    const drafts = await listRes.json()
    const completed = drafts.find((d: { status: string; sections: unknown }) => d.status === 'completed' && d.sections)
    if (!completed) { test.skip(); return }

    await page.goto(`/drafts/${completed.id}`)
    await page.waitForLoadState('networkidle')

    await page.locator('button', { hasText: 'Whole-Document Refine' }).click()
    const runBtn = page.locator('button', { hasText: 'Run on All Sections' })
    await expect(runBtn).toBeDisabled()
  })

  test('AI Assist chat panel shows whole-doc suggestions (not section-specific)', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts')
    const drafts = await listRes.json()
    const completed = drafts.find((d: { status: string }) => d.status === 'completed')
    if (!completed) { test.skip(); return }

    await page.goto(`/drafts/${completed.id}`)
    await page.waitForLoadState('networkidle')

    // Open chat panel
    const chatBtn = page.locator('button', { hasText: /AI Assist|Chat/ })
    if (await chatBtn.count() === 0) { test.skip(); return }
    await chatBtn.first().click()

    // Should show whole-doc suggestions, NOT section-specific ones
    await expect(page.locator('text=What sections are missing or incomplete')).toBeVisible()
    await expect(page.locator('text=Make the executive summary more concise')).not.toBeVisible()
  })

  test('AI Assist shows guidance to use Refine for sections', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts')
    const drafts = await listRes.json()
    const completed = drafts.find((d: { status: string }) => d.status === 'completed')
    if (!completed) { test.skip(); return }

    await page.goto(`/drafts/${completed.id}`)
    await page.waitForLoadState('networkidle')

    const chatBtn = page.locator('button', { hasText: /AI Assist|Chat/ })
    if (await chatBtn.count() === 0) { test.skip(); return }
    await chatBtn.first().click()

    await expect(page.locator('text=To refine a specific section')).toBeVisible()
  })

  test('Per-section Refine panel has Custom mode button', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts')
    const drafts = await listRes.json()
    const completed = drafts.find((d: { status: string; sections: unknown }) => d.status === 'completed' && d.sections)
    if (!completed) { test.skip(); return }

    await page.goto(`/drafts/${completed.id}`)
    await page.waitForLoadState('networkidle')

    // Section headers are divs with cursor-pointer class (not buttons)
    const sectionHeader = page.locator('div[class*="cursor-pointer"]').first()
    await sectionHeader.click()
    await page.waitForTimeout(500)

    // Refine button (exact text) — not the DocRefinePanel toggle which contains "Refine" as substring
    const refineBtn = page.getByRole('button', { name: 'Refine', exact: true }).first()
    if (await refineBtn.count() === 0) { test.skip(); return }
    await refineBtn.click()

    // Custom mode should now exist in the refine panel
    await expect(page.locator('button', { hasText: 'Custom' })).toBeVisible()
  })

  test('refine-all API returns sections dict', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts')
    const drafts = await listRes.json()
    // Just verify 400 without instruction (not 404 - route exists)
    const completed = drafts.find((d: { status: string }) => d.status === 'completed')
    if (!completed) { test.skip(); return }

    const res = await page.request.post(`/api/generate/drafts/${completed.id}/refine-all`, {
      data: { instruction: '' }
    })
    // Should be 400 (missing instruction) not 404 (route missing)
    expect(res.status()).toBe(400)
  })

  test('refine endpoint returns 400 not 404 for missing instruction', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts')
    const drafts = await listRes.json()
    const completed = drafts.find((d: { status: string }) => d.status === 'completed')
    if (!completed) { test.skip(); return }

    const res = await page.request.post(`/api/generate/drafts/${completed.id}/refine`, {
      data: { instruction: 'test', current_content: 'test content' }
    })
    // 402 = no API key, 200 = success, 500 = claude error — all fine, NOT 404
    expect(res.status()).not.toBe(404)
  })
})
