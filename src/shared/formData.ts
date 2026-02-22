/* ================================================================
   Shared constants, types, and helpers used by FormFill & Preview
   ================================================================ */

export const STORAGE_KEY = 'sunterra_itr_form_data'

export const VISUAL_INSPECTION_ITEMS: readonly string[] = [
  'Equipment installed as per AS/NZS 4777.1:2024 and manufacturer\'s installation manual',
  'Signage installed correctly as per AS/NZS 4777.1:2024 Section 6',
  'Battery storage installed to AS/NZS 5139:2019 and manufacturer\'s installation manual',
  'Cabling, termination and installation comply with AS/NZS 3000',
  'Group and clearly label alternative supply circuits',
  'RCDs are Type A or as specified by the manufacturer',
] as const

export const INSPECTION_TEST_ITEMS: readonly string[] = [
  'Insulation resistance test (Pass value >1 MΩ @500V DC)',
  'Polarity Verification (L, N, E)',
  'Verification of impedance (Earth Fault Loop)',
  'Insulation resistance test of DC',
  'Polarity Verification of DC',
  'DC Voltage to Ground Verification',
] as const

export interface TestResultRowDef {
  readonly from: string
  readonly to: string
  readonly insulationDefault: string
}

export const TEST_RESULTS_ROWS: readonly TestResultRowDef[] = [
  { from: 'Red', to: 'White', insulationDefault: '' },
  { from: 'White', to: 'Blue', insulationDefault: '' },
  { from: 'Blue', to: 'Red', insulationDefault: '' },
  { from: 'Red', to: 'Neutral', insulationDefault: '' },
  { from: 'White', to: 'Neutral', insulationDefault: '' },
  { from: 'Blue', to: 'Neutral', insulationDefault: '' },
  { from: 'Red', to: 'Earth', insulationDefault: '' },
  { from: 'White', to: 'Earth', insulationDefault: '' },
  { from: 'Blue', to: 'Earth', insulationDefault: '' },
  { from: 'Neutral', to: 'Earth', insulationDefault: 'N/A' },
  { from: 'DC Positive 1', to: 'DC Negative 1', insulationDefault: 'N/A' },
  { from: 'DC Positive 2', to: 'DC Negative 2', insulationDefault: 'N/A' },
  { from: 'DC Positive 3', to: 'DC Negative 3', insulationDefault: 'N/A' },
  { from: 'DC Positive 1', to: 'Earth', insulationDefault: '' },
  { from: 'DC Negative 1', to: 'Earth', insulationDefault: '' },
  { from: 'DC Positive 2', to: 'Earth', insulationDefault: '' },
  { from: 'DC Negative 2', to: 'Earth', insulationDefault: '' },
  { from: 'DC Positive 3', to: 'Earth', insulationDefault: '' },
  { from: 'DC Negative 3', to: 'Earth', insulationDefault: '' },
] as const

/* ================================================================
   Serialisation helpers
   ================================================================ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeForStorage(data: Record<string, any>): string {
  return JSON.stringify(data, (_key, value) => {
    if (value instanceof Date) return `__DATE__${value.toISOString()}`
    return value
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deserializeFromStorage(json: string): Record<string, any> {
  return JSON.parse(json, (_key, value) => {
    if (typeof value === 'string' && value.startsWith('__DATE__'))
      return new Date(value.slice(8))
    return value
  })
}

/* ================================================================
   Date formatting
   ================================================================ */

export const formatDate = (date: Date): string => {
  const d = date.getDate().toString().padStart(2, '0')
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

