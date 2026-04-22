import { chromium, FullConfig } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

async function globalSetup(config: FullConfig) {
  const baseURL = process.env.BASE_URL || 'https://blue-tip.cloudigan.net'
  const username = process.env.TEST_USER_USERNAME || 'cory'
  const password = process.env.TEST_USER_PASSWORD || ''
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  // Navigate to login and follow redirect to Authentik
  await page.goto(`${baseURL}/login`)
  await page.click('button:has-text("Sign in with Authentik")')
  await page.waitForURL(/auth\.cloudigan\.net/, { timeout: 15000 })

  // Drive the Authentik flow executor API directly (Vue click handlers broken in headless)
  const flowQuery = new URL(page.url()).search.slice(1)
  const apiBase = 'https://auth.cloudigan.net'

  // Step 1: submit username
  await page.evaluate(async ({ apiBase, flowQuery, username }) => {
    await fetch(`${apiBase}/api/v3/flows/executor/default-authentication-flow/?${flowQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ uid_field: username }),
    })
  }, { apiBase, flowQuery, username })

  // Step 2: submit password — returns xak-flow-redirect with to='/'
  const step2: any = await page.evaluate(async ({ apiBase, flowQuery, password }) => {
    const r = await fetch(`${apiBase}/api/v3/flows/executor/default-authentication-flow/?${flowQuery}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    })
    return r.json()
  }, { apiBase, flowQuery, password })

  // Now that the user is authenticated, re-trigger our login endpoint —
  // Authentik will issue the code immediately and redirect to our callback.
  // All three redirect URIs are registered in Authentik; tests target STANDBY.
  await page.goto(`${baseURL}/api/auth/login`)
  // Wait until we land on the app (not Authentik, not the auth callback)
  await page.waitForURL(
    url => !url.href.includes('auth.cloudigan.net') && !url.href.includes('/api/auth'),
    { timeout: 45000 }
  )

  await ctx.storageState({ path: 'auth-state.json' })
  await browser.close()
  console.log('Auth session saved')
}

export default globalSetup
