import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Input,
  TextArea,
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

/* ================================================================
   Work Item Block
   ================================================================ */

const WorkItemBlock: React.FC<{
  item: WorkItem
  index: number
  showDelete: boolean
  onChange: (id: string, field: keyof WorkItem, value: string) => void
  onDelete: (id: string) => void
}> = React.memo(({ item, index, showDelete, onChange, onDelete }) => (
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
      <label className="vo-label">Description of Extra Work</label>
      <TextArea
        value={item.description}
        onChange={(val) => onChange(item.id, 'description', val)}
        placeholder="Brief description of extra work"
        maxLength={200}
        rows={2}
        showCount
      />
    </div>

    <div className="vo-field-group">
      <label className="vo-label">Reason for Change</label>
      <Input
        value={item.reason}
        onChange={(val) => onChange(item.id, 'reason', val)}
        placeholder="e.g. Site condition, customer request"
      />
    </div>

    <div className="vo-field-group">
      <label className="vo-label">Amount (GST incl.)</label>
      <div className="vo-amount-row">
        <span className="vo-amount-prefix">$</span>
        <Input
          value={item.amount}
          onChange={(val) => onChange(item.id, 'amount', val)}
          placeholder="0.00"
          inputMode="decimal"
          type="text"
        />
      </div>
    </div>
  </div>
))
WorkItemBlock.displayName = 'WorkItemBlock'

/* ================================================================
   Main Component
   ================================================================ */

const VariationOrder: React.FC = () => {
  const navigate = useNavigate()

  const [data, setData] = useState<VariationOrderData>(
    () => loadVariationOrder() ?? createEmptyVariationOrder(),
  )

  /* Signature refs */
  const installerSigRef = useRef<SignaturePadHandle>(null)
  const customerSigRef = useRef<SignaturePadHandle>(null)

  /* Auto-save */
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [draftSave, setDraftSave] = useState<{ time: string; key: number } | null>(null)
  const saveKeyRef = useRef(0)

  const performSave = useCallback((latest: VariationOrderData) => {
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

  /* Work item handlers */
  const handleWorkItemChange = useCallback(
    (id: string, field: keyof WorkItem, value: string) => {
      setData((prev) => {
        const next: VariationOrderData = {
          ...prev,
          workItems: prev.workItems.map((item) =>
            item.id === id ? { ...item, [field]: value } : item,
          ),
        }
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
        clearVariationOrder()
        installerSigRef.current?.clear()
        customerSigRef.current?.clear()
        setData(createEmptyVariationOrder())
        Toast.show({ content: 'Form cleared', icon: 'success' })
      },
    })
  }, [])

  /* Validate & submit */
  const handlePreview = useCallback(() => {
    const { jobNumber, customerName, installationAddress, workItems } = data
    const missing: string[] = []
    if (!jobNumber.trim()) missing.push('Job Number')
    if (!customerName.trim()) missing.push('Customer Name')
    if (!installationAddress.trim()) missing.push('Installation Address')

    if (missing.length > 0) {
      Toast.show({ content: `Please fill in: ${missing.join(', ')}`, icon: 'fail' })
      return
    }

    const hasValidItem = workItems.some(
      (item) => item.description.trim() && item.amount.trim(),
    )
    if (!hasValidItem) {
      Toast.show({
        content: 'Add at least one work item with description and amount',
        icon: 'fail',
      })
      return
    }

    const customerSig = customerSigRef.current?.getValue() ?? data.customerSignature
    if (!customerSig) {
      Toast.show({ content: 'Customer signature is required', icon: 'fail' })
      return
    }

    // Save with latest signatures before navigating
    const withSigs: VariationOrderData = {
      ...data,
      installerSignature: installerSigRef.current?.getValue() ?? data.installerSignature,
      customerSignature: customerSig,
    }
    saveVariationOrder(withSigs)
    navigate('/variation-order/preview')
  }, [data, navigate])

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

      {/* ===== Section 1 — Project Information ===== */}
      <div className="section-card">
        <SectionHeader title="1. Project Information" />
        <div className="section-card-body">
          <div className="vo-form-item">
            <label className="vo-label">Job Number</label>
            <Input
              value={data.jobNumber}
              onChange={(val) => update({ jobNumber: val })}
              placeholder="Enter job number"
              type="tel"
            />
          </div>
          <div className="vo-form-item">
            <label className="vo-label">Customer Name</label>
            <Input
              value={data.customerName}
              onChange={(val) => update({ customerName: val })}
              placeholder="Enter customer name"
            />
          </div>
          <div className="vo-form-item">
            <label className="vo-label">Installation Address</label>
            <TextArea
              value={data.installationAddress}
              onChange={(val) => update({ installationAddress: val })}
              placeholder="Enter installation address"
              rows={2}
            />
          </div>
          <div className="vo-form-item">
            <label className="vo-label">Date</label>
            <DatePickerField
              value={data.date}
              onChange={(val) => update({ date: val })}
            />
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
              onChange={handleWorkItemChange}
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
                // Save immediately on signature change (no debounce to avoid losing strokes)
                const next: VariationOrderData = { ...data, installerSignature: dataUrl }
                saveVariationOrder({ ...next, customerSignature: customerSigRef.current?.getValue() ?? data.customerSignature })
              }}
            />
          </div>

          <div className="vo-form-item">
            <label className="vo-label">Customer Signature</label>
            <SignaturePad
              ref={customerSigRef}
              initialValue={data.customerSignature}
              onChange={(dataUrl) => {
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
