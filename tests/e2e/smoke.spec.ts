import { test, expect } from '@playwright/test'

test('form page loads successfully', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=Inspection and Test Record')).toBeVisible()
})
