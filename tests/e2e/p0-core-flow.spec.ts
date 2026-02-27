import { test, expect } from '@playwright/test'

const TEST_DATA = {
  // Dataset A — full PV+Battery installation, all passing
  fullInstall: {
    address: '14 Murray Street, Prospect SA 5082',
    customer: 'Sarah Mitchell',
    jobNumber: '26103',
    inverter: 'SPH 8000T-HUB',
    battery: 'ALP 30',
    testedBy: 'M. Chen',
    licence: '301445',
    nameCapitals: 'MC',
  },
  // Dataset D — minimal required fields only
  minimal: {
    address: '1 Test Ave, Adelaide SA 5000',
    customer: 'Test User',
    jobNumber: '99999',
  },
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('form page loads with Sunterra branding', async ({ page }) => {
  // Verify logo is visible
  await expect(page.locator('img[alt="Sunterra"]')).toBeVisible()
  // Verify title
  await expect(page.locator('text=Inspection and Test Record')).toBeVisible()
  // Verify all 9 section headers are present
  await expect(page.locator('text=1. Project Information')).toBeVisible()
  await expect(page.locator('text=9. Sign-off')).toBeVisible()
  // Verify Submit button exists
  await expect(page.locator('text=Preview & Submit')).toBeVisible()
})

test('submit is blocked when required fields are empty', async ({ page }) => {
  // Fill only address, leave customer and job number empty
  await page
    .locator('input[placeholder="Enter installation address"]')
    .fill(TEST_DATA.minimal.address)
  await page.waitForTimeout(300)
  // Click submit
  await page.waitForSelector('text=Preview & Submit', { state: 'visible' })
  await page.click('text=Preview & Submit')
  // Should show error toast mentioning missing fields
  await expect(page.locator('text=Please fill in')).toBeVisible()
  // Should still be on the form page, not navigated to preview
  await expect(page).toHaveURL('/')
})

test('submit is blocked with partial required fields', async ({ page }) => {
  // Fill address and customer, leave job number empty
  await page
    .locator('input[placeholder="Enter installation address"]')
    .fill(TEST_DATA.minimal.address)
  await page.waitForTimeout(300)
  await page
    .locator('input[placeholder="Enter customer name"]')
    .fill(TEST_DATA.minimal.customer)
  await page.waitForTimeout(300)
  await page.waitForSelector('text=Preview & Submit', { state: 'visible' })
  await page.click('text=Preview & Submit')
  await expect(page.locator('text=Please fill in')).toBeVisible()
  await expect(page).toHaveURL('/')
})

test('filling required fields and submitting navigates to preview', async ({
  page,
}) => {
  await page
    .locator('input[placeholder="Enter installation address"]')
    .fill(TEST_DATA.minimal.address)
  await page.waitForTimeout(300)
  await page
    .locator('input[placeholder="Enter customer name"]')
    .fill(TEST_DATA.minimal.customer)
  await page.waitForTimeout(300)
  await page
    .locator('input[placeholder="Enter job number"]')
    .fill(TEST_DATA.minimal.jobNumber)
  await page.waitForTimeout(300)
  await page.waitForSelector('text=Preview & Submit', { state: 'visible' })
  await page.click('text=Preview & Submit')
  // Should navigate to preview
  await page.waitForURL('/preview', { timeout: 15000 })
})

test('preview page shows the submitted form data', async ({ page }, testInfo) => {
  // Fill form with Dataset A full data
  await page
    .locator('input[placeholder="Enter installation address"]')
    .fill(TEST_DATA.fullInstall.address)
  await page.waitForTimeout(300)
  await page
    .locator('input[placeholder="Enter customer name"]')
    .fill(TEST_DATA.fullInstall.customer)
  await page.waitForTimeout(300)
  await page
    .locator('input[placeholder="Enter job number"]')
    .fill(TEST_DATA.fullInstall.jobNumber)
  await page.waitForTimeout(300)
  await page
    .locator('input[placeholder*="SPH"]')
    .fill(TEST_DATA.fullInstall.inverter)
  await page.waitForTimeout(300)
  await page.locator('input[placeholder*="ALP"]').fill(TEST_DATA.fullInstall.battery)
  await page.waitForTimeout(300)
  // Submit
  await page.waitForSelector('text=Preview & Submit', { state: 'visible' })
  await page.click('text=Preview & Submit')
  await page.waitForURL('/preview', { timeout: 15000 })
  // Verify data is displayed on preview
  await expect(
    page.locator(`text=${TEST_DATA.fullInstall.address}`),
  ).toBeVisible()
  await expect(
    page.locator(`text=${TEST_DATA.fullInstall.customer}`),
  ).toBeVisible()
  await expect(
    page.locator(`text=${TEST_DATA.fullInstall.jobNumber}`),
  ).toBeVisible()
  await expect(
    page.locator(`text=${TEST_DATA.fullInstall.inverter}`),
  ).toBeVisible()
  await expect(
    page.locator(`text=${TEST_DATA.fullInstall.battery}`),
  ).toBeVisible()
  // Scroll to bottom to reveal action buttons
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  // Button labels differ by screen size
  const isMobile = testInfo.project.name.includes('iPhone')
  if (isMobile) {
    // Mobile uses short labels
    await expect(page.locator('button:has-text("Back")').first()).toBeVisible()
    await expect(page.locator('button:has-text("PDF")').first()).toBeVisible()
  } else {
    await expect(page.locator('text=Back to Edit')).toBeVisible()
    await expect(page.locator('text=Download PDF')).toBeVisible()
  }
})

test('download PDF generates a file', async ({ page }, testInfo) => {
  // Skip on mobile WebKit — html2canvas is too slow
  test.skip(
    testInfo.project.name.includes('iPhone'),
    'PDF generation too slow on mobile WebKit emulation',
  )
  // Fill minimal required fields and submit
  await page
    .locator('input[placeholder="Enter installation address"]')
    .fill(TEST_DATA.minimal.address)
  await page.waitForTimeout(300)
  await page
    .locator('input[placeholder="Enter customer name"]')
    .fill(TEST_DATA.minimal.customer)
  await page.waitForTimeout(300)
  await page
    .locator('input[placeholder="Enter job number"]')
    .fill(TEST_DATA.minimal.jobNumber)
  await page.waitForTimeout(300)
  await page.waitForSelector('text=Preview & Submit', { state: 'visible' })
  await page.click('text=Preview & Submit')
  await page.waitForURL('/preview', { timeout: 15000 })
  // Listen for download event
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 })
  await page.waitForSelector('text=Download PDF', { state: 'visible' })
  await page.waitForTimeout(1000)
  await page.click('text=Download PDF')
  const download = await downloadPromise
  // Verify filename pattern: ITR_TestUser_99999_*.pdf (or ITR_Test_User_99999_* — spaces become underscores)
  expect(download.suggestedFilename()).toMatch(/ITR.*99999.*\.pdf/)
})
