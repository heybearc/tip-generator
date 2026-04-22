import { test, expect } from '@playwright/test'

test.describe('Phase 2.3 — Draft Collaboration', () => {

  test('collaborators API returns list for owned draft', async ({ page }) => {
    const drafts = await (await page.request.get('/api/generate/drafts')).json()
    if (drafts.length === 0) { test.skip(); return }
    const res = await page.request.get(`/api/generate/drafts/${drafts[0].id}/collaborators`)
    expect(res.status()).toBe(200)
    expect(Array.isArray(await res.json())).toBeTruthy()
  })

  test('user search returns results for 2+ char query', async ({ page }) => {
    const res = await page.request.get('/api/auth/users/search?q=co')
    expect(res.status()).toBe(200)
    expect(Array.isArray(await res.json())).toBeTruthy()
  })

  test('user search returns empty for single char', async ({ page }) => {
    const res = await page.request.get('/api/auth/users/search?q=c')
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual([])
  })

  test('drafts list includes user_id and collaborator_count fields', async ({ page }) => {
    const res = await page.request.get('/api/generate/drafts')
    expect(res.status()).toBe(200)
    const drafts = await res.json()
    if (drafts.length === 0) { test.skip(); return }
    expect(drafts[0]).toHaveProperty('user_id')
    expect(drafts[0]).toHaveProperty('collaborator_count')
  })

  test('draft view page shows collaborators button', async ({ page }) => {
    const drafts = await (await page.request.get('/api/generate/drafts')).json()
    const completed = drafts.find((d: any) => d.status === 'completed')
    if (!completed) { test.skip(); return }
    await page.goto(`/drafts/${completed.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button[title="Manage collaborators"]')).toBeVisible()
  })

  test('collaborators panel opens with invite input for owner', async ({ page }) => {
    const drafts = await (await page.request.get('/api/generate/drafts')).json()
    const completed = drafts.find((d: any) => d.status === 'completed')
    if (!completed) { test.skip(); return }
    await page.goto(`/drafts/${completed.id}`)
    await page.waitForLoadState('networkidle')
    await page.click('button[title="Manage collaborators"]')
    await expect(page.getByText('Collaborators', { exact: false }).first()).toBeVisible()
    await expect(page.locator('input[placeholder="Search by name or username…"]')).toBeVisible()
  })

  test('invite typeahead shows dropdown on 2+ chars', async ({ page }) => {
    const drafts = await (await page.request.get('/api/generate/drafts')).json()
    const completed = drafts.find((d: any) => d.status === 'completed')
    if (!completed) { test.skip(); return }
    await page.goto(`/drafts/${completed.id}`)
    await page.waitForLoadState('networkidle')
    await page.click('button[title="Manage collaborators"]')
    const input = page.locator('input[placeholder="Search by name or username…"]')
    await input.fill('co')
    await page.waitForTimeout(600)
    const users = await (await page.request.get('/api/auth/users/search?q=co')).json()
    if (users.length > 0) {
      await expect(page.locator('.absolute.z-10')).toBeVisible()
    }
  })

  test('add collaborator rejects unknown username', async ({ page }) => {
    const drafts = await (await page.request.get('/api/generate/drafts')).json()
    if (drafts.length === 0) { test.skip(); return }
    const res = await page.request.post(`/api/generate/drafts/${drafts[0].id}/collaborators`, {
      data: { username: 'nonexistent_user_xyz_999' }
    })
    expect(res.status()).toBe(404)
  })

  test('documents endpoint is globally visible to authenticated user', async ({ page }) => {
    const res = await page.request.get('/api/documents')
    expect(res.status()).toBe(200)
    expect(Array.isArray(await res.json())).toBeTruthy()
  })

})
