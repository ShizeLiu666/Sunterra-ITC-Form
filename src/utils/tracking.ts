export type TrackEvent = 'preview_click' | 'pdf_export' | 'image_export'
export type TrackFormType = 'itr' | 'variation-order'

const ENDPOINT = '/api/track'

/**
 * Fire-and-forget analytics event. Never throws — tracking must not affect UX.
 *
 * Uses `sendBeacon` as primary transport so events survive page unloads.
 * Falls back to `fetch` if `sendBeacon` is unavailable.
 */
export function trackEvent(event: TrackEvent, formType: TrackFormType): void {
  const payload = JSON.stringify({ event, formType })

  try {
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }))
      return
    }

    // sendBeacon unavailable — use fetch, intentionally not awaited
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // silent fail
    })
  } catch {
    // silent fail — tracking must never surface errors to the user
  }
}
