import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Form,
  Input,
  TextArea,
  Picker,
  DatePicker,
  Button,
  Toast,
  Dialog,
} from 'antd-mobile'
import sunteraLogo from '../assets/Sunterra_Logo.png'
import SignaturePad from '../components/SignaturePad'
import type { SignaturePadHandle } from '../components/SignaturePad'
import {
  createEmptyWorkItem,
  createEmptyVariationOrder,
  saveVariationOrder,
  loadVariationOrder,
  clearVariationOrder,
  calculateTotal,
  formatCurrency,
  VARIATION_REASONS,
} from '../shared/variationOrderData'
import type { VariationOrderData, WorkItem } from '../shared/variationOrderData'
import { formatDate } from '../shared/formData'
import './VariationOrder.css'

/* ================================================================
   Date picker (same pattern as FormFill)
   ================================================================ */

const toDate = (v: unknown): Date | undefined => {
  if (v instanceof Date) return v
  if (typeof v === 'string' && v) {
    // DD/MM/YYYY from formatDate
    const parts = v.split('/')
    if (parts.length === 3) {
      const d = new Date(
        Number(parts[2]),
        Number(parts[1]) - 1,
        Number(parts[0]),
      )
      if (!isNaN(d.getTime())) return d
    }
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d
  }
  return undefined
}

const DatePickerField: React.FC<{
  value?: string
  onChange?: (val: string) => void
}> = React.memo(({ value, onChange }) => {
  const [visible, setVisible] = useState(false)
  const dateValue = toDate(value)
  return (
    <>
      <div
        className={`vo-date-trigger${dateValue ? '' : ' placeholder'}`}
        onClick={() => setVisible(true)}
      >
        {dateValue ? formatDate(dateValue) : 'Select date'}
      </div>
      <DatePicker
        visible={visible}
        onClose={() => setVisible(false)}
        onConfirm={(val) => {
          onChange?.(formatDate(val))
          setVisible(false)
        }}
        value={dateValue}
      />
    </>
  )
})
DatePickerField.displayName = 'DatePickerField'

/* ================================================================
   Section Header (same style as FormFill)
   ================================================================ */

const SectionHeader: React.FC<{ title: string }> = React.memo(({ title }) => (
  <div className="section-header">
    <div className="section-header-row">
      <h2>{title}</h2>
    </div>
  </div>
))
SectionHeader.displayName = 'SectionHeader'

/** Filter amount input: digits and one decimal point only */
function filterAmountValue(val: string): string {
  return val
    .replace(/[^0-9.]/g, '')
    .replace(/(\..*)\./g, '$1')
}

/** Input for amount used inside Form.Item; filters non-numeric input */
const AmountInput: React.FC<{
  value?: string
  onChange?: (val: string) => void
}> = React.memo(({ value, onChange }) => (
  <div className="vo-amount-row">
    <span className="vo-amount-prefix">$</span>
    <Input
      value={value ?? ''}
      onChange={(val) => onChange?.(filterAmountValue(val))}
      placeholder="0.00"
      inputMode="decimal"
      type="text"
      pattern="[0-9]*\.?[0-9]*"
    />
  </div>
))
AmountInput.displayName = 'AmountInput'

/* ================================================================
   Reason Picker — Form.Item-compatible controlled component
   ================================================================ */

const ReasonPickerField: React.FC<{
  value?: string
  onChange?: (val: string) => void
}> = React.memo(({ value = '', onChange }) => {
  const [visible, setVisible] = useState(false)
  const reasonSelected = value.startsWith('Other') ? 'Other' : value || null
  const otherReasonText = value.startsWith('Other: ') ? value.slice(7) : ''
  const displayLabel =
    reasonSelected &&
    (VARIATION_REASONS.find((r) => r.value === reasonSelected)?.label ??
      reasonSelected)

  return (
    <>
      <div
        className={`vo-reason-trigger${displayLabel ? '' : ' placeholder'}`}
        onClick={() => setVisible(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setVisible(true)
          }
        }}
      >
        {displayLabel ?? 'Select reason'}
      </div>
      <Picker
        columns={[VARIATION_REASONS]}
        value={reasonSelected ? [reasonSelected] : []}
        visible={visible}
        onClose={() => setVisible(false)}
        onConfirm={(val) => {
          const selected = (val as (string | null)[])?.[0] ?? ''
          onChange?.(selected === 'Other' ? 'Other' : selected)
          setVisible(false)
        }}
      />
      {reasonSelected === 'Other' && (
        <Input
          className="vo-reason-other-input"
          value={otherReasonText}
          onChange={(v) => onChange?.(v ? `Other: ${v}` : 'Other')}
          placeholder="Specify reason"
        />
      )}
    </>
  )
})
ReasonPickerField.displayName = 'ReasonPickerField'

/* ================================================================
   Work Item Block
   ================================================================ */

const WorkItemBlock: React.FC<{
  item: WorkItem
  index: number
  showDelete: boolean
  onDelete: (id: string) => void
}> = React.memo(({ item, index, showDelete, onDelete }) => (
  <div className="vo-work-item">
    <div className="vo-work-item-header">
      <span className="vo-work-item-number">#{index + 1}</span>
      {showDelete && (
        <button
          type="button"
          className="vo-delete-btn"
          onClick={() => onDelete(item.id)}
          aria-label="Delete item"
        >
          Remove
        </button>
      )}
    </div>

    <div className="vo-field-group">
      <Form.Item
        name={['workItems', index, 'reason']}
        label="Reason for Change"
      >
        <ReasonPickerField />
      </Form.Item>
    </div>

    <div className="vo-field-group">
      <Form.Item
        name={['workItems', index, 'description']}
        label="Description of Extra Work"
        rules={[{ required: true, message: 'Description is required' }]}
      >
        <TextArea
          placeholder="Brief description of extra work"
          maxLength={200}
          rows={2}
          showCount
        />
      </Form.Item>
    </div>

    <div className="vo-field-group">
      <Form.Item
        name={['workItems', index, 'amount']}
        label="Amount (GST incl.)"
        rules={[{ required: true, message: 'Amount is required' }]}
      >
        <AmountInput />
      </Form.Item>
    </div>
  </div>
))
WorkItemBlock.displayName = 'WorkItemBlock'

/* ================================================================
   Main Component
   ================================================================ */

function mergeFormWorkItems(
  prev: WorkItem[],
  next: unknown,
): WorkItem[] {
  if (!next || !Array.isArray(next)) return prev
  return (next as Partial<WorkItem>[]).map((w, i) => ({
    id: prev[i]?.id ?? (w as WorkItem).id ?? '',
    description: w.description ?? '',
    reason: w.reason ?? '',
    amount: w.amount ?? '',
  }))
}

const VariationOrder: React.FC = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const [data, setData] = useState<VariationOrderData>(
    () => loadVariationOrder() ?? createEmptyVariationOrder(),
  )

  const workItemsLengthRef = useRef(data.workItems.length)

  /* Sync form when work items are added/removed (or after clear) */
  useEffect(() => {
    if (data.workItems.length !== workItemsLengthRef.current) {
      workItemsLengthRef.current = data.workItems.length
      form.setFieldsValue({ workItems: data.workItems })
    }
  }, [data.workItems.length, data.workItems, form])

  /* Signature refs */
  const installerSigRef = useRef<SignaturePadHandle>(null)
  const customerSigRef = useRef<SignaturePadHandle>(null)

  /* Auto-save */
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isClearingRef = useRef(false)
  const [draftSave, setDraftSave] = useState<{ time: string; key: number } | null>(null)
  const saveKeyRef = useRef(0)

  const performSave = useCallback((latest: VariationOrderData) => {
    if (isClearingRef.current) return
    const withSigs: VariationOrderData = {
      ...latest,
      installerSignature: installerSigRef.current?.getValue() ?? latest.installerSignature,
      customerSignature: customerSigRef.current?.getValue() ?? latest.customerSignature,
    }
    saveVariationOrder(withSigs)
    const now = new Date()
    const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
    saveKeyRef.current += 1
    setDraftSave({ time: ts, key: saveKeyRef.current })
  }, [])

  const triggerAutoSave = useCallback(
    (latest: VariationOrderData) => {
      if (isClearingRef.current) return
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = setTimeout(() => performSave(latest), 500)
    },
    [performSave],
  )

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [])

  /* Helpers to update data and auto-save */
  const update = useCallback(
    (patch: Partial<VariationOrderData>) => {
      setData((prev) => {
        const next = { ...prev, ...patch }
        triggerAutoSave(next)
        return next
      })
    },
    [triggerAutoSave],
  )

  const handleAddItem = useCallback(() => {
    setData((prev) => {
      const next: VariationOrderData = {
        ...prev,
        workItems: [...prev.workItems, createEmptyWorkItem()],
      }
      triggerAutoSave(next)
      return next
    })
  }, [triggerAutoSave])

  const handleDeleteItem = useCallback(
    (id: string) => {
      setData((prev) => {
        if (prev.workItems.length <= 1) return prev
        const next: VariationOrderData = {
          ...prev,
          workItems: prev.workItems.filter((item) => item.id !== id),
        }
        triggerAutoSave(next)
        return next
      })
    },
    [triggerAutoSave],
  )

  /* Clear form */
  const handleClearForm = useCallback(() => {
    Dialog.confirm({
      content: 'Clear all form data? This cannot be undone.',
      confirmText: 'Clear',
      cancelText: 'Cancel',
      onConfirm: () => {
        isClearingRef.current = true
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current)
          autoSaveTimerRef.current = null
        }
        clearVariationOrder()
        installerSigRef.current?.clear()
        customerSigRef.current?.clear()
        const empty = createEmptyVariationOrder()
        setData(empty)
        form.setFieldsValue(empty)
        workItemsLengthRef.current = empty.workItems.length
        clearVariationOrder()
        requestAnimationFrame(() => {
          isClearingRef.current = false
        })
        Toast.show({ content: 'Form cleared', icon: 'success' })
      },
    })
  }, [form])

  /* Validate & submit */
  const handlePreview = useCallback(() => {
    if (data.workItems.length === 0) {
      Toast.show({
        content: 'Please add at least one work item',
        icon: 'fail',
      })
      return
    }
    form
      .validateFields()
      .then(() => {
        const customerSig =
          customerSigRef.current?.getValue() ?? data.customerSignature
        if (!customerSig) {
          Toast.show({
            content: 'Customer signature is required',
            icon: 'fail',
          })
          return
        }
        const withSigs: VariationOrderData = {
          ...data,
          ...form.getFieldsValue(),
          workItems: mergeFormWorkItems(
            data.workItems,
            form.getFieldsValue().workItems,
          ),
          installerSignature:
            installerSigRef.current?.getValue() ?? data.installerSignature,
          customerSignature: customerSig,
        }
        saveVariationOrder(withSigs)
        navigate('/variation-order/preview')
      })
      .catch((err: { errorFields?: Array<{ errors?: string[] }> }) => {
        const firstMsg = err.errorFields?.[0]?.errors?.[0]
        Toast.show({
          content: firstMsg ?? 'Please complete required fields',
          icon: 'fail',
        })
      })
  }, [data, form, navigate])

  const total = calculateTotal(data.workItems)

  /* ================================================================
     Render
     ================================================================ */
  return (
    <div className="form-container vo-container">
      {/* ---- Header ---- */}
      <div className="form-header">
        <div className="form-header-row">
          <div className="header-logo">
            <img src={sunteraLogo} alt="Sunterra" />
          </div>
          <div className="header-title">
            <h1>Variation Order</h1>
            <p className="form-subtitle">Extra Work Authorisation</p>
          </div>
          <div className="header-doc-info">
            <span>Doc No: SN-VO-001</span>
            <span>Revision: A</span>
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
        initialValues={data}
        onValuesChange={(_, allValues) => {
          if (isClearingRef.current) return
          setData((prev) => {
            const next: VariationOrderData = {
              ...prev,
              jobNumber: (allValues.jobNumber as string) ?? prev.jobNumber,
              installationAddress:
                (allValues.installationAddress as string) ?? prev.installationAddress,
              date: (allValues.date as string) ?? prev.date,
              workItems: mergeFormWorkItems(prev.workItems, allValues.workItems),
            }
            triggerAutoSave(next)
            return next
          })
        }}
      >
      {/* ===== Section 1 — Project Information ===== */}
      <div className="section-card">
        <SectionHeader title="1. Project Information" />
        <div className="section-card-body">
          <div className="vo-form-item">
            <Form.Item
              name="jobNumber"
              label="Job Number"
              rules={[{ required: true, message: 'Job Number is required' }]}
            >
              <Input placeholder="Enter job number" type="tel" />
            </Form.Item>
          </div>
          <div className="vo-form-item">
            <Form.Item
              name="installationAddress"
              label="Installation Address"
              rules={[{ required: true, message: 'Installation Address is required' }]}
            >
              <Input placeholder="Enter installation address" />
            </Form.Item>
          </div>
          <div className="vo-form-item">
            <Form.Item name="date" label="Date">
              <DatePickerField />
            </Form.Item>
          </div>
        </div>
      </div>

      {/* ===== Section 2 — Extra Work Details ===== */}
      <div className="section-card">
        <SectionHeader title="2. Extra Work Details" />
        <div className="section-card-body">
          {data.workItems.map((item, idx) => (
            <WorkItemBlock
              key={item.id}
              item={item}
              index={idx}
              showDelete={data.workItems.length > 1}
              onDelete={handleDeleteItem}
            />
          ))}

          <button
            type="button"
            className="vo-add-item-btn"
            onClick={handleAddItem}
          >
            + Add Item
          </button>

          <div className="vo-total-row">
            <span className="vo-total-label">Total (GST incl.)</span>
            <span className="vo-total-value">{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* ===== Section 3 — Sign-off ===== */}
      <div className="section-card">
        <SectionHeader title="3. Sign-off" />
        <div className="section-card-body">
          <div className="vo-form-item">
            <label className="vo-label">Installer Signature</label>
            <SignaturePad
              ref={installerSigRef}
              initialValue={data.installerSignature}
              onChange={(dataUrl) => {
                if (isClearingRef.current) return
                // Save immediately on signature change (no debounce to avoid losing strokes)
                const next: VariationOrderData = { ...data, installerSignature: dataUrl }
                saveVariationOrder({ ...next, customerSignature: customerSigRef.current?.getValue() ?? data.customerSignature })
              }}
            />
          </div>

          <div className="vo-form-item">
            <label className="vo-label">
              Customer Signature
              <span className="vo-required-asterisk" aria-hidden> *</span>
            </label>
            <SignaturePad
              ref={customerSigRef}
              initialValue={data.customerSignature}
              onChange={(dataUrl) => {
                if (isClearingRef.current) return
                const next: VariationOrderData = { ...data, customerSignature: dataUrl }
                saveVariationOrder({ ...next, installerSignature: installerSigRef.current?.getValue() ?? data.installerSignature })
              }}
            />
          </div>

          <div className="vo-form-item">
            <label className="vo-label">Signature Date</label>
            <DatePickerField
              value={data.signatureDate}
              onChange={(val) => update({ signatureDate: val })}
            />
          </div>
        </div>
      </div>
      </Form>

      {/* ===== Footer Button ===== */}
      <div className="vo-form-footer">
        <Button
          block
          color="primary"
          size="large"
          onClick={handlePreview}
        >
          Preview &amp; Submit
        </Button>
      </div>
    </div>
  )
}

export default VariationOrder
