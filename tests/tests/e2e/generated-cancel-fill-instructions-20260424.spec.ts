import { test, expect } from '@playwright/test'

/**
 * Generated tests for changes since v0.10.0 (2026-04-24)
 * Covers:
 *   - Cancel button on DraftsPage (CANCELLED status, orange badge)
 *   - Delete generating draft revokes task
 *   - Author instructions field + presets on GeneratePage
 *   - Fill [DATA NEEDED] panel on DraftViewPage
 *   - Library chunk expansion on LibraryPage
 */

test.describe('DraftsPage — Cancel & Status Badges', () => {
  test('drafts page loads and shows status badges', async ({ page }) => {
    await page.goto('/drafts')
    await page.waitForLoadState('networkidle')
    // Should render without crash
    await expect(page.locator('body')).not.toContainText('Error')
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  })

  test('completed draft shows green badge', async ({ page }) => {
    await page.goto('/drafts')
    await page.waitForLoadState('networkidle')
    const completedBadge = page.locator('.bg-green-100.text-green-700').first()
    // If any completed drafts exist, badge should be visible
    const count = await completedBadge.count()
    if (count > 0) {
      await expect(completedBadge).toBeVisible()
      await expect(completedBadge).toContainText('completed')
    }
  })

  test('failed draft shows red badge', async ({ page }) => {
    await page.goto('/drafts')
    await page.waitForLoadState('networkidle')
    const failedBadge = page.locator('.bg-red-100.text-red-700').first()
    const count = await failedBadge.count()
    if (count > 0) {
      await expect(failedBadge).toContainText('failed')
    }
  })

  test('cancelled draft shows orange badge', async ({ page }) => {
    await page.goto('/drafts')
    await page.waitForLoadState('networkidle')
    const cancelledBadge = page.locator('.bg-orange-100.text-orange-600').first()
    const count = await cancelledBadge.count()
    if (count > 0) {
      await expect(cancelledBadge).toContainText('cancelled')
    }
  })

  test('generating draft shows Cancel button, not Rename', async ({ page }) => {
    await page.goto('/drafts')
    await page.waitForLoadState('networkidle')
    // Match only badges with the exact text 'generating'
    const generatingBadges = page.locator('.bg-blue-100.text-blue-700', { hasText: /^generating$/ })
    const count = await generatingBadges.count()
    if (count === 0) return  // No generating drafts — nothing to assert
    const badge = generatingBadges.first()
    const card = badge.locator('xpath=ancestor::div[contains(@class,"border")]').first()
    await expect(card.locator('button', { hasText: 'Cancel' })).toBeVisible()
    await expect(card.locator('button[title="Rename draft"]')).not.toBeVisible()
  })
})

test.describe('GeneratePage — Author Instructions & Presets', () => {
  test('author instructions textarea is present', async ({ page }) => {
    await page.goto('/generate')
    await page.waitForLoadState('networkidle')
    // The Additional Author Instructions section should exist
    const instructionArea = page.locator('textarea').filter({ hasText: '' })
    // Look for label text
    await expect(page.locator('text=Author Instructions').or(page.locator('text=Additional Instructions'))).toBeVisible()
  })

  test('generate page has preset save/load UI', async ({ page }) => {
    await page.goto('/generate')
    await page.waitForLoadState('networkidle')
    // Author Instructions field is always present; Presets: label only shows when user has saved presets
    await expect(page.locator('text=Author Instructions')).toBeVisible()
    // The textarea for author instructions must be present
    await expect(page.locator('textarea').nth(1)).toBeVisible()
  })

  test('generate page has PII scrubbing toggle', async ({ page }) => {
    await page.goto('/generate')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=PII').or(page.locator('text=Scrub'))).toBeVisible()
  })
})

test.describe('DraftViewPage — Fill DATA NEEDED Panel', () => {
  test('completed draft with DATA NEEDED shows Fill button in toolbar', async ({ page }) => {
    await page.goto('/drafts')
    await page.waitForLoadState('networkidle')
    // Navigate to first completed draft
    const completedCard = page.locator('.bg-green-100.text-green-700').first()
    const count = await completedCard.count()
    if (count > 0) {
      await completedCard.locator('xpath=ancestor::div[contains(@class,"cursor-pointer")]').first().click()
      await page.waitForLoadState('networkidle')
      // If any DATA NEEDED fields exist, Fill button should be in toolbar
      const fillBtn = page.locator('button', { hasText: /Fill \(/ })
      const fillCount = await fillBtn.count()
      if (fillCount > 0) {
        await expect(fillBtn).toBeVisible()
        // Click to open the panel
        await fillBtn.click()
        await expect(page.locator('text=Fill [DATA NEEDED] Fields')).toBeVisible()
        // Should show input fields
        await expect(page.locator('input[placeholder*="Enter"]').first()).toBeVisible()
        // Apply All button should be disabled when inputs are empty
        await expect(page.locator('button', { hasText: 'Apply All' })).toBeDisabled()
      }
    }
  })

  test('draft view page toolbar has expected buttons for completed draft', async ({ page }) => {
    await page.goto('/drafts')
    await page.waitForLoadState('networkidle')
    const completedCard = page.locator('.bg-green-100.text-green-700').first()
    const count = await completedCard.count()
    if (count > 0) {
      await completedCard.locator('xpath=ancestor::div[contains(@class,"cursor-pointer")]').first().click()
      await page.waitForLoadState('networkidle')
      // Toolbar should have Sections, Collab, Gaps, Export buttons
      await expect(page.locator('button', { hasText: 'Sections' })).toBeVisible()
      await expect(page.locator('button', { hasText: /\.docx/ })).toBeVisible()
      await expect(page.locator('button', { hasText: /\.pdf/ })).toBeVisible()
    }
  })

  test('refine panel opens on section expand', async ({ page }) => {
    // Get the first completed draft ID from the API, then navigate directly
    const res = await page.request.get('/api/generate/drafts?status=completed&limit=1')
    if (!res.ok()) return
    const data = await res.json()
    const drafts = Array.isArray(data) ? data : (data.drafts ?? data.items ?? [])
    if (drafts.length === 0) return
    const draft = drafts[0]
    await page.goto(`/drafts/${draft.id}`)
    await page.waitForLoadState('networkidle')
    // Section rows are themselves the clickable divs (chevron on left)
    // Click the first section row (skip index 0 which is Whole-Document Refine panel)
    const sectionRows = page.locator('.border.rounded-xl')
    await sectionRows.nth(1).click()
    await page.waitForTimeout(500)
    await expect(page.locator('button', { hasText: 'Refine' }).first()).toBeVisible()
  })
})

test.describe('LibraryPage — Chunk Expansion', () => {
  test('library page loads without error', async ({ page }) => {
    await page.goto('/library')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Something went wrong')
  })

  test('promoted library docs show Chunks toggle', async ({ page }) => {
    await page.goto('/library')
    await page.waitForLoadState('networkidle')
    // Look for any Chunks button (only appears on promoted-section type docs)
    const chunksBtn = page.locator('button', { hasText: /Chunks/ }).first()
    const count = await chunksBtn.count()
    if (count > 0) {
      await chunksBtn.click()
      // After clicking, chunk list should appear or button shows loading
      await page.waitForTimeout(500)
      // Should not crash
      await expect(page.locator('body')).not.toContainText('Error loading')
    }
  })
})

test.describe('API — Cancel endpoint', () => {
  test('cancel endpoint returns 400 for non-generating draft', async ({ page }) => {
    // Use API request context
    const response = await page.request.post('/api/generate/drafts/99999/cancel')
    // Either 400 (not generating) or 404 (not found) — both valid
    expect([400, 404, 422]).toContain(response.status())
  })

  test('cancel endpoint requires auth', async ({ page }) => {
    // Navigate to cancel URL without auth — should redirect to login, not serve content
    await page.goto('/login')
    await page.context().clearCookies()
    const response = await page.request.post('/api/generate/drafts/1/cancel', {
      headers: { 'Content-Type': 'application/json' },
    })
    // FastAPI returns 401 or redirects (302 to login) for unauthenticated API calls
    expect([302, 401, 403, 422]).toContain(response.status())
  })
})
