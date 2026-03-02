/* ================================================================
   Variation Order — shared types, constants, storage & helpers
   ================================================================ */

import { formatDate } from './formData'

/* ================================================================
   Types
   ================================================================ */

/** Single extra work item (dynamic add/remove) */
export interface WorkItem {
  id: string
  description: string
  reason: string
  amount: string
}

/** Full Variation Order form data */
export interface VariationOrderData {
  jobNumber: string
  customerName: string
  installationAddress: string
  date: string

  workItems: WorkItem[]

  installerSignature: string
  customerSignature: string
  signatureDate: string
}

/* ================================================================
   Constants
   ================================================================ */

export const VARIATION_ORDER_STORAGE_KEY = 'sunterra_variation_order_draft'

export function createEmptyWorkItem(): WorkItem {
  return {
    id: Date.now().toString(),
    description: '',
    reason: '',
    amount: '',
  }
}

export function createEmptyVariationOrder(): VariationOrderData {
  const today = formatDate(new Date())
  return {
    jobNumber: '',
    customerName: '',
    installationAddress: '',
    date: today,
    workItems: [],
    installerSignature: '',
    customerSignature: '',
    signatureDate: today,
  }
}

/* ================================================================
   localStorage helpers
   ================================================================ */

export function saveVariationOrder(data: VariationOrderData): void {
  try {
    localStorage.setItem(VARIATION_ORDER_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore quota / private mode
  }
}

export function loadVariationOrder(): VariationOrderData | null {
  try {
    const raw = localStorage.getItem(VARIATION_ORDER_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as VariationOrderData
  } catch {
    return null
  }
}

export function clearVariationOrder(): void {
  try {
    localStorage.removeItem(VARIATION_ORDER_STORAGE_KEY)
  } catch {
    // ignore
  }
}

/* ================================================================
   Calculations & formatting
   ================================================================ */

/**
 * Sum all work item amounts (invalid/non-numeric treated as 0).
 * Amounts are GST-inclusive strings from user input.
 */
export function calculateTotal(workItems: WorkItem[]): number {
  return workItems.reduce((sum, item) => {
    const parsed = parseFloat(String(item.amount).replace(/[^0-9.-]/g, ''))
    return sum + (Number.isFinite(parsed) ? parsed : 0)
  }, 0)
}

/** Format number as AUD, e.g. $1,250.00 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
