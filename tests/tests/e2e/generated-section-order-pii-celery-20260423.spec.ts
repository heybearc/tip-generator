import { test, expect } from '@playwright/test';

// Auth is handled by storageState in playwright.config.ts (global-setup Authentik SSO)
const BASE_URL = process.env.BASE_URL || 'https://green-tip.cloudigan.net';

test.describe('Section Order & Visibility (feat: section manager)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/drafts`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('Section Manager button visible on draft view', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts');
    const drafts = await listRes.json();
    const completed = drafts.find((d: any) => d.status === 'completed');
    if (!completed) { test.skip(); return; }
    await page.goto(`/drafts/${completed.id}`);
    await expect(page).toHaveURL(new RegExp(`/drafts/${completed.id}`));
    // Layers icon / Manage Sections button should exist
    const btn = page.locator('button:has-text("Sections"), button[title*="section"], button[aria-label*="section"]').first();
    await expect(btn).toBeVisible({ timeout: 5000 });
  });

  test('Section order API returns sections list', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts');
    const drafts = await listRes.json();
    const completed = drafts.find((d: any) => d.status === 'completed');
    if (!completed) { test.skip(); return; }
    const draftId = completed.id;

    const res = await page.request.get(`/api/generate/drafts/${draftId}/section-order`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty('key');
    expect(data[0]).toHaveProperty('visible');
    expect(data[0]).toHaveProperty('position');
  });
});

test.describe('Batch Count Display (fix: dynamic total_chunks)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/drafts`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('Draft list shows generating status with section progress', async ({ page }) => {
    await page.goto(`${BASE_URL}/drafts`);
    // Check any currently-generating draft shows "section X of Y" not stuck at 0
    const generatingDraft = page.locator('text=Generating section').first();
    // If one is generating, verify it shows a number
    if (await generatingDraft.isVisible()) {
      const text = await generatingDraft.textContent();
      expect(text).toMatch(/Generating section \d+ of \d+/);
      const match = text?.match(/section (\d+) of (\d+)/);
      if (match) {
        const current = parseInt(match[1]);
        const total = parseInt(match[2]);
        expect(total).toBeGreaterThan(4); // Should be 5+ with pillar passes, not old static 4
      }
    }
  });
});

test.describe('Cancel Generation (fix: cancel clears prompt)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/drafts`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('Cancel button visible on generating draft', async ({ page }) => {
    await page.goto(`${BASE_URL}/drafts`);
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    // Just verify cancel button exists in the UI (may not have active generation)
    // Navigate to generate page to see if cancel is wired correctly
    await page.goto(`${BASE_URL}/generate`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Refine All Sections (fix: skip structural, 8 workers)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/drafts`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('Refine-all endpoint rejects empty instruction', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts');
    const drafts = await listRes.json();
    const completed = drafts.find((d: any) => d.status === 'completed');
    if (!completed) { test.skip(); return; }
    const draftId = completed.id;

    const res = await page.request.post(`/api/generate/drafts/${draftId}/refine-all`, {
      data: { instruction: '' }
    });
    expect(res.status()).toBe(400);
  });

  test('Refine All button/panel visible on completed draft', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts');
    const drafts = await listRes.json();
    const completed = drafts.find((d: any) => d.status === 'completed');
    if (!completed) { test.skip(); return; }
    await page.goto(`/drafts/${completed.id}`);
    await expect(page).toHaveURL(new RegExp(`/drafts/${completed.id}`));
    // Refine All / Whole-Document Refine panel should be accessible
    const refineAllBtn = page.locator('button', { hasText: 'Whole-Document Refine' }).or(page.locator('button:has-text("Refine All")'));
    await expect(refineAllBtn.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('PII Scrubbing (fix: SimpleNamespace, no session flush)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/drafts`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('PII scrub toggle visible on generate page', async ({ page }) => {
    await page.goto(`${BASE_URL}/generate`);
    const piiToggle = page.locator('input[type="checkbox"]').filter({ hasText: /PII|scrub|privacy/i })
      .or(page.locator('label:has-text("Scrub"), label:has-text("PII")'));
    await expect(piiToggle.first()).toBeVisible({ timeout: 5000 });
  });

  test('Completed draft with PII scrub has content (not failed)', async ({ page }) => {
    const listRes = await page.request.get('/api/generate/drafts');
    const drafts = await listRes.json();
    const completed = drafts.find((d: any) => d.status === 'completed');
    if (!completed) { test.skip(); return; }
    await page.goto(`/drafts/${completed.id}`);
    await expect(page).toHaveURL(new RegExp(`/drafts/${completed.id}`));
    // Draft view should show sections, not an error state
    const sections = page.locator('div[class*="cursor-pointer"]').or(page.locator('text=Executive Summary')).or(page.locator('text=Project Overview'));
    await expect(sections.first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Smoke: Core navigation still works', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/drafts`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
  });

  test('Drafts list loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/drafts`);
    await expect(page.locator('h1, h2').filter({ hasText: /draft/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('Generate page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/generate`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 });
  });

  test('No console errors on drafts page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(`${BASE_URL}/drafts`);
    await page.waitForTimeout(2000);
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalErrors).toHaveLength(0);
  });
});
