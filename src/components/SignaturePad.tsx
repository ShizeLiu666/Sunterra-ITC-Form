import { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import ReactSignatureCanvas from 'react-signature-canvas'
import { Toast } from 'antd-mobile'
import './SignaturePad.css'

export interface SignaturePadHandle {
  /** Returns the current confirmed base64 PNG, or '' if none */
  getValue: () => string
  /** Force-clear the pad and confirmed image (used by Clear Form) */
  clear: () => void
}

interface SignaturePadProps {
  /** Pre-filled base64 value restored from localStorage */
  initialValue?: string
  /** Called whenever the confirmed signature changes (or is cleared) */
  onChange?: (dataUrl: string) => void
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ initialValue = '', onChange }, ref) => {
    const sigCanvasRef = useRef<ReactSignatureCanvas>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)

    const [confirmed, setConfirmed] = useState<string>(initialValue)
    const [isEmpty, setIsEmpty] = useState(true)

    /* Expose getValue and clear to parent via ref */
    useImperativeHandle(ref, () => ({
      getValue: () => confirmed,
      clear: () => {
        sigCanvasRef.current?.clear()
        setIsEmpty(true)
        setConfirmed('')
        onChange?.('')
      },
    }))

    /* Resize canvas to fill wrapper width at device pixel ratio */
    const resizeCanvas = useCallback(() => {
      const wrapper = wrapperRef.current
      const canvas = sigCanvasRef.current?.getCanvas()
      if (!wrapper || !canvas) return

      const ratio = window.devicePixelRatio || 1
      const width = wrapper.clientWidth
      const height = canvas.offsetHeight

      canvas.width = width * ratio
      canvas.height = height * ratio
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(ratio, ratio)
      // Resizing clears the canvas
      sigCanvasRef.current?.clear()
      setIsEmpty(true)
    }, [])

    useEffect(() => {
      resizeCanvas()
      window.addEventListener('resize', resizeCanvas)
      return () => window.removeEventListener('resize', resizeCanvas)
    }, [resizeCanvas])

    /* Prevent page scroll while drawing */
    useEffect(() => {
      const el = wrapperRef.current
      if (!el) return
      const prevent = (e: TouchEvent) => {
        if ((e.target as HTMLElement).closest('.sig-canvas-area')) {
          e.preventDefault()
        }
      }
      el.addEventListener('touchstart', prevent, { passive: false })
      el.addEventListener('touchmove', prevent, { passive: false })
      return () => {
        el.removeEventListener('touchstart', prevent)
        el.removeEventListener('touchmove', prevent)
      }
    }, [])

    const handleConfirm = useCallback(() => {
      if (sigCanvasRef.current?.isEmpty()) {
        Toast.show({ content: 'Please sign before confirming', icon: 'fail' })
        return
      }
      const dataUrl = sigCanvasRef.current!.toDataURL('image/png')
      setConfirmed(dataUrl)
      onChange?.(dataUrl)
    }, [onChange])

    const handleResign = useCallback(() => {
      setConfirmed('')
      onChange?.('')
      // Defer clear so canvas is visible again before we clear it
      requestAnimationFrame(() => {
        sigCanvasRef.current?.clear()
        setIsEmpty(true)
      })
    }, [onChange])

    const handleStroke = useCallback(() => {
      setIsEmpty(sigCanvasRef.current?.isEmpty() ?? true)
    }, [])

    /* ---- Confirmed view ---- */
    if (confirmed) {
      return (
        <div className="sig-confirmed" ref={wrapperRef}>
          <img src={confirmed} alt="Signature" className="sig-image" />
          <button type="button" className="sig-resign-link" onClick={handleResign}>
            Re-sign
          </button>
        </div>
      )
    }

    /* ---- Drawing view ---- */
    return (
      <div className="sig-wrapper" ref={wrapperRef}>
        <div className="sig-canvas-area">
          {isEmpty && <span className="sig-placeholder">Sign here</span>}
          <ReactSignatureCanvas
            ref={sigCanvasRef}
            penColor="#000"
            minWidth={1.5}
            maxWidth={3}
            canvasProps={{ className: 'sig-canvas' }}
            onBegin={handleStroke}
            onEnd={handleStroke}
          />
        </div>
        <div className="sig-actions">
          <button
            type="button"
            className={`sig-btn sig-btn-clear${isEmpty ? ' sig-btn-disabled' : ''}`}
            disabled={isEmpty}
            onClick={() => {
              sigCanvasRef.current?.clear()
              setIsEmpty(true)
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className={`sig-btn sig-btn-confirm${isEmpty ? ' sig-btn-disabled' : ''}`}
            disabled={isEmpty}
            onClick={handleConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    )
  },
)

SignaturePad.displayName = 'SignaturePad'
export default SignaturePad
