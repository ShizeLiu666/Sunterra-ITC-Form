import React, { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import sunteraLogo from '../assets/Sunterra_Logo.png'
import {
  STORAGE_KEY,
  deserializeFromStorage,
  formatDate,
  VISUAL_INSPECTION_ITEMS,
  INSPECTION_TEST_ITEMS,
  TEST_RESULTS_ROWS,
} from '../shared/formData'
import './Preview.css'

/* ================================================================
   Display helpers
   ================================================================ */

const RESULT_MAP: Record<string, string> = {
  acceptable: '✓ Acceptable',
  defect: '✕ Defect',
  na: 'N/A',
}

const ENERGY_MAP: Record<string, string> = {
  pv: 'PV',
  battery: 'Battery',
  pv_and_battery: 'PV and Battery',
}

const DEFECT_MAP: Record<string, string> = {
  rectified: 'Defects identified rectified / Closed out',
  punchListed: 'Punch Listed',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Data = Record<string, any>

function str(val: unknown): string {
  if (val === undefined || val === null || val === '') return '—'
  return String(val)
}

function resultStr(val: unknown): string {
  if (Array.isArray(val) && val.length > 0) return RESULT_MAP[val[0]] || str(val[0])
  return '—'
}

function dateStr(val: unknown): string {
  if (val instanceof Date) return formatDate(val)
  return '—'
}

function energyStr(val: unknown): string {
  if (Array.isArray(val) && val.length > 0)
    return val.map((v) => ENERGY_MAP[v] || v).join(', ')
  return '—'
}

/* ================================================================
   Preview Component
   ================================================================ */

const Preview: React.FC = () => {
  const navigate = useNavigate()
  const previewRef = useRef<HTMLDivElement>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  // Load form data from localStorage
  const [data] = useState<Data | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? deserializeFromStorage(raw) : null
    } catch {
      return null
    }
  })

  // Redirect if no data
  useEffect(() => {
    if (!data) navigate('/', { replace: true })
  }, [data, navigate])

  /* ---- PDF generation ---- */
  const handleDownloadPdf = async () => {
    const el = previewRef.current
    if (!el) return

    setPdfLoading(true)

    // Fix width for consistent A4-proportioned output
    const originalStyle = el.getAttribute('style') || ''
    el.style.width = '794px'
    el.style.maxWidth = '794px'

    try {
      // Small delay to let browser reflow
      await new Promise((r) => setTimeout(r, 200))

      const canvas = await html2canvas(el, {
        scale: 2,
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

      const safeName = (data?.customerName?.toString() || 'Unknown').replace(
        /[^a-zA-Z0-9]/g,
        '_',
      )
      const jobNum = data?.jobNumber?.toString() || 'NoJob'
      const today = new Date().toISOString().split('T')[0]
      pdf.save(`ITR_${safeName}_${jobNum}_${today}.pdf`)
    } finally {
      el.setAttribute('style', originalStyle)
      setPdfLoading(false)
    }
  }

  if (!data) return null

  /* ================================================================
     Render
     ================================================================ */

  return (
    <div className="preview-page">
      {/* ---- Preview Content (captured for PDF) ---- */}
      <div className="preview-content" ref={previewRef}>
        {/* ===== Header ===== */}
        <div className="pv-header">
          <div className="pv-header-logo">
            <img src={sunteraLogo} alt="Sunterra" />
          </div>
          <div className="pv-header-title">
            <h1>Inspection and Test Record</h1>
            <p>Multiple-mode Inverter Installation Verification</p>
          </div>
          <div className="pv-header-doc">
            <span>Doc No: SN-ITR-MMI-001</span>
            <span>Revision: A</span>
            <span>Date: 26-Sep-25</span>
          </div>
        </div>

        {/* ===== Section 1 — Project Information ===== */}
        <div className="pv-section">
          <div className="pv-section-title">1. Project Information</div>
          <div className="pv-info-grid">
            <InfoRow label="Installation Address" value={str(data.installationAddress)} fullWidth />
            <InfoRow label="Customer Name" value={str(data.customerName)} />
            <InfoRow label="Job Number" value={str(data.jobNumber)} />
            <InfoRow label="Inverter Model" value={str(data.inverterModel)} />
            <InfoRow label="Battery Model" value={str(data.batteryModel)} />
            <InfoRow label="Energy Source" value={energyStr(data.energySource)} />
            <InfoRow label="ITR Approved By" value={str(data.itrApprovedBy)} />
          </div>
        </div>

        {/* ===== Section 2 — Visual Inspection ===== */}
        <div className="pv-section">
          <div className="pv-section-title">2. Visual Inspection</div>
          <table className="pv-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}>No.</th>
                <th>Item</th>
                <th style={{ width: 100 }}>Result</th>
                <th style={{ width: 80 }}>Date</th>
                <th style={{ width: 70 }}>Verified</th>
              </tr>
            </thead>
            <tbody>
              {VISUAL_INSPECTION_ITEMS.map((item, i) => (
                <tr key={i}>
                  <td className="center">{i + 1}</td>
                  <td>{item}</td>
                  <td className="center">{resultStr(data[`visual_${i}_result`])}</td>
                  <td className="center">{dateStr(data[`visual_${i}_date`])}</td>
                  <td className="center">{str(data[`visual_${i}_verifiedBy`])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== Section 3 — Inspection and Test ===== */}
        <div className="pv-section">
          <div className="pv-section-title">3. Inspection and Test</div>
          <table className="pv-table">
            <thead>
              <tr>
                <th style={{ width: 30 }}>No.</th>
                <th>Item</th>
                <th style={{ width: 100 }}>Result</th>
                <th style={{ width: 80 }}>Date</th>
                <th style={{ width: 70 }}>Verified</th>
              </tr>
            </thead>
            <tbody>
              {INSPECTION_TEST_ITEMS.map((item, i) => (
                <tr key={i}>
                  <td className="center">{i + 1}</td>
                  <td>{item}</td>
                  <td className="center">{resultStr(data[`inspect_${i}_result`])}</td>
                  <td className="center">{dateStr(data[`inspect_${i}_date`])}</td>
                  <td className="center">{str(data[`inspect_${i}_verifiedBy`])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== Section 4 — Additional Testing ===== */}
        <div className="pv-section">
          <div className="pv-section-title">4. Additional Testing for Alternative Supply</div>

          {[1, 2].map((n) => {
            const prefix = `addTest${n}`
            return (
              <div className="pv-test-block" key={n}>
                <div className="pv-test-title">
                  Test {n}:{' '}
                  {n === 1
                    ? 'Confirm MEN — Grid Supply Mode Test'
                    : 'Confirm MEN — Alternative Supply Mode Test'}
                </div>
                <div className="pv-measurement">
                  <span>A = {str(data[`${prefix}_ampA`])} A</span>
                  <span>N = {str(data[`${prefix}_ampN`])} A</span>
                  <span>N-E = {str(data[`${prefix}_ampNE`])} A</span>
                </div>
                <div className="pv-test-meta">
                  <span>Result: {resultStr(data[`${prefix}_result`])}</span>
                  <span>Date: {dateStr(data[`${prefix}_date`])}</span>
                  <span>Verified: {str(data[`${prefix}_verifiedBy`])}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ===== Section 5 — Test Results ===== */}
        <div className="pv-section">
          <div className="pv-section-title">5. Test Results</div>
          <table className="pv-table pv-table-compact">
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
                <tr key={i}>
                  <td>{row.from}</td>
                  <td>{row.to}</td>
                  <td className="center">{str(data[`testResult_${i}_voltage`])}</td>
                  <td className="center">
                    {str(
                      data[`testResult_${i}_insulation`] || row.insulationDefault,
                    )}
                  </td>
                  <td>{str(data[`testResult_${i}_comments`])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ===== Section 6 — Equipment ===== */}
        <div className="pv-section">
          <div className="pv-section-title">6. Inspection and Test Equipment</div>
          <table className="pv-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>No.</th>
                <th>Make / Model</th>
                <th>Serial No.</th>
                <th>Cal. Cert. No.</th>
                <th>Cal. Expiry</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="center">1</td>
                <td>{str(data.equipment_makeModel)}</td>
                <td>{str(data.equipment_serialNo)}</td>
                <td>{str(data.equipment_calCertNo)}</td>
                <td className="center">{dateStr(data.equipment_calExpiry)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===== Section 7 — Comments ===== */}
        <div className="pv-section">
          <div className="pv-section-title">7. Comments</div>
          <div className="pv-comments">{str(data.comments)}</div>
        </div>

        {/* ===== Section 8 — Defects ===== */}
        <div className="pv-section">
          <div className="pv-section-title">8. Defects</div>
          <div className="pv-defects">
            {data.defects ? DEFECT_MAP[data.defects] || str(data.defects) : '—'}
          </div>
        </div>

        {/* ===== Section 9 — Sign-off ===== */}
        <div className="pv-section">
          <div className="pv-section-title">9. Sign-off</div>
          <div className="pv-signoff-grid">
            <InfoRow label="Tested By" value={str(data.signoff_testedBy)} />
            <InfoRow label="Company Name" value={str(data.signoff_companyName)} />
            <InfoRow label="Elec. Licence No." value={str(data.signoff_licenceNo)} />
            <InfoRow label="Name (CAPITALS)" value={str(data.signoff_nameCapitals)} />
            <InfoRow label="Signature" value={str(data.signoff_signature)} />
            <InfoRow label="Date" value={dateStr(data.signoff_date)} />
          </div>
        </div>

        {/* Footer */}
        <div className="pv-footer">
          Sunterra — Inspection and Test Record — SN-ITR-MMI-001 Rev A
        </div>
      </div>

      {/* ---- Sticky bottom action bar (not captured in PDF) ---- */}
      <div className="preview-actions">
        <button className="pv-btn pv-btn-secondary" onClick={() => navigate('/')}>
          ← Back to Edit
        </button>
        <button
          className="pv-btn pv-btn-primary"
          onClick={handleDownloadPdf}
          disabled={pdfLoading}
        >
          {pdfLoading ? 'Generating…' : '↓ Download PDF'}
        </button>
      </div>
    </div>
  )
}

/* ================================================================
   Small sub-component for info rows
   ================================================================ */

const InfoRow: React.FC<{
  label: string
  value: string
  fullWidth?: boolean
}> = React.memo(({ label, value, fullWidth }) => (
  <div className={`pv-info-item${fullWidth ? ' full-width' : ''}`}>
    <span className="pv-label">{label}</span>
    <span className="pv-value">{value}</span>
  </div>
))
InfoRow.displayName = 'InfoRow'

export default Preview
