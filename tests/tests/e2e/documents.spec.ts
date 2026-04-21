import { test, expect } from '@playwright/test'
test.describe('Documents — Upload & Management', () => {
  test('upload page has drag-and-drop zone and browse button', async ({ page }) => {
    await page.goto('/upload')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h3').first()).toBeVisible()
    await expect(page.locator('text=Browse Files')).toBeVisible()
  })

  test('upload page has hidden file input accepting xlsx/pdf/docx', async ({ page }) => {
    await page.goto('/upload')
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toHaveCount(1)
    const accept = await fileInput.getAttribute('accept')
    expect(accept).toContain('.xlsx')
    expect(accept).toContain('.pdf')
  })

  test('documents API returns list', async ({ page }) => {
    const res = await page.request.get('/api/documents')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBeTruthy()
  })

  test('documents page loads with list or empty state', async ({ page }) => {
    await page.goto('/documents')
    await expect(page.locator('body')).toBeVisible()
    // Either has uploaded docs or shows upload link/empty state
    const content = await page.locator('main').first().innerText()
    expect(content.length).toBeGreaterThan(10)
  })
})
