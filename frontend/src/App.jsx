import { useEffect, useMemo, useState, useCallback } from 'react'
import MapView, { LAYER_GROUPS, VIEWS } from './MapView.jsx'
import { api } from './api.js'
import Tooltip from './Tooltip.jsx'
import DetailPanel from './DetailPanel.jsx'
import FlowDiagram from './FlowDiagram.jsx'
import { MapTab, FlowTab, InsightsTab, ManageTab, SearchBox } from './Sidebar.jsx'
import { HomeTab, BrowseTab } from './Home.jsx'
import QuickCard from './QuickCard.jsx'
import { I18nCtx, makeI18n, useI18n } from './i18n.js'
import { onlyTest, THEME_LABEL } from './theme.js'
import { waterRoute } from './trace.js'
import { Icon } from './icons.jsx'
import Logo from './Logo.jsx'

const NAV = [['home', 'nav_home', 'target'], ['browse', 'nav_browse', 'find'], ['flow', 'nav_flow', 'flow'], ['tools', 'nav_tools', 'layers'], ['insights', 'nav_insights', 'insights'], ['manage', 'nav_manage', 'manage']]

const ZOOMS = [1, 1.15, 1.3]   
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

function Resizer({ side, value, set, min, max, def, zoom }) {
  const start = (e) => {
    e.preventDefault()
    const x0 = e.clientX, v0 = value
    const move = (ev) => set(clamp(v0 + ((side === 'left' ? 1 : -1) * (ev.clientX - x0)) / zoom, min, max))
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.classList.remove('resizing') }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); document.body.classList.add('resizing')
  }
  return <div className={`resizer resizer-${side}`} onPointerDown={start} onDoubleClick={() => set(def)} role="separator" aria-orientation="vertical" title="Drag to resize, double-click to reset" />
}

function useMobile() {
  const q = '(max-width: 900px)'
  const [m, setM] = useState(() => window.matchMedia?.(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q); const on = () => setM(mq.matches)
    mq.addEventListener('change', on); return () => mq.removeEventListener('change', on)
  }, [])
  return m
}

const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
}

export function boundsOf(features) {
  let b = null
  const add = ([x, y]) => { b = b ? [[Math.min(b[0][0], x), Math.min(b[0][1], y)], [Math.max(b[1][0], x), Math.max(b[1][1], y)]] : [[x, y], [x, y]] }
  features.forEach((f) => {
    const g = f.geometry
    if (g.type === 'Point') add(g.coordinates)
    else if (g.type === 'LineString') g.coordinates.forEach(add)
    else (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach((p) => p[0].forEach(add))
  })
  return b
}

export default function App() {
  const [lang, setLang] = useState(store.get('gis-lang', 'mr'))
  const [dark, setDark] = useState(store.get('gis-theme', window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') === 'dark')
  const i18n = useMemo(() => makeI18n(lang), [lang])
  const { t } = i18n
  const [meta, setMeta] = useState(null)
  const [season, setSeason] = useState(null)
  const [data, setData] = useState(null)
  const [tree, setTree] = useState(null)
  const [tab, setTabRaw] = useState('home')
  const [browseMode, setBrowseMode] = useState('gats')
  const [detailOpen, setDetailOpen] = useState(false)   
  const [sheetOpen, setSheetOpen] = useState(false)    
  const mobile = useMobile()
  const [zoom, setZoom] = useState(Number(store.get('gis-zoom', '1.15')))
  const [sideW, setSideW] = useState(Number(store.get('gis-side', '380')))
  const [detW, setDetW] = useState(Number(store.get('gis-detail', '480')))
  const [ripples, setRipples] = useState([])
  useEffect(() => {
    const r = document.documentElement.style
    r.setProperty('--z', zoom); r.setProperty('--side-w', `${sideW}px`); r.setProperty('--detail-w', `${detW}px`)
    store.set('gis-zoom', zoom); store.set('gis-side', sideW); store.set('gis-detail', detW)
  }, [zoom, sideW, detW])
  const ripple = (pt) => {
    const id = Date.now() + Math.random()
    setRipples((r) => [...r, { id, ...pt }])
    setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 900)
  }
  const setTab = (k) => { setTabRaw(k); setSheetOpen(true) }
  const [view, setView] = useState('all')
  const [visible, setVisible] = useState(VIEWS.all.visible)
  const [fieldOpacity, setFieldOpacity] = useState(0.85)
  const [basemap, setBasemap] = useState('none')
  const [theme, setTheme] = useState('crop')
  const [only, setOnly] = useState('none')
  const [onlyCrop, setOnlyCrop] = useState('Soybean')
  const [highlight, setHighlight] = useState([])
  const [selected, setSelected] = useState(null)
  const [hover, setHover] = useState(null)
  const [flyTo, setFlyTo] = useState(null)
  const [pick, setPick] = useState(null)
  const [version, setVersion] = useState(0)
  const [welcome, setWelcome] = useState(store.get('gis-welcome', '1') === '1')
  const [flowOpen, setFlowOpen] = useState(false)

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; store.set('gis-theme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => { document.documentElement.lang = lang; store.set('gis-lang', lang) }, [lang])
  useEffect(() => { api.meta().then((m) => { setMeta(m); setSeason(m.default) }) }, [])
  useEffect(() => {
    Promise.all(['canals', 'outlets', 'structures', 'chaks', 'villages', 'rivers', 'gaothan'].map((n) => api.layer(n)))
      .then(([canals, outlets, structures, chaks, villages, rivers, gaothan]) => setData((d) => ({ ...d, canals, outlets, structures, chaks, villages, rivers, gaothan })))
  }, [version])
  useEffect(() => { if (season) api.parcels(season).then((parcels) => setData((d) => ({ ...d, parcels }))) }, [season, version])
  useEffect(() => { if (season) api.tree(season).then(setTree) }, [season, version])

  const parcelIndex = useMemo(() => {
    const m = new Map(); data?.parcels?.features.forEach((f) => m.set(f.properties.id, f)); return m
  }, [data?.parcels])

  const onlyCount = useMemo(() => {
    const test = onlyTest(only, onlyCrop)
    if (!test || !data?.parcels) return null
    return data.parcels.features.filter((f) => test(f.properties)).length
  }, [only, onlyCrop, data?.parcels])

  const zoomToGats = useCallback((ids, panel = true) => {
    const b = boundsOf(ids.map((id) => parcelIndex.get(id)).filter(Boolean))
    if (b) setFlyTo({ bounds: b, panel, t: Date.now() })
  }, [parcelIndex])

  const select = useCallback((s, { zoom = true } = {}) => {
    if (s?.kind === 'village') {
      zoomToGats([...parcelIndex.values()].filter((f) => f.properties.village_id === s.id).map((f) => f.properties.id), false)
      return setSelected(null)
    }
    setSelected(s)
    setDetailOpen(false)
    setSheetOpen(false)
    if (!s) return setHighlight([])
    if (!zoom || !data) return
    if (s.kind === 'gat') zoomToGats([s.id])
    if (s.kind === 'structure' || s.kind === 'outlet') {
      const src = s.kind === 'structure' ? data.structures : data.outlets
      const f = src?.features.find((f) => (s.kind === 'structure' ? f.properties.id === s.id : f.properties.chak_no === Number(s.id)))
      if (f) setFlyTo({ center: f.geometry.coordinates, zoom: 16.5, panel: true, t: Date.now() })
    }
    if (s.kind === 'canal') {
      const ids = s.id === 'LBC' ? data.canals.features : data.canals.features.filter((f) => f.properties.id === s.id)
      const b = boundsOf(ids)
      if (b) setFlyTo({ bounds: b, panel: true, t: Date.now() })
    }
  }, [data, parcelIndex, zoomToGats])

  const applyView = (k) => { setView(k); setVisible(VIEWS[k].visible); setFieldOpacity(VIEWS[k].fieldOpacity) }
  const applyOnly = (k) => {
    setOnly(k)
    if (k === 'barren') setTheme('kharab')
    if (k === 'tail') setTheme('reach')
    if (k === 'canal') setTheme('irrigation')
    if (k === 'crop') setTheme('crop')
  }
  const closeWelcome = () => { setWelcome(false); store.set('gis-welcome', '0') }

  const resetMap = () => {
    setSelected(null); setDetailOpen(false); setHighlight([]); setOnly('none'); setTheme('crop')
    applyView('all'); setBasemap('none'); setFlowOpen(false); setShowRoute(true); setPick(null)
    if (data?.parcels) { const b = boundsOf(data.parcels.features); if (b) setFlyTo({ bounds: b, panel: false, t: Date.now() }) }
  }

  const [showRoute, setShowRoute] = useState(true)
  const route = useMemo(() => (showRoute ? waterRoute(selected, data, parcelIndex) : null), [selected, data, parcelIndex, showRoute])

  const ctx = {
    meta, season, setSeason, data, tree, theme, setTheme, visible, setVisible, fieldOpacity, setFieldOpacity, basemap, setBasemap,
    view, applyView, only, applyOnly, onlyCrop, setOnlyCrop, onlyCount,
    highlight, setHighlight, select, selected, zoomToGats, setPick, refresh: () => setVersion((v) => v + 1), parcelIndex,
    openFlow: () => { setFlowOpen(true); setSheetOpen(false) }, setTab, route, showRoute, setShowRoute, browseMode, setBrowseMode, mobile,
  }

  return (
    <I18nCtx.Provider value={i18n}>
      <div className={`app lang-${lang} ${sheetOpen ? 'sheet-open' : ''} ${selected ? 'has-sel' : ''}`}>
        <header className="topbar">
          <div className="brand">
            <Logo label={t('appTitle')} />
            <div>
              <div className="brand-title">{t('appTitle')}</div>
              <div className="brand-sub">{t('appSub')}, {t('wua')}</div>
            </div>
          </div>
          <div className="top-search"><SearchBox select={select} /></div>
          <SeasonPicker meta={meta} season={season} setSeason={setSeason} />
          <div className="top-actions">
            <button className="pill-btn" onClick={() => setLang(lang === 'en' ? 'mr' : 'en')} title={t('language')}>
              <span className={lang === 'en' ? 'on' : ''}>EN</span><span className={lang === 'mr' ? 'on' : ''}>मराठी</span>
            </button>
            <button className="icon-btn textsize" onClick={() => setZoom(ZOOMS[(ZOOMS.indexOf(zoom) + 1) % ZOOMS.length] || 1.15)} title={t('textSize')} aria-label={t('textSize')}>
              <Icon name="textsize" /><small>{['A', 'A+', 'A++'][ZOOMS.indexOf(zoom)] || 'A+'}</small>
            </button>
            <button className="icon-btn" onClick={() => setDark(!dark)} title={dark ? t('light') : t('dark')} aria-label={t('theme')}>
              <Icon name={dark ? 'sun' : 'moon'} />
            </button>
          </div>
        </header>

        <nav className="rail" aria-label="Sections">
          {NAV.map(([k, label, icon]) => (
            <button key={k} className={tab === k && (!mobile || sheetOpen) ? 'on' : ''} aria-current={tab === k}
              onClick={() => { if (mobile && tab === k && sheetOpen) { setSheetOpen(false); return } setTab(k); if (k === 'flow') setFlowOpen(true) }}>
              <Icon name={icon} size={21} /><span>{t(label)}</span>
            </button>
          ))}
        </nav>

        <aside className="sidebar">
          {!mobile && <Resizer side="left" value={sideW} set={setSideW} min={300} max={620} def={380} zoom={zoom} />}
          <button className="sheet-grip" onClick={() => setSheetOpen(!sheetOpen)} aria-label={t('menu')}><span /></button>
          <div className="tab-body" key={tab}>
            {tab === 'home' && <HomeTab {...ctx} SeasonPicker={SeasonPicker} />}
            {tab === 'browse' && <BrowseTab {...ctx} />}
            {tab === 'tools' && <MapTab {...ctx} />}
            {tab === 'flow' && <FlowTab {...ctx} />}
            {tab === 'insights' && <InsightsTab {...ctx} />}
            {tab === 'manage' && <ManageTab {...ctx} />}
          </div>
        </aside>

        <main className={`mapwrap ${selected && detailOpen ? 'has-panel' : ''}`}>
          <MapView data={data} visible={visible} fieldOpacity={fieldOpacity} basemap={basemap} theme={theme} dark={dark}
            only={only} onlyCrop={onlyCrop} highlight={highlight} selected={selected} onHover={setHover}
            onSelect={(s) => { setSheetOpen(false); select(s, { zoom: false }) }} onTap={ripple} pickMode={!!pick} onPick={(p) => { pick && pick(p); setPick(null) }} flyTo={flyTo}
            trace={route?.geojson} frame={!mobile} />
          {!selected && !mobile && meta && season && (
            <div className="cartouche">
              <div className="c-title">{t('mapSheet')}</div>
              <div className="c-grid">
                <span>{t('wua')} (WUA-3)</span>
                <span>{t('appSub')}</span>
                <span>{i18n.term('Digras Bk')}, {i18n.term('Takarkhed Wayal')}</span>
                <span>{t('season')}: {i18n.term(season.season)} {i18n.digits(season.year)}</span>
                <span className="c-theme">{t(THEME_LABEL[theme])}</span>
              </div>
            </div>
          )}
          <Tooltip hover={hover} />
          {ripples.map((r) => <span key={r.id} className="tap-ripple" style={{ left: r.x, top: r.y }} aria-hidden />)}
          {!data?.parcels && (
            <div className="loader" role="status">
              <svg viewBox="0 0 220 40" aria-hidden><path className="pipe" d="M10 20 H210" /><path className="fill" d="M10 20 H210" /></svg>
              <span>{t('loadingMap')}</span>
            </div>
          )}
          <button className="map-reset" onClick={resetMap} title={t('resetMap')}><Icon name="reset" size={18} /><span>{t('resetMap')}</span></button>

          <div className="quickbar" role="toolbar" aria-label={t('views')}>
            <button className="qb-reset" onClick={resetMap} title={t('resetMap')}><Icon name="reset" size={17} />{t('resetMap')}</button>
            <span className="qsep" />
            {['all', 'fields', 'canals', 'structures'].map((k) => (
              <button key={k} className={view === k ? 'on' : ''} onClick={() => applyView(k)}>{t(`v_${k}`)}</button>
            ))}
            <span className="qsep" />
            <div className="basemap-seg">
              {[['none', 'plain'], ['osm', 'street'], ['sat', 'satellite']].map(([k, l]) => (
                <button key={k} className={basemap === k ? 'on' : ''} onClick={() => setBasemap(k)}>{t(l)}</button>
              ))}
            </div>
          </div>

          {only !== 'none' && onlyCount !== null && (
            <div className="only-chip">
              <b>{i18n.int(onlyCount)}</b> {t('matches')}: {t(`o_${only}`)}{only === 'crop' ? ` (${i18n.term(onlyCrop)})` : ''}
              <button onClick={() => applyOnly('none')} aria-label={t('clear')}><Icon name="close" size={14} /></button>
            </div>
          )}
          {pick && <div className="pick-hint">{t('pickHint')} <button onClick={() => setPick(null)}>{t('cancel')}</button></div>}
          {basemap === 'sat' && <div className="georef-note">{t('georefNote')}</div>}

          {flowOpen && (
            <section className="flow-sheet" aria-label={t('flowDiagram')}>
              <header>
                <div><h2>{t('flowDiagram')}</h2><p>{t('flowIntro')}</p></div>
                <button className="icon-btn" onClick={() => setFlowOpen(false)} aria-label={t('close')}><Icon name="close" /></button>
              </header>
              <FlowDiagram tree={tree} theme={theme} narrow={mobile} onSelect={(s) => select(s)} focus={selected?.kind === 'canal' ? selected.id : null}
                onStation={(o) => { const ids = o ? o.gats.map((g) => g.id) : []; setHighlight(ids); if (ids.length) zoomToGats(ids, false) }} />
            </section>
          )}

          {selected && !detailOpen && (
            <QuickCard key={`${selected.kind}-${selected.id}-${version}`} sel={selected} {...ctx} onMore={() => setDetailOpen(true)} onClose={() => select(null)}
              onStation={(ids) => { setHighlight(ids); zoomToGats(ids, false) }} />
          )}

          {welcome && meta && (
            <Welcome t={t} onClose={closeWelcome} actions={{
              find: () => { closeWelcome(); setBrowseMode('gats'); setTab('browse') },
              flow: () => { closeWelcome(); setTab('flow'); setFlowOpen(true) },
              barren: () => { closeWelcome(); applyOnly('barren') },
              report: () => { closeWelcome(); select({ kind: 'canal', id: 'LBC' }) },
            }} meta={meta} i18n={i18n} />
          )}
        </main>

        {selected && detailOpen && !mobile && <Resizer side="right" value={detW} set={setDetW} min={380} max={760} def={480} zoom={zoom} />}
        {selected && detailOpen && <DetailPanel key={`${selected.kind}-${selected.id}-${version}`} sel={selected} {...ctx} onBack={() => setDetailOpen(false)} onClose={() => select(null)} />}
      </div>
    </I18nCtx.Provider>
  )
}

function Welcome({ t, onClose, actions, meta, i18n }) {
  const items = [['find', 'w_find', 'find'], ['flow', 'w_flow', 'flow'], ['barren', 'w_barren', 'field'], ['report', 'w_report', 'doc']]
  return (
    <div className="welcome-scrim" onClick={onClose}>
      <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="wt" onClick={(e) => e.stopPropagation()}>
        <div className="welcome-art" aria-hidden>
          <svg viewBox="0 0 400 90" preserveAspectRatio="none"><path className="w1" d="M0 50 C 60 20, 120 80, 200 45 S 340 20, 400 50" /><path className="w2" d="M0 62 C 70 40, 130 90, 210 58 S 330 36, 400 64" /></svg>
        </div>
        <h2 id="wt">{t('welcomeTitle')}</h2>
        <p>{t('welcomeText')}</p>
        <div className="welcome-stats">
          <div><b>{i18n.int(meta.counts.gats)}</b><span>{t('gats')}</span></div>
          <div><b>{i18n.int(meta.counts.owners)}</b><span>{t('farmers')}</span></div>
          <div><b>{i18n.int(meta.counts.outlets)}</b><span>{t('l_outlets')}</span></div>
          <div><b>{i18n.int(meta.counts.structures)}</b><span>{t('l_structures')}</span></div>
        </div>
        <div className="welcome-grid">
          {items.map(([k, label, icon]) => (
            <button key={k} onClick={actions[k]}><Icon name={icon} size={26} /><span>{t(label)}</span></button>
          ))}
        </div>
        <button className="link-btn" onClick={onClose}>{t('startExploring')}</button>
        <p className="welcome-note">{t('demoNote')}</p>
      </div>
    </div>
  )
}

function SeasonPicker({ meta, season, setSeason, light }) {
  const { t, term, digits } = useI18n()
  if (!meta || !season) return <div className="season" />
  return (
 <div className={`season ${light ? 'light' : ''}`}>
      <label htmlFor={light ? 'yr2' : 'yr'}>{t('season')}</label>
      <select id={light ? 'yr2' : 'yr'} value={season.year} onChange={(e) => setSeason({ ...season, year: e.target.value })}>
        {meta.years.map((y) => <option key={y} value={y}>{digits(y)}</option>)}
      </select>
      <div className="seg">
        {meta.seasons.map((s) => (
          <button key={s} className={season.season === s ? 'on' : ''} onClick={() => setSeason({ ...season, season: s })}>
            <Icon name={{ Kharif: 'rain', Rabi: 'wheat', 'Hot weather': 'sun' }[s]} size={16} className="season-ico" />{term(s)}
          </button>
        ))}
      </div>
    </div>
  )
}
