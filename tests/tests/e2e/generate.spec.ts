import { test, expect } from '@playwright/test'

test.describe('Generate Page — Form & Progress UX', () => {
  test('generate page has title input', async ({ page }) => {
    await page.goto('/generate')
    const titleInput = page.locator('input[placeholder*="title" i], input[placeholder*="TIP" i], input[placeholder*="implementation" i]')
    await expect(titleInput.first()).toBeVisible()
  })

  test('generate button is disabled when title is empty', async ({ page }) => {
    await page.goto('/generate')
    const btn = page.locator('button:has-text("Generate TIP"), button:has-text("Generate")')
    await expect(btn.first()).toBeDisabled()
  })

  test('generate button enables after entering a title', async ({ page }) => {
    await page.goto('/generate')
    const titleInput = page.locator('input').first()
    await titleInput.fill('Test TIP Title')
    const btn = page.locator('button:has-text("Generate TIP"), button:has-text("Generate")')
    await expect(btn.first()).toBeEnabled()
  })

  test('document selectors are present on generate page', async ({ page }) => {
    await page.goto('/generate')
    // Should show discovery doc selector
    const selects = page.locator('select')
    await expect(selects.first()).toBeVisible()
  })

  test('current template is displayed on generate page', async ({ page }) => {
    await page.goto('/generate')
    // Should show active template info or no-template warning
    const templateInfo = page.locator('text=/template/i')
    await expect(templateInfo.first()).toBeVisible()
  })
})
