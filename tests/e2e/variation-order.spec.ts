import { test, expect } from '@playwright/test'
import { mkdirSync } from 'fs'
try { mkdirSync('test-results/preview-screenshots', { recursive: true }) } catch {}

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
  await page.screenshot({
    path: `test-results/preview-screenshots/${testInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
    fullPage: true,
  })
})

test('add and remove work items', async ({ page }) => {
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
  await page.getByPlaceholder('0.00').first().fill('385')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '+ Add Item' }).click()
  await page.waitForTimeout(300)
  await page.getByPlaceholder('0.00').nth(1).fill('195')
  await page.waitForTimeout(300)
  await expect(page.locator('.vo-total-value')).toHaveText('$580.00')
})

test('clear form clears data and survives reload', async ({ page }) => {
  await page.getByPlaceholder('Enter job number').fill('TEST-CLEAR-001')
  await page.waitForTimeout(700)

  await page.getByText('Clear Form').click()
  await page.locator('.adm-dialog-button').filter({ hasText: 'Clear' }).click()
  await page.waitForTimeout(600)

  await expect(page.getByPlaceholder('Enter job number')).toHaveValue('')

  await page.reload()
  await page.waitForTimeout(600)
  await expect(page.getByPlaceholder('Enter job number')).toHaveValue('')
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

test('amount field only accepts numbers and decimal point', async ({ page }) => {
  const amountInput = page.getByPlaceholder('0.00').first()
  await amountInput.fill('abc123.45xyz')
  await page.waitForTimeout(300)
  // filterAmountValue should filter out non-numeric characters
  await expect(amountInput).toHaveValue('123.45')
})

test('localStorage auto-save works', async ({ page }) => {
  await page.getByPlaceholder('Enter job number').fill('AUTO-SAVE-TEST')
  await page.waitForTimeout(800) // wait for 500ms debounce + buffer

  // refresh directly without clicking any button
  await page.reload()
  await page.waitForTimeout(500)

  // data should persist
  await expect(page.getByPlaceholder('Enter job number')).toHaveValue('AUTO-SAVE-TEST')
})

test('back to edit from preview preserves data', async ({ page }) => {
  // fill data and submit to preview
  await page.getByPlaceholder('Enter job number').fill(VO_TEST_DATA.jobNumber)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('Enter installation address').fill(VO_TEST_DATA.installationAddress)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('Brief description of extra work').first().fill(VO_TEST_DATA.workItem1.description)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('0.00').first().fill(VO_TEST_DATA.workItem1.amount)
  await page.waitForTimeout(300)

  // signature
  const customerCanvas = page.locator('.sig-canvas').nth(1)
  await customerCanvas.scrollIntoViewIfNeeded()
  const box = await customerCanvas.boundingBox()
  if (!box) return
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 15)
  await page.mouse.up()
  await page.waitForTimeout(200)
  await page.locator('.sig-wrapper').nth(1).locator('button:has-text("Confirm")').click()
  await page.waitForTimeout(300)

  await page.click('text=Preview & Submit')
  await page.waitForURL('/variation-order/preview', { timeout: 15000 })

  // click back to edit
  await page.locator('button:has-text("Back")').first().click()
  await page.waitForURL('/variation-order', { timeout: 10000 })

  // data should still persist
  await expect(page.getByPlaceholder('Enter job number')).toHaveValue(VO_TEST_DATA.jobNumber)
  await expect(page.getByPlaceholder('Enter installation address')).toHaveValue(VO_TEST_DATA.installationAddress)
})

test('preview redirects to form when no data', async ({ page }) => {
  // clear localStorage then visit preview directly
  await page.evaluate(() => localStorage.clear())
  await page.goto('/variation-order/preview')
  // should redirect back to form
  await page.waitForURL('/variation-order', { timeout: 10000 })
})

test('multiple work items show in preview', async ({ page }, testInfo) => {
  // fill basic information
  await page.getByPlaceholder('Enter job number').fill(VO_TEST_DATA.jobNumber)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('Enter installation address').fill(VO_TEST_DATA.installationAddress)
  await page.waitForTimeout(300)

  // first item
  await page.getByPlaceholder('Brief description of extra work').first().fill(VO_TEST_DATA.workItem1.description)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('0.00').first().fill(VO_TEST_DATA.workItem1.amount)
  await page.waitForTimeout(300)

  // add second item
  await page.getByRole('button', { name: '+ Add Item' }).click()
  await page.waitForTimeout(300)
  await page.getByPlaceholder('Brief description of extra work').nth(1).fill(VO_TEST_DATA.workItem2.description)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('0.00').nth(1).fill(VO_TEST_DATA.workItem2.amount)
  await page.waitForTimeout(300)

  // signature
  const customerCanvas = page.locator('.sig-canvas').nth(1)
  await customerCanvas.scrollIntoViewIfNeeded()
  const box = await customerCanvas.boundingBox()
  if (!box) return
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 15)
  await page.mouse.up()
  await page.waitForTimeout(200)
  await page.locator('.sig-wrapper').nth(1).locator('button:has-text("Confirm")').click()
  await page.waitForTimeout(300)

  await page.click('text=Preview & Submit')
  await page.waitForURL('/variation-order/preview', { timeout: 15000 })

  // both items should appear
  await expect(page.locator(`text=${VO_TEST_DATA.workItem1.description}`)).toBeVisible()
  await expect(page.locator(`text=${VO_TEST_DATA.workItem2.description}`)).toBeVisible()
  // total should be $580.00
  await expect(page.locator('.vop-total-value')).toHaveText('$580.00')
  await page.screenshot({
    path: `test-results/preview-screenshots/${testInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
    fullPage: true,
  })
})

/* ================================================================
   Edge cases & boundary tests
   ================================================================ */

test('description respects maxLength 200', async ({ page }) => {
  const longText = 'A'.repeat(250)
  await page.getByPlaceholder('Brief description of extra work').first().fill(longText)
  await page.waitForTimeout(300)
  // TextArea maxLength=200, should be truncated to 200 chars
  const value = await page.getByPlaceholder('Brief description of extra work').first().inputValue()
  expect(value.length).toBeLessThanOrEqual(200)
})

test('special characters in fields display correctly in preview', async ({ page }, testInfo) => {
  const specialAddress = '15/2A O\'Brien St, "Unit 3" & Co. <Test>'
  const specialDesc = 'Replace panel — cost $50/m² (inc. GST) & remove "old" unit'

  await page.getByPlaceholder('Enter job number').fill('JOB-#123/A')
  await page.waitForTimeout(300)
  await page.getByPlaceholder('Enter installation address').fill(specialAddress)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('Brief description of extra work').first().fill(specialDesc)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('0.00').first().fill('150')
  await page.waitForTimeout(300)

  // signature
  const customerCanvas = page.locator('.sig-canvas').nth(1)
  await customerCanvas.scrollIntoViewIfNeeded()
  const box = await customerCanvas.boundingBox()
  if (!box) return
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 15)
  await page.mouse.up()
  await page.waitForTimeout(200)
  await page.locator('.sig-wrapper').nth(1).locator('button:has-text("Confirm")').click()
  await page.waitForTimeout(300)

  await page.click('text=Preview & Submit')
  await page.waitForURL('/variation-order/preview', { timeout: 15000 })

  // special chars should display correctly in preview
  await expect(page.getByText('JOB-#123/A')).toBeVisible()
  await expect(page.getByText(specialDesc)).toBeVisible()
  await page.screenshot({
    path: `test-results/preview-screenshots/${testInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
    fullPage: true,
  })
})

test('amount edge cases', async ({ page }) => {
  const amountInput = page.getByPlaceholder('0.00').first()

  // multiple decimal points — only first dot kept (filter collapses extra dots)
  await amountInput.fill('12.34.56')
  await page.waitForTimeout(300)
  await expect(amountInput).toHaveValue('12.3456')

  // zero
  await amountInput.fill('0')
  await page.waitForTimeout(300)
  await expect(page.locator('.vo-total-value')).toHaveText('$0.00')

  // large amount
  await amountInput.fill('999999.99')
  await page.waitForTimeout(300)
  await expect(page.locator('.vo-total-value')).toHaveText('$999,999.99')

  // empty — total $0.00
  await amountInput.fill('')
  await page.waitForTimeout(300)
  await expect(page.locator('.vo-total-value')).toHaveText('$0.00')
})

test('rapid add and remove items does not break state', async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: '+ Add Item' }).click()
  }
  await page.waitForTimeout(500)
  await expect(page.locator('.vo-work-item')).toHaveCount(6) // 1 default + 5 added

  while ((await page.locator('button:has-text("Remove")').count()) > 0) {
    await page.locator('button:has-text("Remove")').first().click()
    await page.waitForTimeout(100)
  }
  await page.waitForTimeout(300)
  await expect(page.locator('.vo-work-item')).toHaveCount(1)
  await expect(page.locator('button:has-text("Remove")')).not.toBeVisible()
})

test('very long address wraps in preview', async ({ page }, testInfo) => {
  const longAddress = 'Unit 42, Level 3, Building A, 123-456 Very Long Street Name Boulevard, Suburb With A Really Long Name, South Australia 5000, Australia'

  await page.getByPlaceholder('Enter job number').fill('LONG-ADDR-001')
  await page.waitForTimeout(300)
  await page.getByPlaceholder('Enter installation address').fill(longAddress)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('Brief description of extra work').first().fill('Test')
  await page.waitForTimeout(300)
  await page.getByPlaceholder('0.00').first().fill('100')
  await page.waitForTimeout(300)

  const customerCanvas = page.locator('.sig-canvas').nth(1)
  await customerCanvas.scrollIntoViewIfNeeded()
  const box = await customerCanvas.boundingBox()
  if (!box) return
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 15)
  await page.mouse.up()
  await page.waitForTimeout(200)
  await page.locator('.sig-wrapper').nth(1).locator('button:has-text("Confirm")').click()
  await page.waitForTimeout(300)

  await page.click('text=Preview & Submit')
  await page.waitForURL('/variation-order/preview', { timeout: 15000 })

  await expect(page.getByText(longAddress)).toBeVisible()
  const hasOverflow = await page.evaluate(() => {
    const el = document.querySelector('.vop-content')
    return el ? el.scrollWidth > el.clientWidth : false
  })
  expect(hasOverflow).toBe(false)
  await page.screenshot({
    path: `test-results/preview-screenshots/${testInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
    fullPage: true,
  })
})

/* ================================================================
   Preview robustness & edge cases — batch 2
   ================================================================ */

// Helper: fill required fields, sign, and submit to preview
async function fillAndSubmitToPreview(
  page: import('@playwright/test').Page,
  overrides: {
    jobNumber?: string
    address?: string
    items?: { description: string; amount: string }[]
  } = {},
) {
  const job = overrides.jobNumber ?? 'TEST-001'
  const addr = overrides.address ?? '1 Test St, Adelaide SA 5000'
  const items = overrides.items ?? [{ description: 'Test work', amount: '100' }]

  await page.getByPlaceholder('Enter job number').fill(job)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('Enter installation address').fill(addr)
  await page.waitForTimeout(300)

  // Fill first item
  await page.getByPlaceholder('Brief description of extra work').first().fill(items[0].description)
  await page.waitForTimeout(300)
  await page.getByPlaceholder('0.00').first().fill(items[0].amount)
  await page.waitForTimeout(300)

  // Add remaining items
  for (let i = 1; i < items.length; i++) {
    await page.getByRole('button', { name: '+ Add Item' }).click()
    await page.waitForTimeout(300)
    await page.getByPlaceholder('Brief description of extra work').nth(i).fill(items[i].description)
    await page.waitForTimeout(300)
    await page.getByPlaceholder('0.00').nth(i).fill(items[i].amount)
    await page.waitForTimeout(300)
  }

  // Customer signature
  const customerCanvas = page.locator('.sig-canvas').nth(1)
  await customerCanvas.scrollIntoViewIfNeeded()
  const box = await customerCanvas.boundingBox()
  if (!box) throw new Error('Canvas not found')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 15)
  await page.mouse.up()
  await page.waitForTimeout(200)
  await page.locator('.sig-wrapper').nth(1).locator('button:has-text("Confirm")').click()
  await page.waitForTimeout(300)

  await page.click('text=Preview & Submit')
  await page.waitForURL('/variation-order/preview', { timeout: 15000 })
}

test('preview handles 10 work items without layout break', async ({ page }, testInfo) => {
  const items = Array.from({ length: 10 }, (_, i) => ({
    description: `Work item number ${i + 1} - extra task on site`,
    amount: String((i + 1) * 50),
  }))

  await fillAndSubmitToPreview(page, { items })

  // All 10 items should be visible
  await expect(page.locator('.vop-work-table tbody tr')).toHaveCount(10)

  // Total should be 50+100+150+...+500 = 2750
  await expect(page.locator('.vop-total-value')).toHaveText('$2,750.00')

  // No horizontal overflow
  const hasOverflow = await page.evaluate(() => {
    const el = document.querySelector('.vop-content')
    return el ? el.scrollWidth > el.clientWidth : false
  })
  expect(hasOverflow).toBe(false)
  await page.screenshot({
    path: `test-results/preview-screenshots/${testInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
    fullPage: true,
  })
})

test('preview handles max length description in table', async ({ page }, testInfo) => {
  const maxDesc = 'X'.repeat(200)
  await fillAndSubmitToPreview(page, {
    items: [{ description: maxDesc, amount: '500' }],
  })

  // Description should be visible and wrapped, not overflowing
  const descCell = page.locator('.vop-work-table tbody td').nth(1)
  await expect(descCell).toBeVisible()
  const cellText = await descCell.textContent()
  expect(cellText?.length).toBeGreaterThanOrEqual(200)

  // Table should not overflow
  const hasOverflow = await page.evaluate(() => {
    const table = document.querySelector('.vop-work-table')
    return table ? table.scrollWidth > table.clientWidth + 2 : false
  })
  expect(hasOverflow).toBe(false)
  await page.screenshot({
    path: `test-results/preview-screenshots/${testInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
    fullPage: true,
  })
})

test('preview handles unicode and emoji in fields', async ({ page }, testInfo) => {
  await fillAndSubmitToPreview(page, {
    jobNumber: 'JOB-日本語-001',
    address: '東京都渋谷区 123号',
    items: [{ description: 'Réparation tuyau — naïve café résumé', amount: '200' }],
  })

  await expect(page.locator('text=JOB-日本語-001')).toBeVisible()
  await expect(page.locator('text=東京都渋谷区')).toBeVisible()
  await expect(page.locator('text=Réparation tuyau')).toBeVisible()
  await page.screenshot({
    path: `test-results/preview-screenshots/${testInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
    fullPage: true,
  })
})

test('preview handles zero dollar amounts correctly', async ({ page }, testInfo) => {
  await fillAndSubmitToPreview(page, {
    items: [
      { description: 'Free inspection - no charge', amount: '0' },
      { description: 'Paid work', amount: '250' },
    ],
  })

  // Should show $0.00 for first item
  await expect(
    page.locator('.vop-work-table tbody .vop-cell-amount').first(),
  ).toHaveText('$0.00')

  // Total should be $250.00
  await expect(page.locator('.vop-total-value')).toHaveText('$250.00')
  await page.screenshot({
    path: `test-results/preview-screenshots/${testInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
    fullPage: true,
  })
})

test('preview handles decimal amounts precisely', async ({ page }, testInfo) => {
  await fillAndSubmitToPreview(page, {
    items: [
      { description: 'Labour', amount: '149.95' },
      { description: 'Materials', amount: '83.50' },
    ],
  })

  // Check individual amounts
  await expect(
    page.locator('.vop-work-table tbody .vop-cell-amount').first(),
  ).toHaveText('$149.95')
  await expect(
    page.locator('.vop-work-table tbody .vop-cell-amount').nth(1),
  ).toHaveText('$83.50')

  // Total should be $233.45 — check floating point precision
  await expect(page.locator('.vop-total-value')).toHaveText('$233.45')
  await page.screenshot({
    path: `test-results/preview-screenshots/${testInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`,
    fullPage: true,
  })
})

test('preview PDF download works with special characters in job number', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name.includes('iPhone'),
    'PDF generation too slow on mobile WebKit emulation',
  )

  await fillAndSubmitToPreview(page, {
    jobNumber: 'JOB/2026#001 (test)',
    items: [{ description: 'Test', amount: '100' }],
  })

  const downloadPromise = page.waitForEvent('download', { timeout: 60000 })
  await page.waitForTimeout(1000)
  await page.locator('button:has-text("PDF")').first().click()
  const download = await downloadPromise

  // Filename should have special chars sanitised
  const filename = download.suggestedFilename()
  expect(filename).toMatch(/^VO_.*\.pdf$/)
  // Should not contain slashes or brackets in filename
  expect(filename).not.toMatch(/[\/\\()#]/)
})

test('preview displays reason for change correctly', async ({ page }) => {
  // Inject complete draft with reasons directly into localStorage
  const testData = {
    jobNumber: 'REASON-TEST-001',
    installationAddress: '10 Test Ave, Adelaide SA 5000',
    date: '03/03/2026',
    workItems: [
      {
        id: '1',
        description: 'Relocate meter box',
        reason: 'Site condition',
        amount: '385',
      },
      {
        id: '2',
        description: 'Install extra isolator',
        reason: 'Compliance requirement',
        amount: '195',
      },
      {
        id: '3',
        description: 'Custom cable routing',
        reason: 'Other: Homeowner requested specific path along fence line',
        amount: '250',
      },
    ],
    installerSignature: '',
    customerSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    signatureDate: '03/03/2026',
  }

  await page.evaluate((data) => {
    localStorage.setItem('sunterra_variation_order_draft', JSON.stringify(data))
  }, testData)

  // Open preview directly
  await page.goto('/variation-order/preview')
  await page.waitForTimeout(500)

  // Reason column should be visible
  await expect(page.locator('th:has-text("Reason for Change")')).toBeVisible()

  // Reasons should render correctly
  await expect(page.locator('text=Site condition')).toBeVisible()
  await expect(page.locator('text=Compliance requirement')).toBeVisible()
  await expect(page.locator('text=Other: Homeowner requested specific path along fence line')).toBeVisible()

  // Amount and total check
  await expect(page.locator('.vop-total-value')).toHaveText('$830.00')

  // Screenshot for manual review
  await page.screenshot({
    path: 'test-results/preview-screenshots/reason_for_change_display.png',
    fullPage: true,
  })
})

test('preview displays dash when reason is empty', async ({ page }) => {
  const testData = {
    jobNumber: 'NO-REASON-001',
    installationAddress: '20 Test St, Adelaide SA 5000',
    date: '03/03/2026',
    workItems: [
      {
        id: '1',
        description: 'Quick fix on site',
        reason: '',
        amount: '100',
      },
    ],
    installerSignature: '',
    customerSignature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    signatureDate: '03/03/2026',
  }

  await page.evaluate((data) => {
    localStorage.setItem('sunterra_variation_order_draft', JSON.stringify(data))
  }, testData)

  await page.goto('/variation-order/preview')
  await page.waitForTimeout(500)

  // Empty reason should render dash
  const reasonCell = page.locator('.vop-work-table tbody tr').first().locator('td').nth(2)
  await expect(reasonCell).toHaveText('—')

  await page.screenshot({
    path: 'test-results/preview-screenshots/reason_empty_dash.png',
    fullPage: true,
  })
})

test('reason value persists after form reload', async ({ page }) => {
  // Inject draft with reason into localStorage
  const testData = {
    jobNumber: 'PERSIST-001',
    installationAddress: '30 Test Rd, Adelaide SA 5000',
    date: '03/03/2026',
    workItems: [
      {
        id: '1',
        description: 'Test persistence',
        reason: 'Customer request',
        amount: '200',
      },
    ],
    installerSignature: '',
    customerSignature: '',
    signatureDate: '03/03/2026',
  }

  await page.evaluate((data) => {
    localStorage.setItem('sunterra_variation_order_draft', JSON.stringify(data))
  }, testData)

  // Open form page
  await page.goto('/variation-order')
  await page.waitForTimeout(500)

  // Reason trigger should show value rather than placeholder
  await expect(page.locator('.vo-reason-trigger').first()).toContainText('Customer request')

  // Should persist after reload
  await page.reload()
  await page.waitForTimeout(500)
  await expect(page.locator('.vo-reason-trigger').first()).toContainText('Customer request')
})
