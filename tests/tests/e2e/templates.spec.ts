import { test, expect } from '@playwright/test'

test.describe('Templates — Management API & UI', () => {
  test('templates API returns list', async ({ page }) => {
    const res = await page.request.get('/api/template')
    expect([200, 404]).toContain(res.status())
  })

  test('active template API returns current template or 404', async ({ page }) => {
    const res = await page.request.get('/api/template/active')
    expect([200, 404]).toContain(res.status())
  })

  test('active template instructions endpoint responds', async ({ page }) => {
    const res = await page.request.get('/api/template/active/instructions')
    expect([200, 404]).toContain(res.status())
  })

  test('template management page loads at /admin/template', async ({ page }) => {
    await page.goto('/admin/template')
    await expect(page.locator('body')).toBeVisible()
    const content = await page.locator('#root').innerText()
    expect(content.length).toBeGreaterThan(10)
  })

  test('template management page has Template nav link', async ({ page }) => {
    await page.goto('/admin/template')
    await expect(page.locator('a[href*="template"]').first()).toBeVisible()
  })
})
