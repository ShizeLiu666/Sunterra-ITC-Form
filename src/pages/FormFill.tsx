import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Form,
  Input,
  TextArea,
  Selector,
  DatePicker,
  Button,
  Radio,
  Space,
  Toast,
  Dialog,
} from 'antd-mobile'
import sunteraLogo from '../assets/Sunterra_Logo.png'
import SignaturePad from '../components/SignaturePad'
import type { SignaturePadHandle } from '../components/SignaturePad'
import {
  STORAGE_KEY,
  VISUAL_INSPECTION_ITEMS,
  INSPECTION_TEST_ITEMS,
  TEST_RESULTS_ROWS,
  serializeForStorage,
  deserializeFromStorage,
  formatDate,
} from '../shared/formData'
import type { TestResultRowDef } from '../shared/formData'
import './FormFill.css'

/* ================================================================
   Local constants
   ================================================================ */

const RESULT_OPTIONS = [
  { label: '✓ Acceptable', value: 'acceptable' },
  { label: '✕ Defect', value: 'defect' },
  { label: 'N/A', value: 'na' },
]

const ENERGY_SOURCE_OPTIONS = [
  { label: 'PV', value: 'pv' },
  { label: 'Battery', value: 'battery' },
  { label: 'PV and Battery', value: 'pv_and_battery' },
]

const INITIAL_VALUES: Record<string, unknown> = {
  signoff_companyName: 'Sunterra',
}

function buildTestResultDefaults(): Record<string, string> {
  const defaults: Record<string, string> = {}
  TEST_RESULTS_ROWS.forEach((row, i) => {
    if (row.insulationDefault) {
      defaults[`testResult_${i}_insulation`] = row.insulationDefault
    }
  })
  return defaults
}

const UPPERCASE_STYLE: React.CSSProperties = { textTransform: 'uppercase' }
const FULL_WIDTH_STYLE: React.CSSProperties = { width: '100%' }

const DIGITS_PATTERN = /^\d+$/
const DECIMAL_PATTERN = /^\d*\.?\d*$/
const VOLTAGE_PATTERN = /^(\d*\.?\d*|OL)$/i
const INSULATION_PATTERN = /^(\d*\.?\d*|N\/A|OL)$/i

/* ================================================================
   Memoised sub-components
   ================================================================ */

const toDate = (v: unknown): Date | undefined => {
  if (v instanceof Date) return v
  if (typeof v === 'string' && v) {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d
  }
  return undefined
}

const DatePickerField: React.FC<{
  value?: Date | string
  onChange?: (val: Date) => void
}> = React.memo(({ value, onChange }) => {
  const [visible, setVisible] = useState(false)
  const dateValue = toDate(value)
  return (
    <>
      <div
        className={`date-picker-trigger${dateValue ? '' : ' placeholder'}`}
        onClick={() => setVisible(true)}
      >
        {dateValue ? formatDate(dateValue) : 'Select date'}
      </div>
      <DatePicker
        visible={visible}
        onClose={() => setVisible(false)}
        onConfirm={(val) => {
          onChange?.(val)
          setVisible(false)
        }}
        value={dateValue}
      />
    </>
  )
})
DatePickerField.displayName = 'DatePickerField'

const SectionHeader: React.FC<{ title: string; subtitle?: string }> = React.memo(
  ({ title, subtitle }) => (
    <div className="section-header">
      <h2>{title}</h2>
      {subtitle && <p className="section-subtitle">{subtitle}</p>}
    </div>
  ),
)
SectionHeader.displayName = 'SectionHeader'

const InspectionItemBlock: React.FC<{
  prefix: string
  index: number
  label: string
}> = React.memo(({ prefix, index, label }) => (
  <div className="inspection-item">
    <div className="inspection-item-label">
      <span className="inspection-item-number">{index + 1}.</span>
      <span className="inspection-item-text">{label}</span>
    </div>
    <Form.Item name={`${prefix}_${index}_result`} label="Result">
      <Selector options={RESULT_OPTIONS} columns={3} />
    </Form.Item>
    <div className="inspection-row">
      <div className="inspection-date">
        <Form.Item name={`${prefix}_${index}_date`} label="Date">
          <DatePickerField />
        </Form.Item>
      </div>
      <div className="inspection-verified">
        <Form.Item name={`${prefix}_${index}_verifiedBy`} label="Verified By">
          <Input placeholder="Initials" />
        </Form.Item>
      </div>
    </div>
  </div>
))
InspectionItemBlock.displayName = 'InspectionItemBlock'

const ValidatedInput: React.FC<{
  value?: string
  onChange?: (val: string) => void
  placeholder?: string
  type?: string
  inputMode?: 'text' | 'tel' | 'decimal' | 'numeric'
  validPattern: RegExp
  hint?: string
  style?: React.CSSProperties
}> = React.memo(({ value, onChange, placeholder, type, inputMode, validPattern, hint, style }) => {
  const invalid = !!value && !validPattern.test(value)
  return (
    <div className={invalid ? 'input-validation-error' : undefined}>
      <Input
        type={type}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={style}
      />
      {invalid && hint && <p className="validation-hint">{hint}</p>}
    </div>
  )
})
ValidatedInput.displayName = 'ValidatedInput'

/* ----------------------------------------------------------------
   Test Results table — plain <input> + ref store
   ---------------------------------------------------------------- */

const TestResultRowComp: React.FC<{
  row: TestResultRowDef
  index: number
  storeRef: React.MutableRefObject<Record<string, string>>
  defaults: Record<string, string>
}> = React.memo(({ row, index, storeRef, defaults }) => {
  const [voltageInvalid, setVoltageInvalid] = useState(false)
  const [insulationInvalid, setInsulationInvalid] = useState(false)

  const handleVoltage = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      storeRef.current[`testResult_${index}_voltage`] = e.target.value
      const v = e.target.value
      const bad = !!v && !VOLTAGE_PATTERN.test(v)
      e.target.classList.toggle('input-invalid', bad)
      setVoltageInvalid(bad)
    },
    [storeRef, index],
  )
  const handleInsulation = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      storeRef.current[`testResult_${index}_insulation`] = e.target.value
      const v = e.target.value
      const bad = !!v && !INSULATION_PATTERN.test(v)
      e.target.classList.toggle('input-invalid', bad)
      setInsulationInvalid(bad)
    },
    [storeRef, index],
  )
  const handleComments = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      storeRef.current[`testResult_${index}_comments`] = e.target.value
    },
    [storeRef, index],
  )

  return (
    <tr>
      <td className="cell-label">{row.from}</td>
      <td className="cell-label">{row.to}</td>
      <td>
        <div className="table-input-cell">
          <input
            className="plain-input"
            inputMode="decimal"
            placeholder="V"
            defaultValue={defaults[`testResult_${index}_voltage`] || ''}
            onChange={handleVoltage}
          />
          {voltageInvalid && (
            <span className="validation-hint">Number or OL (e.g. 243.8)</span>
          )}
        </div>
      </td>
      <td>
        <div className="table-input-cell">
          <input
            className="plain-input"
            inputMode="decimal"
            placeholder="MΩ"
            defaultValue={
              defaults[`testResult_${index}_insulation`] || row.insulationDefault
            }
            readOnly={!!row.insulationDefault}
            onChange={handleInsulation}
          />
          {insulationInvalid && (
            <span className="validation-hint">Number, N/A, or OL (e.g. 500)</span>
          )}
        </div>
      </td>
      <td>
        <input
          className="plain-input"
          placeholder="—"
          defaultValue={defaults[`testResult_${index}_comments`] || ''}
          onChange={handleComments}
        />
      </td>
    </tr>
  )
})
TestResultRowComp.displayName = 'TestResultRowComp'

const TestResultsTable: React.FC<{
  storeRef: React.MutableRefObject<Record<string, string>>
  defaults: Record<string, string>
}> = React.memo(({ storeRef, defaults }) => (
  <div className="test-results-scroll">
    <table className="test-results-table">
      <thead>
        <tr>
          <th>From</th>
          <th>To</th>
          <th>Voltage</th>
          <th>Insulation (MΩ)</th>
          <th>Comments</th>
        </tr>
      </thead>
      <tbody>
        {TEST_RESULTS_ROWS.map((row, i) => (
          <TestResultRowComp
            key={i}
            row={row}
            index={i}
            storeRef={storeRef}
            defaults={defaults}
          />
        ))}
      </tbody>
    </table>
  </div>
))
TestResultsTable.displayName = 'TestResultsTable'

const ApplyToAllRow: React.FC<{
  prefix: string
  count: number
  form: ReturnType<typeof Form.useForm>[0]
}> = React.memo(({ prefix, count, form }) => {
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [verifiedBy, setVerifiedBy] = useState('')
  const [pickerVisible, setPickerVisible] = useState(false)

  const handleApply = useCallback(() => {
    const values: Record<string, unknown> = {}
    for (let i = 0; i < count; i++) {
      if (date) values[`${prefix}_${i}_date`] = date
      if (verifiedBy.trim()) values[`${prefix}_${i}_verifiedBy`] = verifiedBy.trim()
    }
    if (Object.keys(values).length > 0) {
      form.setFieldsValue(values)
      Toast.show({ content: 'Applied to all items', icon: 'success' })
    }
  }, [prefix, count, form, date, verifiedBy])

  return (
    <div className="apply-to-all-row">
      <div className="apply-to-all-fields">
        <div className="apply-to-all-date">
          <label>Date</label>
          <div
            className={`date-picker-trigger${date ? '' : ' placeholder'}`}
            onClick={() => setPickerVisible(true)}
          >
            {date ? formatDate(date) : 'Select date'}
          </div>
          <DatePicker
            visible={pickerVisible}
            onClose={() => setPickerVisible(false)}
            onConfirm={(val) => { setDate(val); setPickerVisible(false) }}
            value={date}
          />
        </div>
        <div className="apply-to-all-verified">
          <label>Verified By</label>
          <Input placeholder="Initials" value={verifiedBy} onChange={setVerifiedBy} />
        </div>
      </div>
      <Button
        size="small"
        className="apply-to-all-btn"
        onClick={handleApply}
        disabled={!date && !verifiedBy.trim()}
      >
        Apply to All
      </Button>
    </div>
  )
})
ApplyToAllRow.displayName = 'ApplyToAllRow'

/* ================================================================
   Main Form Component
   ================================================================ */

const FormFill: React.FC<{ onClearForm: () => void }> = ({ onClearForm }) => {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  /* Load saved data from localStorage (runs once on mount) */
  const [savedFormValues] = useState<Record<string, unknown>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return INITIAL_VALUES
      const saved = deserializeFromStorage(raw)
      const formFields: Record<string, unknown> = { ...INITIAL_VALUES }
      for (const [key, value] of Object.entries(saved)) {
        if (!key.startsWith('testResult_')) formFields[key] = value
      }
      return formFields
    } catch {
      return INITIAL_VALUES
    }
  })

  const [testDefaults] = useState<Record<string, string>>(() => {
    const d = buildTestResultDefaults()
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = deserializeFromStorage(raw)
        for (const [k, v] of Object.entries(saved)) {
          if (k.startsWith('testResult_') && typeof v === 'string') d[k] = v
        }
      }
    } catch {
      /* ignore */
    }
    return d
  })

  const testResultsRef = useRef<Record<string, string>>({ ...testDefaults })

  /* Signature — stored as a plain base64 string, not in the antd-mobile Form */
  const signaturePadRef = useRef<SignaturePadHandle>(null)
  const [initialSignature] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = deserializeFromStorage(raw)
        return typeof saved.signoff_signature === 'string' ? saved.signoff_signature : ''
      }
    } catch { /* ignore */ }
    return ''
  })
  const signatureValueRef = useRef<string>(initialSignature)

  useEffect(() => {
    console.log('[FormFill] MOUNTED — savedFormValues:', JSON.stringify(savedFormValues).slice(0, 200))
    console.log('[FormFill] React version:', React.version)
    form.setFieldsValue(savedFormValues)
  }, [form, savedFormValues])

  /* ---- Auto-save ---- */
  const formContainerRef = useRef<HTMLDivElement>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [draftSave, setDraftSave] = useState<{ time: string; key: number } | null>(null)
  const saveKeyRef = useRef(0)

  const performAutoSave = useCallback(() => {
    const formValues = form.getFieldsValue(true)
    const allValues = {
      ...formValues,
      ...testResultsRef.current,
      signoff_signature: signaturePadRef.current?.getValue() ?? signatureValueRef.current,
    }
    localStorage.setItem(STORAGE_KEY, serializeForStorage(allValues))
    const now = new Date()
    const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
    saveKeyRef.current += 1
    setDraftSave({ time: ts, key: saveKeyRef.current })
  }, [form])

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(performAutoSave, 500)
  }, [performAutoSave])

  useEffect(() => {
    const el = formContainerRef.current
    if (!el) return
    const handler = () => triggerAutoSave()
    el.addEventListener('input', handler)
    return () => el.removeEventListener('input', handler)
  }, [triggerAutoSave])

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  const handleClearForm = useCallback(() => {
    console.log('[ClearForm] Dialog opening')
    Dialog.confirm({
      content: 'Clear all form data? This cannot be undone.',
      confirmText: 'Clear',
      cancelText: 'Cancel',
      onConfirm: () => {
        console.log('[ClearForm] Confirmed — calling onClearForm (localStorage clear + key increment)')
        console.log('[ClearForm] localStorage BEFORE:', localStorage.getItem(STORAGE_KEY) ? 'has data' : 'empty')
        onClearForm()
        console.log('[ClearForm] localStorage AFTER:', localStorage.getItem(STORAGE_KEY) ? 'has data' : 'empty')
        Toast.show({ content: 'Form cleared', icon: 'success' })
      },
    })
  }, [onClearForm])

  /* Submit — validate, save, navigate */
  const handleSubmit = useCallback(async () => {
    const formValues = form.getFieldsValue(true)

    const requiredFields: { name: string; label: string }[] = [
      { name: 'installationAddress', label: 'Installation Address' },
      { name: 'customerName', label: 'Customer Name' },
      { name: 'jobNumber', label: 'Job Number' },
    ]

    const firstMissing = requiredFields.find(
      (f) => !formValues[f.name]?.toString().trim(),
    )

    if (firstMissing) {
      const missing = requiredFields
        .filter((f) => !formValues[f.name]?.toString().trim())
        .map((f) => f.label)

      Toast.show({
        content: `Please fill in: ${missing.join(', ')}`,
        icon: 'fail',
      })

      const target = document.querySelector<HTMLElement>(
        `[data-field="${firstMissing.name}"]`,
      )
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target.classList.add('field-error')
        setTimeout(() => target.classList.remove('field-error'), 3000)
      }
      return
    }

    const allValues = {
      ...formValues,
      ...testResultsRef.current,
      signoff_signature: signaturePadRef.current?.getValue() ?? signatureValueRef.current,
    }
    localStorage.setItem(STORAGE_KEY, serializeForStorage(allValues))
    navigate('/preview')
  }, [form, navigate])

  return (
    <div className="form-container" ref={formContainerRef}>
      {/* ---- Header ---- */}
      <div className="form-header">
        <div className="form-header-row">
          <div className="header-logo">
            <img src={sunteraLogo} alt="Sunterra" />
          </div>
          <div className="header-title">
            <h1>Inspection and Test Record</h1>
            <p className="form-subtitle">
              Multiple-mode Inverter Installation Verification
            </p>
          </div>
          <div className="header-doc-info">
            <span>Doc No: SN-ITR-MMI-001</span>
            <span>Revision: A</span>
            <span>Date: 26-Sep-25</span>
          </div>
        </div>
      </div>

      {/* ---- Auto-save toolbar ---- */}
      <div className="form-toolbar">
        <div className="toolbar-left">
          {draftSave && (
            <span key={draftSave.key} className="draft-saved-indicator">
              Draft saved &#10003; {draftSave.time}
            </span>
          )}
        </div>
        <button type="button" className="clear-form-btn" onClick={handleClearForm}>
          Clear Form
        </button>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={savedFormValues}
        onValuesChange={triggerAutoSave}
        footer={
          <Button
            block
            type="submit"
            color="primary"
            size="large"
            onClick={handleSubmit}
          >
            Preview &amp; Submit
          </Button>
        }
      >
        {/* ===== Section 1 — Project Information ===== */}
        <SectionHeader title="1. Project Information" />

        <div data-field="installationAddress">
          <Form.Item
            name="installationAddress"
            label="Installation Address"
            rules={[{ required: true, message: 'Installation Address is required' }]}
          >
            <Input placeholder="Enter installation address" />
          </Form.Item>
        </div>
        <div data-field="customerName">
          <Form.Item
            name="customerName"
            label="Customer Name"
            rules={[{ required: true, message: 'Customer Name is required' }]}
          >
            <Input placeholder="Enter customer name" />
          </Form.Item>
        </div>
        <div data-field="jobNumber">
          <Form.Item
            name="jobNumber"
            label="Job Number"
            rules={[{ required: true, message: 'Job Number is required' }]}
          >
            <ValidatedInput type="tel" placeholder="Enter job number" validPattern={DIGITS_PATTERN} hint="Numbers only (e.g. 25581)" />
          </Form.Item>
        </div>
        <Form.Item name="inverterModel" label="Inverter Model">
          <Input placeholder="e.g. SPH 5000T-HUB" />
        </Form.Item>
        <Form.Item name="batteryModel" label="Battery Model">
          <Input placeholder="e.g. ALP 15" />
        </Form.Item>
        <Form.Item name="energySource" label="Energy Source">
          <Selector options={ENERGY_SOURCE_OPTIONS} columns={3} />
        </Form.Item>
        <Form.Item name="itrApprovedBy" label="ITR Approved By">
          <Input placeholder="Enter name" />
        </Form.Item>

        {/* ===== Section 2 — Visual Inspection ===== */}
        <SectionHeader title="2. Visual Inspection" />
        <ApplyToAllRow prefix="visual" count={VISUAL_INSPECTION_ITEMS.length} form={form} />
        {VISUAL_INSPECTION_ITEMS.map((item, idx) => (
          <InspectionItemBlock key={`vi_${idx}`} prefix="visual" index={idx} label={item} />
        ))}

        {/* ===== Section 3 — Inspection and Test ===== */}
        <SectionHeader title="3. Inspection and Test" />
        <ApplyToAllRow prefix="inspect" count={INSPECTION_TEST_ITEMS.length} form={form} />
        {INSPECTION_TEST_ITEMS.map((item, idx) => (
          <InspectionItemBlock key={`it_${idx}`} prefix="inspect" index={idx} label={item} />
        ))}

        {/* ===== Section 4 — Additional Testing ===== */}
        <SectionHeader title="4. Additional Testing for Alternative Supply" />

        {/* Test 1 */}
        <div className="additional-test-block">
          <div className="test-block-header">Test 1: Confirm MEN — Grid Supply Mode Test</div>
          <div className="test-description">
            To confirm that the MEN is correctly configured when connected to the grid supply.
            Measurements for current flow shall be taken in the alternative supply active conductor,
            neutral conductor and MEN connection.
            <br /><br />
            <strong>Switch Positions:</strong>
            <ol>
              <li>MAIN SWITCH (GRID) IS ON</li>
              <li>MAIN SWITCH (INVERTER) IS ON</li>
              <li>MAIN SWITCH (ALTERNATIVE) IS ON</li>
              <li>Non-backup circuits are OFF</li>
              <li>Load connected to alternative supply (Back-up)</li>
            </ol>
            <em>Results: There shall be no current measured through the MEN connection.</em>
          </div>
          <div className="measurement-row">
            <div className="measurement-field">
              <Form.Item name="addTest1_ampA" label="A="><ValidatedInput inputMode="decimal" placeholder="Amps" validPattern={DECIMAL_PATTERN} hint="Enter a number (e.g. 12.5)" /></Form.Item>
            </div>
            <div className="measurement-field">
              <Form.Item name="addTest1_ampN" label="N="><ValidatedInput inputMode="decimal" placeholder="Amps" validPattern={DECIMAL_PATTERN} hint="Enter a number (e.g. 12.5)" /></Form.Item>
            </div>
            <div className="measurement-field">
              <Form.Item name="addTest1_ampNE" label="N-E="><ValidatedInput inputMode="decimal" placeholder="Amps" validPattern={DECIMAL_PATTERN} hint="Enter a number (e.g. 12.5)" /></Form.Item>
            </div>
          </div>
          <Form.Item name="addTest1_result" label="Result">
            <Selector options={RESULT_OPTIONS} columns={3} />
          </Form.Item>
          <div className="inspection-row">
            <div className="inspection-date">
              <Form.Item name="addTest1_date" label="Date"><DatePickerField /></Form.Item>
            </div>
            <div className="inspection-verified">
              <Form.Item name="addTest1_verifiedBy" label="Verified By"><Input placeholder="Initials" /></Form.Item>
            </div>
          </div>
        </div>

        {/* Test 2 */}
        <div className="additional-test-block">
          <div className="test-block-header">Test 2: Confirm MEN — Alternative Supply Mode Test</div>
          <div className="test-description">
            To confirm that the MEN is correctly configured when connected to the alternative supply.
            Measurements for current flow shall be taken in the alternative supply active conductor,
            neutral conductor and MEN connection.
            <br /><br />
            <strong>Switch Positions:</strong>
            <ol>
              <li>MAIN SWITCH (GRID) IS OFF</li>
              <li>MAIN SWITCH (INVERTER) IS ON</li>
              <li>MAIN SWITCH (ALTERNATIVE) IS ON</li>
              <li>Non-backup circuits are OFF</li>
              <li>Load connected to alternative supply (Back-up)</li>
            </ol>
            <em>Results: There shall be no current measured through the MEN connection.</em>
          </div>
          <div className="measurement-row">
            <div className="measurement-field">
              <Form.Item name="addTest2_ampA" label="A="><ValidatedInput inputMode="decimal" placeholder="Amps" validPattern={DECIMAL_PATTERN} hint="Enter a number (e.g. 12.5)" /></Form.Item>
            </div>
            <div className="measurement-field">
              <Form.Item name="addTest2_ampN" label="N="><ValidatedInput inputMode="decimal" placeholder="Amps" validPattern={DECIMAL_PATTERN} hint="Enter a number (e.g. 12.5)" /></Form.Item>
            </div>
            <div className="measurement-field">
              <Form.Item name="addTest2_ampNE" label="N-E="><ValidatedInput inputMode="decimal" placeholder="Amps" validPattern={DECIMAL_PATTERN} hint="Enter a number (e.g. 12.5)" /></Form.Item>
            </div>
          </div>
          <Form.Item name="addTest2_result" label="Result">
            <Selector options={RESULT_OPTIONS} columns={3} />
          </Form.Item>
          <div className="inspection-row">
            <div className="inspection-date">
              <Form.Item name="addTest2_date" label="Date"><DatePickerField /></Form.Item>
            </div>
            <div className="inspection-verified">
              <Form.Item name="addTest2_verifiedBy" label="Verified By"><Input placeholder="Initials" /></Form.Item>
            </div>
          </div>
        </div>

        {/* ===== Section 5 — Test Results ===== */}
        <SectionHeader
          title="5. Test Results"
          subtitle="@500V DC or higher for insulation test · Insert N/A for non-applicable tests"
        />
        <TestResultsTable storeRef={testResultsRef} defaults={testDefaults} />

        {/* ===== Section 6 — Equipment ===== */}
        <SectionHeader title="6. Inspection and Test Equipment" />
        <div className="equipment-section">
          <Form.Item label="No."><Input value="1" readOnly /></Form.Item>
          <Form.Item name="equipment_makeModel" label="Make / Model"><Input placeholder="Enter make and model" /></Form.Item>
          <Form.Item name="equipment_serialNo" label="Serial No."><Input placeholder="Enter serial number" /></Form.Item>
          <Form.Item name="equipment_calCertNo" label="Calibration Cert. No."><Input placeholder="Enter certificate number" /></Form.Item>
          <Form.Item name="equipment_calExpiry" label="Cal. Expiry Date"><DatePickerField /></Form.Item>
        </div>

        {/* ===== Section 7 — Comments ===== */}
        <SectionHeader title="7. Comments" />
        <Form.Item name="comments"><TextArea placeholder="Enter any comments..." rows={4} /></Form.Item>

        {/* ===== Section 8 — Defects ===== */}
        <SectionHeader title="8. Defects" />
        <div className="defects-section">
          <Form.Item name="defects">
            <Radio.Group>
              <Space direction="vertical" style={FULL_WIDTH_STYLE}>
                <Radio value="rectified">Defects identified rectified / Closed out</Radio>
                <Radio value="punchListed">Punch Listed</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
        </div>

        {/* ===== Section 9 — Sign-off ===== */}
        <SectionHeader title="9. Sign-off" />
        <Form.Item name="signoff_testedBy" label="Tested By"><Input placeholder="Enter name" /></Form.Item>
        <Form.Item name="signoff_companyName" label="Company Name"><Input placeholder="Sunterra" /></Form.Item>
        <Form.Item name="signoff_licenceNo" label="Elec. Licence No."><ValidatedInput type="tel" placeholder="Enter licence number" validPattern={DIGITS_PATTERN} hint="Numbers only (e.g. 205567)" /></Form.Item>
        <Form.Item name="signoff_nameCapitals" label="Name (CAPITALS)"><Input placeholder="Enter name in capitals" style={UPPERCASE_STYLE} /></Form.Item>
        <Form.Item label="Signature">
          <SignaturePad
            ref={signaturePadRef}
            initialValue={initialSignature}
            onChange={(dataUrl) => { signatureValueRef.current = dataUrl; triggerAutoSave() }}
          />
        </Form.Item>
        <Form.Item name="signoff_date" label="Date"><DatePickerField /></Form.Item>
      </Form>
    </div>
  )
}

const FormFillWrapper: React.FC = () => {
  const [formKey, setFormKey] = useState(0)
  console.log('[FormFillWrapper] render — formKey:', formKey)
  return (
    <FormFill
      key={formKey}
      onClearForm={() => {
        console.log('[FormFillWrapper] onClearForm — removing localStorage, incrementing key from', formKey)
        localStorage.removeItem(STORAGE_KEY)
        setFormKey((k) => k + 1)
      }}
    />
  )
}

export default FormFillWrapper
