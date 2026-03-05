import type { VercelRequest, VercelResponse } from '@vercel/node'

type TrackBody = {
  event: 'preview_click' | 'pdf_export' | 'image_export'
  formType: 'itr' | 'variation-order'
}

export default function handler(req: VercelRequest, res: VercelResponse): void {
  // CORS — same-origin only
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { event, formType } = (req.body ?? {}) as Partial<TrackBody>

  const ip =
    (Array.isArray(req.headers['x-forwarded-for'])
      ? req.headers['x-forwarded-for'][0]
      : req.headers['x-forwarded-for']) ??
    req.headers['x-real-ip'] ??
    'unknown'

  const entry = {
    event,
    formType,
    ip,
    timestamp: new Date().toISOString(),
  }

  // Temporary: log until a storage backend is wired up
  console.log('[track]', JSON.stringify(entry))

  res.status(200).json({ success: true })
}
