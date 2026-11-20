import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { api } from './api.js'
import { CROP_COLORS } from './theme.js'
import { makeI18n } from './i18n.js'

export default function Report() {
  const params = Object.fromEntries(new URLSearchParams(window.location.hash.split('?')[1] || ''))
  const { t, term, num, int, digits, person, lang } = useMemo(() => makeI18n(params.lang === 'mr' ? 'mr' : 'en'), []) 
  const [d, setD] = useState(null)
  const [img, setImg] = useState(null)
  const [gat, setGat] = useState(null)
  const mapEl = useRef()

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dataset.theme = 'light'
    const { lang: _l, ...q } = params
    api.report(q).then(setD)
    if (params.scope === 'gat') api.gat(params.id, { year: params.year, season: params.season }).then(setGat)
  }, []) 
  useEffect(() => {
    if (!d) return
    Promise.all([api.parcels({ year: d.year, season: d.season }), api.layer('canals')]).then(([parcels, canals]) => {
      const ids = new Set(d.gats.map((g) => g.id))
      parcels.features.forEach((f) => { f.properties.sel = ids.has(f.properties.id) ? 1 : 0 })
      const m = new maplibregl.Map({
        container: mapEl.current, interactive: false, preserveDrawingBuffer: true, attributionControl: false,
        style: { version: 8, sources: { p: { type: 'geojson', data: parcels }, c: { type: 'geojson', data: canals } }, layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#fff' } },
          { id: 'pf', type: 'fill', source: 'p', paint: { 'fill-color': ['case', ['==', ['get', 'sel'], 1], '#8CCFD3', '#EEF1EC'] } },
          { id: 'pl', type: 'line', source: 'p', paint: { 'line-color': ['case', ['==', ['get', 'sel'], 1], '#0B7A8A', '#B9C2BA'], 'line-width': ['case', ['==', ['get', 'sel'], 1], 1.2, 0.4] } },
          { id: 'cl', type: 'line', source: 'c', paint: { 'line-color': '#12324A', 'line-width': ['case', ['==', ['get', 'level'], 'main'], 3, 2] } },
        ] },
        center: [76.175, 20.115], zoom: 13,
      })
      const b = new maplibregl.LngLatBounds()
      const feats = parcels.features.filter((f) => f.properties.sel)
      ;(feats.length ? feats : parcels.features).forEach((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).forEach((p) => p[0].forEach((c) => b.extend(c))))
      m.fitBounds(b, { padding: 30, duration: 0, maxZoom: 17 })
      m.once('idle', () => { setImg(m.getCanvas().toDataURL('image/png')); m.remove() })
    })
  }, [d])

  useEffect(() => { if (img) setTimeout(() => window.print(), 500) }, [img])

  if (!d) return <div className="report"><p>{t('loading')}</p></div>
  const s = d.subject || {}
  const title = {
    gat: `${t('gat')} ${digits(s.gat_no)}, ${term(s.village)}`,
    outlet: `${t('outlet')} ${s.outlet} (${t('chak')} ${digits(s.chak_no)}), ${term(s.canal)}`,
    canal: term(s.canal),
    village: term(s.village),
  }[d.scope] || `${t('filterTitle')}: ${Object.values(s.filter || {}).map(term).join(', ')}`
  const tt = d.totals
  return (
    <div className={`report lang-${lang}`}>
      <div className="no-print r-bar"><button className="btn" onClick={() => window.print()}>{t('print')}</button>
        <a href="#/" onClick={() => { window.location.hash = ''; window.location.reload() }}>{t('backToMap')}</a></div>
      <header>
        <div className="r-kicker">{t('appSub')}, {t('wua')}</div>
        <h1>{title}</h1>
        <div className="r-meta">{t('season')}: {term(d.season)} {digits(d.year)}. {t('generated')} {digits(new Date().toLocaleString('en-IN'))}</div>
      </header>
      <div className="r-map">{img ? <img src={img} alt="" /> : <div ref={mapEl} className="r-mapbox" />}</div>
      <table className="r-sum">
        <tbody>
          <tr><th>{t('gats')}</th><td>{int(tt.gats)}</td><th>{t('farmers')}</th><td>{int(tt.farmers)}</td><th>{t('totalArea')}</th><td>{num(tt.total_ha)} {t('ha')}</td></tr>
          <tr><th>{t('gca')}</th><td>{num(tt.gca_ha)} {t('ha')}</td><th>{t('cca')}</th><td>{num(tt.cca_ha)} {t('ha')}</td><th>{t('ica')}</th><td>{num(tt.ica_ha)} {t('ha')}</td></tr>
          <tr><th>{t('potKharab')}</th><td>{num(tt.pot_kharab_ha)} {t('ha')}</td><th>{t('crop')}</th><td colSpan="3">{Object.entries(tt.crop_area_ha).map(([c, a]) => <span key={c} className="r-crop"><i style={{ background: CROP_COLORS[c] }} />{term(c)} {num(a, 1)}</span>)}</td></tr>
        </tbody>
      </table>
      {gat && <>
        <h3 className="r-h">{t('owners')}</h3>
        <table className="r-tbl"><thead><tr><th>{t('name')}</th><th>{t('areaHa')}</th><th>{t('share')}</th></tr></thead>
          <tbody>{gat.owners.map((o) => <tr key={o.id}><td>{person(o)}</td><td>{num(o.area_ha, 3)}</td><td>{o.share_pct ? `${num(o.share_pct, 1)}%` : '—'}</td></tr>)}</tbody></table>
        <h3 className="r-h">{t('crops')}</h3>
        <table className="r-tbl"><thead><tr><th>{t('year')}</th><th>{t('season')}</th><th>{t('crop')}</th><th>{t('areaHa')}</th><th>{t('irrig')}</th></tr></thead>
          <tbody>{gat.crops.map((c) => <tr key={c.id}><td>{digits(c.year)}</td><td>{term(c.season)}</td><td>{term(c.crop)}</td><td>{num(c.area_ha, 3)}</td><td>{term(c.irrigation)}</td></tr>)}</tbody></table>
        <h3 className="r-h">{t('servedBy')}</h3>
      </>}
      <table className="r-tbl">
        <thead><tr><th>{t('village')}</th><th>{t('gat')}</th><th>{t('totalArea')}</th><th>{t('potKharab')}</th><th>{t('cca')}</th><th>{t('ica')}</th><th>{t('outlet')}</th><th>{t('reach')}</th><th>{t('crop')}</th><th>{t('irrig')}</th><th>{t('owners')}</th></tr></thead>
        <tbody>{d.gats.map((g) => (
          <tr key={g.id}><td>{term(g.village)}</td><td>{digits(g.gat_no)}</td><td>{num(g.total_ha, 3)}</td><td>{num(g.pot_kharab_ha, 3)}</td><td>{num(g.cca_ha, 3)}</td><td>{num(g.ica_ha, 3)}</td>
            <td>{g.outlet ? `${g.outlet} (${digits(g.chak_no)})` : '—'}</td><td>{g.reach ? t(g.reach.toLowerCase()) : '—'}</td><td>{term(g.crop) || '—'}</td><td>{term(g.irrigation) || '—'}</td>
            <td>{g.owner_first ? person(g, 'owner_first', 'owner_first_en') : '—'}{g.owner_count > 1 ? ` +${int(g.owner_count - 1)}` : ''}</td></tr>
        ))}</tbody>
      </table>
      <footer>{t('reportFoot')}</footer>
    </div>
  )
}
