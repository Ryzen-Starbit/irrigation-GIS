import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { themeFill, onlyExpr, CONDITION_COLORS } from './theme.js'
import { markerImage } from './icons.jsx'

const EMPTY = { type: 'FeatureCollection', features: [] }
const FONT = ['Open Sans Regular']
const STRUCT_TYPES = ['Well', 'Bridge', 'Building', 'Office', 'Head regulator', 'CD work (culvert / siphon)', 'Regulator', 'Aqueduct', 'Outlet gate']
const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export const LAYER_GROUPS = [
  { key: 'parcels', label: 'l_parcels', layers: ['parcel-fill', 'parcel-line', 'parcel-label', 'parcel-hl'] },
  { key: 'canals', label: 'l_canals', layers: ['canal-glow', 'canal-casing', 'canal-line', 'canal-flow', 'canal-label'] },
  { key: 'outlets', label: 'l_outlets', layers: ['outlet-circle', 'outlet-label'] },
  { key: 'chaks', label: 'l_chaks', layers: ['chak-line'] },
  { key: 'structures', label: 'l_structures', layers: ['structure-halo', 'structure-icon', 'structure-label'] },
  { key: 'villages', label: 'l_villages', layers: ['village-line'] },
  { key: 'rivers', label: 'l_rivers', layers: ['river-line'] },
  { key: 'gaothan', label: 'l_gaothan', layers: ['gaothan-fill'] },
  { key: 'pipelines', label: 'l_pipelines', layers: [], empty: 'noPipelines' },
]

export const VIEWS = {
  all: { visible: { parcels: 1, canals: 1, outlets: 1, chaks: 1, structures: 1, villages: 1, rivers: 1, gaothan: 1 }, fieldOpacity: 0.85 },
  fields: { visible: { parcels: 1, villages: 1, gaothan: 1 }, fieldOpacity: 0.9 },
  canals: { visible: { parcels: 1, canals: 1, outlets: 1, chaks: 1, rivers: 1 }, fieldOpacity: 0.22 },
  structures: { visible: { parcels: 1, canals: 1, structures: 1, rivers: 1 }, fieldOpacity: 0.22 },
}

function palette(dark) {
  return dark
    ? { bg: '#0E1820', line: '#4C6270', label: '#E4ECE8', halo: '#0E1820', river: '#3E8FC4', village: '#6BBF7A', chak: '#E0675B', main: '#7FD9E4', minor: '#3CC3D1', casing: '#0E1820', glow: '#3CC3D1' }
    : { bg: '#E7ECE6', line: '#7D8A80', label: '#1F2622', halo: '#ffffff', river: '#4A8DBF', village: '#2E7D45', chak: '#C2493D', main: '#12324A', minor: '#0B7A8A', casing: '#ffffff', glow: '#0B7A8A' }
}

export default function MapView({ data, visible, fieldOpacity, basemap, theme, dark, only, onlyCrop, highlight, selected, onHover, onSelect, pickMode, onPick, flyTo, onReady, trace, frame, onTap }) {
  const [ticks, setTicks] = useState(null)
  const el = useRef(null)
  const map = useRef(null)
  const ready = useRef(false)
  const hl = useRef(new Set())
  const sel = useRef(null)
  const handlers = useRef({})
  handlers.current = { onHover, onSelect, pickMode, onPick, onTap }

  useEffect(() => {
    const P = palette(dark)
    const m = new maplibregl.Map({
      container: el.current,
      style: {
        version: 8,
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
        sources: {
          sat: { type: 'raster', tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] },
          osm: { type: 'raster', tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap contributors',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'] },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': P.bg } },
          { id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' } },
          { id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'none' }, paint: { 'raster-saturation': -0.5 } },
        ],
      },
      center: [76.175, 20.115], zoom: 13.5, maxZoom: 19, preserveDrawingBuffer: true, attributionControl: { compact: true },
    })
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'bottom-right')
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')
    map.current = m

    m.on('load', async () => {
      const src = (id, extra = {}) => m.addSource(id, { type: 'geojson', data: EMPTY, ...extra })
      src('parcels', { promoteId: 'id' }); src('canals'); src('outlets', { promoteId: 'chak_no' })
      src('structures', { promoteId: 'id' }); src('chaks'); src('villages'); src('rivers'); src('gaothan'); src('trace')
      await addMarkerImages(m, dark)

      m.addLayer({ id: 'gaothan-fill', type: 'fill', source: 'gaothan', paint: { 'fill-color': '#B9A68F', 'fill-opacity': 0.5 } })
      m.addLayer({ id: 'parcel-fill', type: 'fill', source: 'parcels', paint: { 'fill-color': themeFill('crop', dark), 'fill-opacity': 0.85,
        'fill-opacity-transition': { duration: 400 } } })
      m.addLayer({ id: 'river-line', type: 'line', source: 'rivers', paint: { 'line-color': P.river, 'line-width': 1.3, 'line-opacity': 0.85 } })
      m.addLayer({ id: 'parcel-line', type: 'line', source: 'parcels', paint: {
        'line-color': ['case', ['boolean', ['feature-state', 'sel'], false], dark ? '#FFFFFF' : '#12324A', ['boolean', ['feature-state', 'hl'], false], dark ? '#7FD9E4' : '#0B7A8A', P.line],
        'line-width': ['interpolate', ['linear'], ['zoom'],
          13, ['case', ['boolean', ['feature-state', 'sel'], false], 3, ['boolean', ['feature-state', 'hl'], false], 1.6, 0.25],
          16, ['case', ['boolean', ['feature-state', 'sel'], false], 4, ['boolean', ['feature-state', 'hl'], false], 2.6, 0.9]],
      } })
      m.addLayer({ id: 'parcel-hl', type: 'fill', source: 'parcels', paint: {
        'fill-color': dark ? '#7FD9E4' : '#0B7A8A',
        'fill-opacity': ['case', ['boolean', ['feature-state', 'sel'], false], 0.35, ['boolean', ['feature-state', 'hl'], false], 0.25, ['boolean', ['feature-state', 'hover'], false], 0.18, 0],
      } })
      m.addLayer({ id: 'chak-line', type: 'line', source: 'chaks', paint: { 'line-color': P.chak, 'line-width': 1.3, 'line-dasharray': [3, 2], 'line-opacity': 0.8 } })
      m.addLayer({ id: 'village-line', type: 'line', source: 'villages', paint: { 'line-color': P.village, 'line-width': 2.2, 'line-dasharray': [6, 2, 1, 2] } })
      m.addLayer({ id: 'canal-glow', type: 'line', source: 'canals', paint: { 'line-color': P.glow, 'line-width': ['case', ['==', ['get', 'level'], 'main'], 18, 13], 'line-blur': 8, 'line-opacity': dark ? 0.45 : 0.18 } })
      m.addLayer({ id: 'canal-casing', type: 'line', source: 'canals', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': P.casing, 'line-width': ['case', ['==', ['get', 'level'], 'main'], 8, 6] } })
      m.addLayer({ id: 'canal-line', type: 'line', source: 'canals', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: {
        'line-color': ['case', ['==', ['get', 'level'], 'main'], P.main, P.minor], 'line-width': ['case', ['==', ['get', 'level'], 'main'], 5, 3.4] } })
      m.addLayer({ id: 'canal-flow', type: 'line', source: 'canals', layout: { 'line-join': 'round' }, paint: {
        'line-color': '#ffffff', 'line-opacity': dark ? 0.75 : 0.85, 'line-width': ['case', ['==', ['get', 'level'], 'main'], 2, 1.4], 'line-dasharray': [0, 4, 3] } })
      m.addLayer({ id: 'trace-glow', type: 'line', source: 'trace', filter: ['!=', ['get', 'part'], 'channel'], layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#F2B53A', 'line-width': 16, 'line-blur': 10, 'line-opacity': 0.55 } })
      m.addLayer({ id: 'trace-line', type: 'line', source: 'trace', filter: ['!=', ['get', 'part'], 'channel'], layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#F2B53A', 'line-width': 5 } })
      m.addLayer({ id: 'trace-flow', type: 'line', source: 'trace', filter: ['!=', ['get', 'part'], 'channel'], layout: { 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 2, 'line-dasharray': [0, 4, 3] } })
      m.addLayer({ id: 'trace-channel', type: 'line', source: 'trace', filter: ['==', ['get', 'part'], 'channel'], layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#F2B53A', 'line-width': 3, 'line-dasharray': [1, 1.6] } })
      m.addLayer({ id: 'trace-field', type: 'circle', source: 'trace', filter: ['==', ['get', 'part'], 'field'],
        paint: { 'circle-radius': 7, 'circle-color': '#F2B53A', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } })
      m.addLayer({ id: 'parcel-label', type: 'symbol', source: 'parcels', minzoom: 15.2, layout: {
        'text-field': ['get', 'gat_no'], 'text-font': FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], 15, 9, 18, 14],
      }, paint: { 'text-color': P.label, 'text-halo-color': P.halo, 'text-halo-width': 1.2 } })
      m.addLayer({ id: 'canal-label', type: 'symbol', source: 'canals', minzoom: 13.5, layout: {
        'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': 12.5, 'text-letter-spacing': 0.04,
      }, paint: { 'text-color': P.main, 'text-halo-color': P.halo, 'text-halo-width': 2 } })
      m.addLayer({ id: 'outlet-circle', type: 'circle', source: 'outlets', minzoom: 13.6, paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, ['case', ['boolean', ['feature-state', 'sel'], false], 7, 4], 17, ['case', ['boolean', ['feature-state', 'sel'], false], 12, 8]],
        'circle-color': ['case', ['==', ['get', 'is_tail'], 1], '#C2493D', '#E2A019'],
        'circle-stroke-color': dark ? '#0E1820' : '#ffffff', 'circle-stroke-width': 2,
        'circle-radius-transition': { duration: 300 },
      } })
      m.addLayer({ id: 'outlet-label', type: 'symbol', source: 'outlets', minzoom: 15, layout: {
        'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'chainage_m']], ' m'], 'text-font': FONT, 'text-size': 10.5,
        'text-offset': [0, 1.4], 'text-anchor': 'top',
      }, paint: { 'text-color': dark ? '#F2C25B' : '#7A4A00', 'text-halo-color': P.halo, 'text-halo-width': 1.5 } })
      m.addLayer({ id: 'structure-halo', type: 'circle', source: 'structures', minzoom: 13.2, paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 12, 18, 22], 'circle-color': dark ? '#7FD9E4' : '#12324A',
        'circle-opacity': ['case', ['boolean', ['feature-state', 'sel'], false], 0.35, 0], 'circle-blur': 0.4 } })
      m.addLayer({ id: 'structure-icon', type: 'symbol', source: 'structures', minzoom: 13.2, layout: {
        'icon-image': ['concat', ['get', 'type'], '|', ['get', 'condition']],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 13.5, 0.32, 15, 0.42, 18, 0.6],
        'icon-allow-overlap': true,
      } })
      m.addLayer({ id: 'structure-label', type: 'symbol', source: 'structures', minzoom: 16.2, layout: {
        'text-field': ['get', 'type'], 'text-font': FONT, 'text-size': 10.5, 'text-offset': [0, 1.9], 'text-anchor': 'top',
      }, paint: { 'text-color': P.label, 'text-halo-color': P.halo, 'text-halo-width': 1.4 } })

      if (!REDUCED) {
        const seq = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
          [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]]
        let step = -1, raf
        const tick = (ts) => {
          const s = Math.floor(ts / 70) % seq.length
          if (s !== step && m.getLayer('canal-flow')) {
            m.setPaintProperty('canal-flow', 'line-dasharray', seq[s])
            if (m.getLayer('trace-flow')) m.setPaintProperty('trace-flow', 'line-dasharray', seq[(s * 2) % seq.length])
            step = s
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        m.on('remove', () => cancelAnimationFrame(raf))
      }

      let hoverId = null
      const interactive = ['structure-icon', 'outlet-circle', 'canal-line', 'parcel-fill']
      const pick = (pt) => m.queryRenderedFeatures(pt, { layers: interactive.filter((l) => m.getLayer(l) && m.getLayoutProperty(l, 'visibility') !== 'none') })[0]
      m.on('mousemove', (e) => {
        const f = pick(e.point)
        if (hoverId !== null) m.setFeatureState({ source: 'parcels', id: hoverId }, { hover: false })
        hoverId = null
        m.getCanvas().style.cursor = f || handlers.current.pickMode ? 'pointer' : ''
        if (f && f.layer.id === 'parcel-fill') { hoverId = f.properties.id; m.setFeatureState({ source: 'parcels', id: hoverId }, { hover: true }) }
        handlers.current.onHover(f ? { x: e.point.x, y: e.point.y, layer: f.layer.id, p: f.properties } : null)
      })
      m.on('mouseout', () => handlers.current.onHover(null))
      m.on('click', (e) => {
        handlers.current.onTap?.(e.point)
        if (handlers.current.pickMode) { handlers.current.onPick({ lat: +e.lngLat.lat.toFixed(6), lon: +e.lngLat.lng.toFixed(6) }); return }
        const f = pick(e.point)
        if (!f) return handlers.current.onSelect(null)
        const p = f.properties
        if (f.layer.id === 'structure-icon') handlers.current.onSelect({ kind: 'structure', id: p.id })
        else if (f.layer.id === 'outlet-circle') handlers.current.onSelect({ kind: 'outlet', id: p.chak_no })
        else if (f.layer.id === 'canal-line') handlers.current.onSelect({ kind: 'canal', id: p.id })
        else handlers.current.onSelect({ kind: 'gat', id: p.id })
      })
      const updTicks = () => setTicks(graticule(m))
      m.on('move', updTicks); m.on('resize', updTicks); updTicks()
      ready.current = true
      m.fire('app-ready')
      onReady?.()
    })
    return () => m.remove()
  }, []) 

  const whenReady = (fn) => {
    const m = map.current
    if (!m) return
    if (ready.current) fn(m)
    else m.once('app-ready', () => fn(m))
  }

  useEffect(() => {
    if (!data) return
    whenReady((m) => {
      for (const [k, v] of Object.entries(data)) if (v && m.getSource(k)) m.getSource(k).setData(v)
      if (data.parcels && !m._fitted) {
        const b = new maplibregl.LngLatBounds()
        data.parcels.features.forEach((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates)
          .forEach((poly) => poly[0].forEach((c) => b.extend(c))))
        if (!b.isEmpty()) { m.fitBounds(b, { padding: { top: 90, bottom: 90, left: 40, right: 40 }, duration: 0 }); m._fitted = true }
      }
      hl.current.forEach((id) => m.setFeatureState({ source: 'parcels', id }, { hl: true }))
      if (sel.current) m.setFeatureState({ source: sel.current.source, id: sel.current.id }, { sel: true })
    })
  }, [data])

  useEffect(() => whenReady((m) => {
    LAYER_GROUPS.forEach((g) => g.layers.forEach((l) => m.getLayer(l) && m.setLayoutProperty(l, 'visibility', visible[g.key] ? 'visible' : 'none')))
  }), [visible])
  useEffect(() => whenReady((m) => {
    m.setLayoutProperty('sat', 'visibility', basemap === 'sat' ? 'visible' : 'none')
    m.setLayoutProperty('osm', 'visibility', basemap === 'osm' ? 'visible' : 'none')
  }), [basemap])
  useEffect(() => whenReady((m) => {
    m.setPaintProperty('parcel-fill', 'fill-color', themeFill(theme, dark))
    const expr = onlyExpr(only, onlyCrop)
    m.setPaintProperty('parcel-fill', 'fill-opacity', expr ? ['case', expr, Math.max(0.85, fieldOpacity), 0.07] : fieldOpacity)
  }), [theme, dark, only, onlyCrop, fieldOpacity])
  useEffect(() => whenReady(async (m) => {
    const P = palette(dark)
    m.setPaintProperty('bg', 'background-color', P.bg)
    m.setPaintProperty('river-line', 'line-color', P.river)
    m.setPaintProperty('village-line', 'line-color', P.village)
    m.setPaintProperty('chak-line', 'line-color', P.chak)
    m.setPaintProperty('canal-glow', 'line-color', P.glow); m.setPaintProperty('canal-glow', 'line-opacity', dark ? 0.45 : 0.18)
    m.setPaintProperty('canal-casing', 'line-color', P.casing)
    m.setPaintProperty('canal-line', 'line-color', ['case', ['==', ['get', 'level'], 'main'], P.main, P.minor])
    m.setPaintProperty('canal-label', 'text-color', P.main)
    ;['parcel-label', 'canal-label', 'outlet-label', 'structure-label'].forEach((l) => m.setPaintProperty(l, 'text-halo-color', P.halo))
    ;['parcel-label', 'structure-label'].forEach((l) => m.setPaintProperty(l, 'text-color', P.label))
    m.setPaintProperty('outlet-circle', 'circle-stroke-color', dark ? '#0E1820' : '#ffffff')
    m.setPaintProperty('parcel-line', 'line-color', ['case', ['boolean', ['feature-state', 'sel'], false], dark ? '#FFFFFF' : '#12324A', ['boolean', ['feature-state', 'hl'], false], dark ? '#7FD9E4' : '#0B7A8A', P.line])
    m.setPaintProperty('parcel-hl', 'fill-color', dark ? '#7FD9E4' : '#0B7A8A')
    await addMarkerImages(m, dark)
  }), [dark])

  useEffect(() => whenReady((m) => {
    hl.current.forEach((id) => m.setFeatureState({ source: 'parcels', id }, { hl: false }))
    hl.current = new Set(highlight || [])
    hl.current.forEach((id) => m.setFeatureState({ source: 'parcels', id }, { hl: true }))
  }), [highlight])

  useEffect(() => whenReady((m) => {
    const prev = sel.current
    if (prev) m.setFeatureState({ source: prev.source, id: prev.id }, { sel: false })
    sel.current = null
    if (!selected) return
    const source = { gat: 'parcels', outlet: 'outlets', structure: 'structures' }[selected.kind]
    if (source) { m.setFeatureState({ source, id: selected.id }, { sel: true }); sel.current = { source, id: selected.id } }
  }), [selected])

  useEffect(() => {
    if (!flyTo) return
    whenReady((m) => {
      const c = m.getContainer(), narrow = c.clientWidth < 700
      const pad = narrow ? { top: 30, left: 24, right: 24, bottom: Math.round(c.clientHeight * 0.55) }
        : { top: 90, bottom: 90, left: 60, right: flyTo.panel ? 470 : 60 }
      if (flyTo.bounds) m.fitBounds(flyTo.bounds, { padding: pad, maxZoom: 17.5, duration: REDUCED ? 0 : 1100 })
      else if (flyTo.center) m.flyTo({ center: flyTo.center, zoom: flyTo.zoom || 17, padding: pad, duration: REDUCED ? 0 : 1100 })
    })
  }, [flyTo])

  useEffect(() => whenReady((m) => m.getSource('trace')?.setData(trace || EMPTY)), [trace])

  return (
    <>
      <div ref={el} className={`map ${pickMode ? 'picking' : ''}`} />
      {frame && ticks && <SheetFrame ticks={ticks} />}
    </>
  )
}

async function addMarkerImages(m, dark) {
  const jobs = []
  for (const t of STRUCT_TYPES) for (const [c, col] of Object.entries(CONDITION_COLORS)) {
    const key = `${t}|${c}`
    jobs.push(markerImage(t, col, dark).then((img) => {
      if (m.hasImage(key)) m.updateImage(key, img); else m.addImage(key, img, { pixelRatio: 1 })
    }))
  }
  await Promise.all(jobs)
}

const STEPS = [0.0005, 0.001, 0.002, 0.0025, 0.005, 0.01, 0.02, 0.05, 0.1]
function dms(v, pos, neg) {
  const a = Math.abs(v), d = Math.floor(a), mf = (a - d) * 60, m = Math.floor(mf), sec = Math.round((mf - m) * 60)
  const ss = sec === 60 ? 0 : sec, mm = sec === 60 ? m + 1 : m
  return `${d}°${String(mm).padStart(2, '0')}′${String(ss).padStart(2, '0')}″${v >= 0 ? pos : neg}`
}
function graticule(m) {
  const b = m.getBounds(), c = m.getCanvas()
  const w = c.clientWidth, h = c.clientHeight
  const span = b.getEast() - b.getWest()
  const step = STEPS.find((s) => span / s <= 6) || 0.1
  const lons = [], lats = []
  for (let x = Math.ceil(b.getWest() / step) * step; x <= b.getEast(); x += step) {
    const px = m.project([x, b.getCenter().lat]).x
    if (px > 60 && px < w - 60) lons.push({ px, label: dms(x, 'E', 'W') })
  }
  for (let y = Math.ceil(b.getSouth() / step) * step; y <= b.getNorth(); y += step) {
    const py = m.project([b.getCenter().lng, y]).y
    if (py > 40 && py < h - 40) lats.push({ py, label: dms(y, 'N', 'S') })
  }
  return { lons, lats }
}
function SheetFrame({ ticks }) {
  return (
    <div className="sheet-frame" aria-hidden>
      {ticks.lons.map((t) => <span key={'x' + t.label} className="tk tk-top" style={{ left: t.px }}>{t.label}</span>)}
      {ticks.lons.map((t) => <span key={'xb' + t.label} className="tk tk-bot" style={{ left: t.px }} />)}
      {ticks.lats.map((t) => <span key={'y' + t.label} className="tk tk-left" style={{ top: t.py }}>{t.label}</span>)}
      {ticks.lats.map((t) => <span key={'yr' + t.label} className="tk tk-right" style={{ top: t.py }} />)}
      <div className="north"><svg viewBox="0 0 24 40"><path d="M12 2 L20 30 L12 24 L4 30 Z" /><path d="M12 2 L12 24 L4 30 Z" className="half" /></svg><b>N</b></div>
    </div>
  )
}
