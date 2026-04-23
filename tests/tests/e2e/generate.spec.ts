import { test, expect } from '@playwright/test'

test.describe('Generate Page — Form & Progress UX', () => {
  test('generate page has title input', async ({ page }) => {
    await page.goto('/generate')
    await page.waitForLoadState('networkidle')
    const titleInput = page.locator('input[placeholder*="Acme"]')
    await expect(titleInput.first()).toBeVisible()
  })

  test('generate button is disabled when title is empty', async ({ page }) => {
    await page.goto('/generate')
    await page.waitForLoadState('networkidle')
    const btn = page.locator('button').filter({ hasText: /generate tip/i }).first()
    await expect(btn).toBeDisabled()
  })

  test('generate button enables after entering a title', async ({ page }) => {
    await page.goto('/generate')
    await page.waitForLoadState('networkidle')
    await page.locator('input[placeholder*="Acme"]').first().fill('Test TIP Title')
    const btn = page.locator('button').filter({ hasText: /generate tip/i }).first()
    await expect(btn).toBeEnabled()
  })

  test('source documents section is present on generate page', async ({ page }) => {
    // Phase 2.4: dropdowns replaced by clickable doc rows (multi-select)
    await page.goto('/generate')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Source Documents')).toBeVisible()
  })

  test('current template is displayed on generate page', async ({ page }) => {
    await page.goto('/generate')
    // Should show active template info or no-template warning
    const templateInfo = page.locator('text=/template/i')
    await expect(templateInfo.first()).toBeVisible()
  })
})
