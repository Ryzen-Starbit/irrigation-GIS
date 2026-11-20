const qs = (o = {}) => {
  const p = new URLSearchParams()
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v) })
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function get(path, params) {
  const r = await fetch(`/api/${path}${qs(params)}`)
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json()
}

async function post(path, body) {
  const r = await fetch(`/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.detail || r.statusText)
  return d
}

export const api = {
  meta: () => get('meta'),
  parcels: (season) => get('layers/parcels', season),
  layer: (name) => get(`layers/${name}`),
  gat: (id, season) => get(`gats/${encodeURIComponent(id)}`, season),
  outlet: (chak, season) => get(`outlets/${chak}/summary`, season),
  canal: (id, season) => get(`canals/${encodeURIComponent(id)}/summary`, season),
  tree: (season) => get('tree', season),
  structure: (id) => get(`structures/${encodeURIComponent(id)}`),
  search: (q) => get('search', { q }),
  filter: (p) => get('filter', p),
  tail: (season) => get('tail-analysis', season),
  history: (p) => get('crop-history', p),
  report: (p) => get('report', p),
  log: () => get('admin/log'),
  addInspection: (id, body) => post(`structures/${encodeURIComponent(id)}/inspections`, body),
  setCrop: (body) => post('admin/crops', body),
  ownership: (body) => post('admin/ownership', body),
  addStructure: (body) => post('admin/structures', body),
  upload: async (file) => {
    const fd = new FormData(); fd.append('file', file)
    const r = await fetch('/api/admin/upload', { method: 'POST', body: fd })
    const d = await r.json()
    if (!r.ok) throw new Error(d.detail || r.statusText)
    return d
  },
}

export const reportUrls = (params, lang = 'en') => ({
  xlsx: `/api/report.xlsx${qs({ ...params, lang })}`,
  pdf: `#/report${qs({ ...params, lang })}`,
})

export const fmt = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(d))
