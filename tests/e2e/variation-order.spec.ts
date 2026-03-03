import { test, expect } from '@playwright/test'

const VO_TEST_DATA = {
  jobNumber: 'SUN-2026-0847',
  installationAddress: '15 Maple Street, Prospect SA 5082',
  workItem1: {
    description: 'Relocate meter box DB to allow panel cabling entry',
    reason: 'Site condition',
    amount: '385',
  },
  workItem2: {
    description: 'Install additional AC isolator on north wall',
    reason: 'Compliance requirement',
    amount: '195',
  },
}

test.beforeEach(async ({ page }) => {
  await page.goto('/variation-order')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

async function addFirstWorkItem(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '+ Add Item' }).click()
  await expect(page.locator('.vo-work-item')).toHaveCount(1)
}

test('variation order form page loads', async ({ page }) => {
  await page.goto('/variation-order')
  await expect(page.locator('text=Variation Order')).toBeVisible()
  await expect(page.locator('text=Extra Work Authorisation')).toBeVisible()
  await expect(page.locator('text=1. Project Information')).toBeVisible()
  await expect(page.locator('text=2. Extra Work Details')).toBeVisible()
  await expect(page.locator('text=3. Sign-off')).toBeVisible()
  await expect(page.locator('text=Preview & Submit')).toBeVisible()
})

test('submit is blocked when required fields are empty', async ({ page }) => {
  await page.waitForSelector('text=Preview & Submit', { state: 'visible' })
  await page.click('text=Preview & Submit')
  await expect(page.getByText(/required|Please/).first()).toBeVisible({ timeout: 8000 })
  await expect(page).toHaveURL('/variation-order')
})

test('submit is blocked without customer signature', async ({ page }) => {
  await page.getByPlaceholder('Enter job number').fill(VO_TEST_DATA.jobNumber)
  await page.waitForTimeout(300)
  await page
    .getByPlaceholder('Enter installation address')
    .fill(VO_TEST_DATA.installationAddress)
  await page.waitForTimeout(300)
  await addFirstWorkItem(page)
  await page
    .getByPlaceholder('Brief description of extra work')
    .first()
    .fill(VO_TEST_DATA.workItem1.description)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('0.00').first().fill(VO_TEST_DATA.workItem1.amount)
  await page.waitForTimeout(300)
  await page.waitForSelector('text=Preview & Submit', { state: 'visible' })
  await page.click('text=Preview & Submit')
  await expect(
    page.getByText('Customer signature is required'),
  ).toBeVisible({ timeout: 8000 })
  await expect(page).toHaveURL('/variation-order')
})

test('filling required fields and submitting navigates to preview', async ({
  page,
}) => {
  await page.getByPlaceholder('Enter job number').fill(VO_TEST_DATA.jobNumber)
  await page.waitForTimeout(300)
  await page
    .getByPlaceholder('Enter installation address')
    .fill(VO_TEST_DATA.installationAddress)
  await page.waitForTimeout(300)
  await addFirstWorkItem(page)
  await page
    .getByPlaceholder('Brief description of extra work')
    .first()
    .fill(VO_TEST_DATA.workItem1.description)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('0.00').first().fill(VO_TEST_DATA.workItem1.amount)
  await page.waitForTimeout(300)

  const customerCanvas = page.locator('.sig-canvas').nth(1)
  await customerCanvas.scrollIntoViewIfNeeded()
  const box = await customerCanvas.boundingBox()
  expect(box).toBeTruthy()
  if (!box) return
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 15)
  await page.mouse.up()
  await page.waitForTimeout(200)
  await page.locator('.sig-wrapper').nth(1).locator('button:has-text("Confirm")').click()
  await page.waitForTimeout(300)

  await page.waitForSelector('text=Preview & Submit', { state: 'visible' })
  await page.click('text=Preview & Submit')
  await page.waitForURL('/variation-order/preview', { timeout: 15000 })
})

test('preview page shows submitted data', async ({ page }, testInfo) => {
  await page.getByPlaceholder('Enter job number').fill(VO_TEST_DATA.jobNumber)
  await page.waitForTimeout(300)
  await page
    .getByPlaceholder('Enter installation address')
    .fill(VO_TEST_DATA.installationAddress)
  await page.waitForTimeout(300)
  await addFirstWorkItem(page)
  await page
    .getByPlaceholder('Brief description of extra work')
    .first()
    .fill(VO_TEST_DATA.workItem1.description)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('0.00').first().fill(VO_TEST_DATA.workItem1.amount)
  await page.waitForTimeout(300)

  const customerCanvas = page.locator('.sig-canvas').nth(1)
  await customerCanvas.scrollIntoViewIfNeeded()
  const box = await customerCanvas.boundingBox()
  expect(box).toBeTruthy()
  if (!box) return
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 15)
  await page.mouse.up()
  await page.waitForTimeout(200)
  await page.locator('.sig-wrapper').nth(1).locator('button:has-text("Confirm")').click()
  await page.waitForTimeout(300)

  await page.waitForSelector('text=Preview & Submit', { state: 'visible' })
  await page.click('text=Preview & Submit')
  await page.waitForURL('/variation-order/preview', { timeout: 15000 })

  await expect(page.locator('.vop-doc-label')).toHaveText('VARIATION ORDER')
  await expect(page.locator(`text=${VO_TEST_DATA.jobNumber}`)).toBeVisible()
  await expect(
    page.locator(`text=${VO_TEST_DATA.installationAddress}`),
  ).toBeVisible()
  await expect(
    page.locator(`text=${VO_TEST_DATA.workItem1.description}`),
  ).toBeVisible()
  await expect(
    page.locator('.vop-work-table tbody .vop-cell-amount').first(),
  ).toHaveText('$385.00')

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  const isMobile = testInfo.project.name.includes('iPhone')
  if (isMobile) {
    await expect(page.locator('button:has-text("Back")').first()).toBeVisible()
    await expect(page.locator('button:has-text("PDF")').first()).toBeVisible()
  } else {
    await expect(page.locator('text=Back to Edit')).toBeVisible()
    await expect(
      page.locator('button:has-text("Download PDF"), button:has-text("PDF")').first(),
    ).toBeVisible()
  }
})

test('add and remove work items', async ({ page }) => {
  await expect(page.locator('.vo-work-item')).toHaveCount(0)
  await expect(page.locator('button:has-text("Remove")')).not.toBeVisible()

  await page.getByRole('button', { name: '+ Add Item' }).click()
  await page.waitForTimeout(300)
  await expect(page.locator('.vo-work-item-number:has-text("#1")')).toBeVisible()
  await expect(page.locator('.vo-work-item')).toHaveCount(1)
  await expect(page.locator('button:has-text("Remove")')).not.toBeVisible()

  await page.getByRole('button', { name: '+ Add Item' }).click()
  await page.waitForTimeout(300)
  await expect(page.locator('.vo-work-item-number:has-text("#2")')).toBeVisible()
  await expect(page.locator('.vo-work-item')).toHaveCount(2)

  await page.getByRole('button', { name: '+ Add Item' }).click()
  await page.waitForTimeout(300)
  await expect(page.locator('.vo-work-item-number:has-text("#3")')).toBeVisible()
  await expect(page.locator('.vo-work-item')).toHaveCount(3)

  await page
    .locator('.vo-work-item')
    .nth(1)
    .locator('button:has-text("Remove")')
    .click()
  await page.waitForTimeout(300)
  await expect(page.locator('.vo-work-item')).toHaveCount(2)
  await expect(page.locator('.vo-work-item-number:has-text("#1")')).toBeVisible()
  await expect(page.locator('.vo-work-item-number:has-text("#2")')).toBeVisible()

  await page.locator('.vo-work-item').nth(1).locator('button:has-text("Remove")').click()
  await page.waitForTimeout(300)
  await expect(page.locator('.vo-work-item')).toHaveCount(1)
  await expect(page.locator('button:has-text("Remove")')).not.toBeVisible()
})

test('total calculates correctly', async ({ page }) => {
  await addFirstWorkItem(page)
  await page.getByPlaceholder('0.00').first().fill('385')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '+ Add Item' }).click()
  await page.waitForTimeout(300)
  await page.getByPlaceholder('0.00').nth(1).fill('195')
  await page.waitForTimeout(300)
  await expect(page.locator('.vo-total-value')).toHaveText('$580.00')
})

// Ant Design Mobile Picker opens a bottom popup; in Playwright the popup is hard to interact
// with (timing, portal selectors). Skip until we have a reliable way to select an option.
test.skip('reason picker works', async ({ page }) => {
  await page.goto('/variation-order')
  await page.locator('.vo-reason-trigger.placeholder').first().click()
  await page.waitForTimeout(500)
  await page.locator('.adm-picker-view-option').filter({ hasText: 'Site condition' }).click()
  await page.locator('.adm-picker-header-button').filter({ hasText: 'Confirm' }).click()
  await expect(page.locator('.vo-reason-trigger').first()).toContainText('Site condition')
})

test('download PDF generates a file', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name.includes('iPhone'),
    'PDF generation too slow on mobile WebKit emulation',
  )
  await page.getByPlaceholder('Enter job number').fill(VO_TEST_DATA.jobNumber)
  await page.waitForTimeout(300)
  await page
    .getByPlaceholder('Enter installation address')
    .fill(VO_TEST_DATA.installationAddress)
  await page.waitForTimeout(300)
  await addFirstWorkItem(page)
  await page
    .getByPlaceholder('Brief description of extra work')
    .first()
    .fill(VO_TEST_DATA.workItem1.description)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('0.00').first().fill(VO_TEST_DATA.workItem1.amount)
  await page.waitForTimeout(300)

  const customerCanvas = page.locator('.sig-canvas').nth(1)
  await customerCanvas.scrollIntoViewIfNeeded()
  const box = await customerCanvas.boundingBox()
  expect(box).toBeTruthy()
  if (!box) return
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 15)
  await page.mouse.up()
  await page.waitForTimeout(200)
  await page.locator('.sig-wrapper').nth(1).locator('button:has-text("Confirm")').click()
  await page.waitForTimeout(300)

  await page.waitForSelector('text=Preview & Submit', { state: 'visible' })
  await page.click('text=Preview & Submit')
  await page.waitForURL('/variation-order/preview', { timeout: 15000 })

  const downloadPromise = page.waitForEvent('download', { timeout: 60000 })
  await page.waitForSelector('button:has-text("PDF")', { state: 'visible' })
  await page.waitForTimeout(1000)
  await page.locator('button:has-text("PDF")').first().click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^VO_.*\.pdf$/)
})
