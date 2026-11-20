const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2

function project(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const L = dx * dx + dy * dy
  const t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0
  return [a[0] + t * dx, a[1] + t * dy]
}

export function sliceTo(coords, p) {
  let best = { d: Infinity, i: 0, q: coords[0] }
  for (let i = 0; i < coords.length - 1; i++) {
    const q = project(p, coords[i], coords[i + 1])
    const d = d2(q, p)
    if (d < best.d) best = { d, i, q }
  }
  return [...coords.slice(0, best.i + 1), best.q]
}

export function centroid(geom) {
  const ring = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0]
  let x = 0, y = 0
  ring.forEach(([a, b]) => { x += a; y += b })
  return [x / ring.length, y / ring.length]
}

const lenM = (c) => {
  let s = 0
  for (let i = 0; i < c.length - 1; i++) {
    const lat = ((c[i][1] + c[i + 1][1]) / 2) * Math.PI / 180
    s += Math.hypot((c[i + 1][0] - c[i][0]) * 111320 * Math.cos(lat), (c[i + 1][1] - c[i][1]) * 111320)
  }
  return s
}

export function waterRoute(sel, data, parcelIndex) {
  if (!sel || !data?.canals || !data?.outlets) return null
  const canal = (id) => data.canals.features.find((f) => f.properties.id === id)
  const lbc = canal('LBC')
  if (!lbc) return null
  let outlet = null, field = null, canalId = null
  if (sel.kind === 'gat') {
    const g = parcelIndex.get(sel.id)
    if (!g || !g.properties.chak_no) return null
    outlet = data.outlets.features.find((f) => f.properties.chak_no === g.properties.chak_no)
    field = centroid(g.geometry)
  } else if (sel.kind === 'outlet') {
    outlet = data.outlets.features.find((f) => f.properties.chak_no === Number(sel.id))
  } else if (sel.kind === 'canal') {
    canalId = sel.id
  } else return null
  if (outlet) canalId = outlet.properties.canal_id
  const feats = []
  const minor = canalId !== 'LBC' ? canal(canalId) : null
  let lbcPart
  if (minor) lbcPart = sliceTo(lbc.geometry.coordinates, minor.geometry.coordinates[0])
  else lbcPart = outlet ? sliceTo(lbc.geometry.coordinates, outlet.geometry.coordinates) : lbc.geometry.coordinates
  feats.push({ type: 'Feature', properties: { part: 'main' }, geometry: { type: 'LineString', coordinates: lbcPart } })
  let minorPart = null
  if (minor) {
    minorPart = outlet ? sliceTo(minor.geometry.coordinates, outlet.geometry.coordinates) : minor.geometry.coordinates
    feats.push({ type: 'Feature', properties: { part: 'minor' }, geometry: { type: 'LineString', coordinates: [lbcPart[lbcPart.length - 1], ...minorPart] } })
  }
  if (outlet && field) {
    feats.push({ type: 'Feature', properties: { part: 'channel' }, geometry: { type: 'LineString', coordinates: [outlet.geometry.coordinates, field] } })
    feats.push({ type: 'Feature', properties: { part: 'field' }, geometry: { type: 'Point', coordinates: field } })
  }
  return {
    geojson: { type: 'FeatureCollection', features: feats },
    steps: { lbc_m: Math.round(lenM(lbcPart)), minor_m: minorPart ? Math.round(lenM(minorPart)) : 0, channel_m: outlet && field ? Math.round(lenM([outlet.geometry.coordinates, field])) : 0 },
  }
}
