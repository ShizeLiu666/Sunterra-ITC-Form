import React, { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { Toast } from 'antd-mobile'
import sunteraLogo from '../assets/Sunterra_Logo.png'
import {
  loadVariationOrder,
  calculateTotal,
  formatCurrency,
} from '../shared/variationOrderData'
import type { VariationOrderData } from '../shared/variationOrderData'
import { trackEvent } from '../utils/tracking'
import './Preview.css'
import './VariationOrderPreview.css'

/* ================================================================
   Device helpers (identical to Preview.tsx)
   ================================================================ */

const isMobile = (): boolean =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768

const isIOS = (): boolean => /iPhone|iPad|iPod/i.test(navigator.userAgent)

/**
 * iOS Safari caps a single canvas at ~15MP.
 * Returns the highest scale (1–2, in 0.5 steps) within that budget.
 */
function safeCaptureScale(elementHeight: number, captureWidth = 794): number {
  if (!isIOS()) return 2
  const MAX_PIXELS = 15_000_000
  const maxScale = Math.sqrt(MAX_PIXELS / (captureWidth * elementHeight))
  return Math.max(1, Math.floor(maxScale * 2) / 2)
}

const NARROW_BREAKPOINT = 400

/* ================================================================
   Main Component
   ================================================================ */

const VariationOrderPreview: React.FC = () => {
  const navigate = useNavigate()
  const printRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [mobile] = useState(isMobile)
  const [narrowScreen, setNarrowScreen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= NARROW_BREAKPOINT,
  )

  useEffect(() => {
    const check = () => setNarrowScreen(window.innerWidth <= NARROW_BREAKPOINT)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [data] = useState<VariationOrderData | null>(() => loadVariationOrder())

  // Redirect if no data
  useEffect(() => {
    if (!data) navigate('/variation-order', { replace: true })
  }, [data, navigate])

  // Track preview page view once on mount (only when data is present)
  useEffect(() => {
    if (data) trackEvent('preview_click', 'variation-order')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ----------------------------------------------------------------
     Filename helper — VO_JobNumber_YYYYMMDD_HHmmss
  ---------------------------------------------------------------- */
  const buildFilename = (ext: 'pdf' | 'png'): string => {
    const jobNum = (data?.jobNumber || 'NoJob').replace(/[^a-zA-Z0-9]/g, '_')
    const now = new Date()
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    return `VO_${jobNum}_${datePart}_${timePart}.${ext}`
  }

  /* ----------------------------------------------------------------
     PDF generation (identical logic to Preview.tsx)
  ---------------------------------------------------------------- */
  const handleDownloadPdf = async () => {
    const el = printRef.current
    if (!el) return

    trackEvent('pdf_export', 'variation-order')
    setPdfLoading(true)

    const originalStyle = el.getAttribute('style') || ''
    el.style.width = '794px'
    el.style.maxWidth = '794px'

    try {
      await new Promise((r) => setTimeout(r, 200))

      const scale = safeCaptureScale(el.scrollHeight)
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      let heightLeft = imgHeight - pageHeight

      while (heightLeft > 0) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(buildFilename('pdf'))
    } finally {
      el.setAttribute('style', originalStyle)
      setPdfLoading(false)
    }
  }

  /* ----------------------------------------------------------------
     Image generation (identical logic to Preview.tsx)
  ---------------------------------------------------------------- */
  const handleSaveAsImage = async () => {
    const el = printRef.current
    if (!el) return

    trackEvent('image_export', 'variation-order')
    setImageLoading(true)

    const originalStyle = el.getAttribute('style') || ''
    el.style.width = '794px'
    el.style.maxWidth = '794px'

    try {
      await new Promise((r) => setTimeout(r, 200))

      const scale = safeCaptureScale(el.scrollHeight)
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      })

      const filename = buildFilename('png')
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      )
      if (!blob) {
        Toast.show({ content: 'Failed to generate image', icon: 'fail' })
        return
      }

      const shareNavigator = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean
      }
      const canShareFile =
        typeof shareNavigator.share === 'function' &&
        typeof File !== 'undefined' &&
        (typeof shareNavigator.canShare !== 'function' ||
          shareNavigator.canShare({
            files: [new File([blob], filename, { type: 'image/png' })],
          }))

      if (mobile && canShareFile) {
        try {
          const file = new File([blob], filename, { type: 'image/png' })
          await shareNavigator.share({
            files: [file],
            title: 'Sunterra Variation Order Image',
            text: 'Save to your Photos/Album',
          })
          Toast.show({
            content: 'Use "Save Image/Save to Photos" in the share menu.',
            icon: 'success',
            duration: 2200,
          })
          return
        } catch {
          // User cancelled or share failed; continue to fallback below.
        }
      }

      if (isIOS()) {
        const dataUrl = canvas.toDataURL('image/png')
        const newTab = window.open()
        if (newTab) {
          newTab.document.write(
            `<html><head><title>${filename}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
            `<body style="margin:0;display:flex;justify-content:center;background:#e8e8e8">` +
            `<img src="${dataUrl}" style="width:100%;max-width:800px" /></body></html>`,
          )
          newTab.document.close()
          Toast.show({
            content: 'Long-press the image, then tap "Save to Photos".',
            duration: 2600,
          })
        }
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        Toast.show({ content: 'Image downloaded', icon: 'success', duration: 1600 })
      }
    } finally {
      el.setAttribute('style', originalStyle)
      setImageLoading(false)
    }
  }

  if (!data) return null

  // Only show work items that have at least a description or amount
  const filledItems = data.workItems.filter(
    (item) => item.description.trim() || item.amount.trim(),
  )
  const total = calculateTotal(filledItems)

  /* ================================================================
     Render
     ================================================================ */
  return (
    <div className="preview-page vop-page">
      {/* ----------------------------------------------------------------
          Preview / PDF capture area
      ---------------------------------------------------------------- */}
      <div className="preview-content vop-content" ref={printRef}>

        {/* ===== Document Header ===== */}
        <div className="vop-header">
          <div className="vop-header-logo">
            <img src={sunteraLogo} alt="Sunterra" />
          </div>
          <div className="vop-header-title">
            <div className="vop-doc-label">VARIATION ORDER</div>
            <div className="vop-header-meta">
              <span>Doc No: SN-VO-001</span>
              <span>Rev: A</span>
            </div>
          </div>
        </div>
        <div className="vop-header-rule" />

        {/* ===== Section 1 — Project Information ===== */}
        <div className="vop-section">
          <div className="vop-section-title">1. Project Information</div>
          <table className="vop-info-table">
            <tbody>
              <tr>
                <td className="vop-info-label">Job Number</td>
                <td className="vop-info-value">{data.jobNumber || '—'}</td>
                <td className="vop-info-label">Date</td>
                <td className="vop-info-value">{data.date || '—'}</td>
              </tr>
              <tr>
                <td className="vop-info-label">Installation Address</td>
                <td className="vop-info-value" colSpan={3}>{data.installationAddress || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===== Section 2 — Extra Work Details ===== */}
        <div className="vop-section">
          <div className="vop-section-title">2. Extra Work Details</div>
          <table className="vop-work-table">
            <thead>
              <tr>
                <th className="vop-col-num">#</th>
                <th className="vop-col-desc">Description of Extra Work</th>
                <th className="vop-col-reason">Reason for Change</th>
                <th className="vop-col-amount">Amount (GST incl.)</th>
              </tr>
            </thead>
            <tbody>
              {filledItems.length > 0 ? (
                filledItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="vop-cell-center">{idx + 1}</td>
                    <td>{item.description || '—'}</td>
                    <td>{item.reason || '—'}</td>
                    <td className="vop-cell-amount">
                      {item.amount ? formatCurrency(parseFloat(item.amount) || 0) : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="vop-cell-empty">No items recorded</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="vop-total-row">
                <td colSpan={3} className="vop-total-label">TOTAL (GST inclusive)</td>
                <td className="vop-total-value">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ===== Section 3 — Sign-off ===== */}
        <div className="vop-section vop-signoff-section">
          <div className="vop-section-title">3. Sign-off</div>
          <div className="vop-signoff-grid">

            {/* Installer */}
            <div className="vop-sig-block">
              <div className="vop-sig-label">Installer Signature</div>
              <div className="vop-sig-box">
                {data.installerSignature && data.installerSignature.startsWith('data:image') ? (
                  <img
                    src={data.installerSignature}
                    alt="Installer Signature"
                    className="vop-sig-img"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <span className="vop-sig-placeholder" />
                )}
              </div>
              <div className="vop-sig-line" />
              <div className="vop-sig-caption">Installer / Authorised Representative</div>
            </div>

            {/* Customer */}
            <div className="vop-sig-block">
              <div className="vop-sig-label">Customer Signature</div>
              <div className="vop-sig-box">
                {data.customerSignature && data.customerSignature.startsWith('data:image') ? (
                  <img
                    src={data.customerSignature}
                    alt="Customer Signature"
                    className="vop-sig-img"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <span className="vop-sig-placeholder" />
                )}
              </div>
              <div className="vop-sig-line" />
              <div className="vop-sig-caption">Customer / Property Owner</div>
            </div>

          </div>

          {/* Signature date */}
          <div className="vop-sig-date-row">
            <span className="vop-sig-date-label">Date Signed:</span>
            <span className="vop-sig-date-value">{data.signatureDate || '—'}</span>
          </div>

          {/* Legal declaration */}
          <div className="vop-declaration">
            By signing above, the customer acknowledges and agrees to the additional work and
            associated charges as described in this Variation Order.
          </div>
        </div>

        {/* ===== Document Footer ===== */}
        <div className="vop-footer">
          Sunterra — Variation Order — SN-VO-001 Rev A
        </div>

      </div>

      {/* ----------------------------------------------------------------
          Loading overlay
      ---------------------------------------------------------------- */}
      {(pdfLoading || imageLoading) && (
        <div className="pdf-loading-overlay">
          <div className="pdf-loading-content">
            <div className="pdf-loading-spinner" />
            <p>{imageLoading ? 'Generating Image…' : 'Generating PDF…'}</p>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------
          Sticky action bar — NOT captured in PDF
      ---------------------------------------------------------------- */}
      <div className="preview-actions">
        <button
          className="pv-btn pv-btn-secondary"
          onClick={() => navigate('/variation-order')}
        >
          {mobile && narrowScreen ? '← Back' : '← Back to Edit'}
        </button>
        {mobile ? (
          <>
            <button
              className="pv-btn pv-btn-primary pv-btn-image"
              onClick={handleSaveAsImage}
              disabled={imageLoading || pdfLoading}
            >
              {imageLoading ? 'Generating…' : narrowScreen ? 'Image' : 'Save as Image'}
            </button>
            <button
              className="pv-btn pv-btn-primary pv-btn-pdf"
              onClick={handleDownloadPdf}
              disabled={pdfLoading || imageLoading}
            >
              {pdfLoading ? 'Generating…' : narrowScreen ? 'PDF' : 'Download PDF'}
            </button>
          </>
        ) : (
          <button
            className="pv-btn pv-btn-primary"
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
          >
            {pdfLoading ? 'Generating…' : '↓ Download PDF'}
          </button>
        )}
      </div>
    </div>
  )
}

export default VariationOrderPreview
