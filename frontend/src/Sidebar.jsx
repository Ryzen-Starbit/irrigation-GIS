import { useEffect, useRef, useState } from 'react'
import { LAYER_GROUPS } from './MapView.jsx'
import { THEME_KEYS, THEME_LABEL, themeLegend, CONDITION_COLORS, REACH_COLORS, CROP_COLORS, onlyTest } from './theme.js'
import { api } from './api.js'
import { useI18n } from './i18n.js'
import { Icon } from './icons.jsx'
import { Reports, Stat, CropBars } from './DetailPanel.jsx'
import { HistoryChart, TailChart, ChartModal, Enlargeable } from './Charts.jsx'

export function SearchBox({ select }) {
  const { t, term, digits, person } = useI18n()
  const [q, setQ] = useState(''); const [res, setRes] = useState([]); const [i, setI] = useState(0); const timer = useRef()
  useEffect(() => {
    clearTimeout(timer.current)
    if (!q.trim()) { setRes([]); return }
    timer.current = setTimeout(() => api.search(q).then((r) => { setRes(r); setI(0) }), 180)
  }, [q])
  const label = (r) => {
    if (r.type === 'gat') return [`${t('gat')} ${digits(r.gat_no)}`, term(r.village_id), 'field']
    if (r.type === 'owner') return [person(r), `${t('gat')} ${digits(r.gat_no)}, ${term(r.village_id)}`, 'farmer']
    if (r.type === 'village') return [term(r.id), t('village'), 'map']
    if (r.type === 'outlet') return [`${r.name}, ${t('chak')} ${digits(r.id)}`, term(r.canal_id), 'target']
    if (r.type === 'canal') return [term(r.id), t('canal'), 'flow']
    return [r.name, term(r.stype), r.stype]
  }
  const go = (r) => { select({ kind: r.kind, id: r.id }); setQ(''); setRes([]) }
  return (
    <div className="search">
      <Icon name="find" size={18} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPh')} aria-label={t('searchPh')}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(i + 1, res.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(i - 1, 0)) }
          if (e.key === 'Enter' && res[i]) go(res[i])
          if (e.key === 'Escape') { setQ(''); setRes([]) }
        }} />
      {q && !res.length && <div className="results empty">{t('searchHint')}</div>}
      {res.length > 0 && (
        <ul className="results" role="listbox">
          {res.map((r, k) => {
            const [a, b, ic] = label(r)
            return (
              <li key={k} role="option" aria-selected={k === i}>
                <button className={k === i ? 'act' : ''} onMouseEnter={() => setI(k)} onClick={() => go(r)}>
                  <Icon name={ic} size={18} /><span><b>{a}</b><small>{b}</small></span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Section({ title, children, hint }) {
  return <section className="sec"><h4>{title}</h4>{hint && <p className="hint">{hint}</p>}{children}</section>
}

const ONLY_MARK = { none: 'var(--ink-3)', barren: '#B5793F', tail: '#C2493D', canal: '#1C8FB0', outside: '#9AA59D', crop: '#D4A72C' }

export function MapTab({ visible, setVisible, fieldOpacity, setFieldOpacity, theme, setTheme, view, applyView, only, applyOnly, onlyCrop, setOnlyCrop, meta, data }) {
  const { t, term, int } = useI18n()
  const feats = data?.parcels?.features || []
  const count = (k) => (k === 'none' ? feats.length : feats.filter((f) => onlyTest(k, onlyCrop)(f.properties)).length)
  const legend = themeLegend(theme)
  return (
    <>
      <Section title={t('only')}>
        <div className="only-list" role="radiogroup">
          {['none', 'barren', 'tail', 'canal', 'outside', 'crop'].map((k) => {
            const n = count(k)
            return (
              <button key={k} role="radio" aria-checked={only === k} className={only === k ? 'on' : ''} onClick={() => applyOnly(k)}>
                <i style={{ background: ONLY_MARK[k] }} />
                <span>{t(`o_${k}`)}{k === 'crop' ? `: ${term(onlyCrop)}` : ''}</span>
                <span className="ol-bar"><span style={{ width: `${feats.length ? (100 * n) / feats.length : 0}%` }} /></span>
                <b>{int(n)}</b>
              </button>
            )
          })}
        </div>
        {only === 'crop' && meta && (
          <div className="crop-pick">
            {Object.entries(feats.reduce((acc, f) => { const c = f.properties.crop; if (c) acc[c] = (acc[c] || 0) + 1; return acc }, {}))
              .sort((a, b) => b[1] - a[1]).map(([c, n]) => (
              <button key={c} className={onlyCrop === c ? 'on' : ''} onClick={() => setOnlyCrop(c)}>
                <i style={{ background: CROP_COLORS[c] }} />{term(c)}<small>{int(n)}</small>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title={t('colourBy')}>
        <div className="themes">
          {THEME_KEYS.map((k) => (
            <button key={k} className={theme === k ? 'on' : ''} onClick={() => setTheme(k)}>
              <span className="swatches">{Object.values(themeLegend(k)).slice(0, 4).map((c, i) => <i key={i} style={{ background: c }} />)}</span>
              {t(THEME_LABEL[k])}
            </button>
          ))}
        </div>
        <div className="legend">
          {Object.entries(legend).map(([k, c]) => <div key={k}><i style={{ background: c }} />{k.includes('%') ? k : k === 'In command' ? t('inCommand') : k === 'Outside command' ? t('outside') : ['Head', 'Middle', 'Tail'].includes(k) ? t(k.toLowerCase()) : term(k)}</div>)}
        </div>
      </Section>

      <Section title={t('views')}>
        <div className="seg wide">
          {['all', 'fields', 'canals', 'structures'].map((k) => <button key={k} className={view === k ? 'on' : ''} onClick={() => applyView(k)}>{t(`v_${k}`)}</button>)}
        </div>
      </Section>

      <Section title={t('layers')}>
        <div className="layers">
          {LAYER_GROUPS.map((g) => (
            <label key={g.key} className={`layer ${g.empty ? 'disabled' : ''}`}>
              <input type="checkbox" className="toggle" disabled={!!g.empty} checked={!!visible[g.key] && !g.empty}
                onChange={(e) => setVisible({ ...visible, [g.key]: e.target.checked ? 1 : 0 })} />
              <span className={`sw sw-${g.key}`} />
              <span className="layer-name">{t(g.label)}{g.empty && <small>{t(g.empty)}</small>}</span>
            </label>
          ))}
        </div>
        <label className="slider">{t('opacity')}
          <input type="range" min="0.1" max="1" step="0.05" value={fieldOpacity} onChange={(e) => setFieldOpacity(+e.target.value)} />
        </label>
      </Section>

      <Section title={t('l_structures')}>
        <div className="struct-legend">
          {['Well', 'Bridge', 'Head regulator', 'CD work (culvert / siphon)', 'Office', 'Building'].map((k) => (
            <div key={k}><span className="sicon"><Icon name={k} size={16} /></span>{term(k)}</div>
          ))}
          <div className="cond">{Object.entries(CONDITION_COLORS).map(([k, c]) => <span key={k}><i style={{ borderColor: c }} />{term(k)}</span>)}</div>
        </div>
      </Section>
      <p className="hint">{t('zoomHint')}</p>
    </>
  )
}

export function FindTab({ meta, season, setHighlight, zoomToGats, select }) {
  const { t, term, int } = useI18n()
  const [f, setF] = useState({ crop: '', canal: '', village: '', irrigation: '', reach: '' })
  const [res, setRes] = useState(null)
  const run = async () => { const r = await api.filter({ ...season, ...f }); setRes(r); setHighlight(r.ids); if (r.ids.length) zoomToGats(r.ids, false) }
  const clear = () => { setF({ crop: '', canal: '', village: '', irrigation: '', reach: '' }); setRes(null); setHighlight([]) }
  if (!meta) return null
  const sel = (k, opts, label) => (
    <label>{label}<select value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
      <option value="">{t('any')}</option>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
  )
  return (
    <>
      <Section title={t('filterTitle')} hint={t('filterExample')}>
        <div className="form">
          {sel('crop', meta.crops.map((c) => [c, term(c)]), t('crop'))}
          {sel('canal', ['LBC', 'AMONA TAIL MINOR', 'MINOR-5', 'MINOR-6'].map((c) => [c, term(c)]), t('canal'))}
          {sel('village', meta.villages.map((v) => [v.id, term(v.name)]), t('village'))}
          {sel('irrigation', ['Canal', 'Well', 'Rainfed'].map((c) => [c, term(c)]), t('irrig'))}
          {sel('reach', ['Head', 'Middle', 'Tail'].map((c) => [c, t(c.toLowerCase())]), t('reach'))}
          <div className="full row"><button className="btn" onClick={run}><Icon name="target" size={16} />{t('showOnMap')}</button><button className="btn ghost" onClick={clear}>{t('clear')}</button></div>
        </div>
      </Section>
      {res && (
        <div className="result-box">
          <div className="stats">
            <Stat label={t('gats')} value={res.totals.gats} /><Stat label={t('farmers')} value={res.totals.farmers} />
            <Stat label={t('cca')} value={res.totals.cca_ha} unit={` ${t('ha')}`} d={1} />
          </div>
          <CropBars crops={res.totals.crop_area_ha} />
          <Reports params={{ scope: 'filter', ...season, ...f }} />
          {!res.totals.gats && <p className="muted">0 {t('results')}</p>}
        </div>
      )}
    </>
  )
}

export function FlowTab({ tree, select, openFlow }) {
  const { t, term, int, num } = useI18n()
  if (!tree) return <p className="muted">{t('loading')}</p>
  const row = (n, depth) => (
    <div key={n.id} className={`net-node d${depth}`}>
      <button className="net-row" onClick={() => select({ kind: n.type === 'outlet' ? 'outlet' : 'canal', id: n.type === 'outlet' ? n.chak_no : n.id })}>
        <span className="net-name">
          {n.type === 'outlet' ? <><i className="dot" style={{ background: REACH_COLORS[n.reach] }} />{n.name} <small>@ {int(n.chainage_m)} m</small></> : <b>{term(n.name)}</b>}
        </span>
        <span className="net-num">{int(n.totals.gats)} <small>{t('gats')}</small> · {num(n.totals.cca_ha, 1)} <small>{t('ha')}</small></span>
      </button>
      {n.children?.map((c) => row(c, depth + 1))}
      {n.outlets?.map((o) => row({ ...o, type: 'outlet' }, depth + 1))}
    </div>
  )
  return (
    <>
      <Section title={t('flowDiagram')} hint={t('flowIntro')}>
        <button className="btn" onClick={openFlow}><Icon name="flow" size={16} />{t('flowDiagram')}</button>
      </Section>
      <Section title={t('network')}>
        <div className="net">{tree.map((n) => row(n, 0))}</div>
      </Section>
    </>
  )
}

export function InsightsTab({ season, setSeason, setHighlight, zoomToGats, applyOnly, selected }) {
  const { t, term, num, int, digits } = useI18n()
  const [tail, setTail] = useState(null)
  const [hist, setHist] = useState(null)
  const [scope, setScope] = useState('all')
  const [big, setBig] = useState(null)       
  useEffect(() => { if (season) api.tail(season).then(setTail) }, [season])
  useEffect(() => {
    const p = scope === 'gat' && selected?.kind === 'gat' ? { gat_id: selected.id } : scope.startsWith('canal:') ? { canal: scope.slice(6) } : {}
    api.history(p).then(setHist)
  }, [scope, selected])
  return (
    <>
      <Section title={`${t('tailTitle')}, ${term(season?.season)} ${digits(season?.year)}`} hint={t('tailText')}>
        {tail?.canals.filter((c) => c.canal_id !== 'LBC').map((c) => {
          const H = c.reaches.Head, T = c.reaches.Tail
          return (
            <div className="tail-card" key={c.canal_id}>
              <div className="tail-h"><b>{term(c.canal)}</b>
                <button className="link small" onClick={() => { applyOnly('tail'); setHighlight(c.tail_gats); zoomToGats(c.tail_gats, false) }}>{t('showTail')}</button></div>
              {['Head', 'Middle', 'Tail'].map((r) => {
                const x = c.reaches[r]
                return (
                  <div className="reach-row" key={r}>
                    <span className="reach-name"><i className="dot" style={{ background: REACH_COLORS[r] }} />{t(r.toLowerCase())}</span>
                    <span className="reach-bar"><span style={{ width: `${Math.min(100, x.canal_irrigated_pct_of_cca)}%`, background: REACH_COLORS[r] }} /></span>
                    <span className="num small">{num(x.canal_irrigated_pct_of_cca, 0)}%</span>
                    <span className="small muted">{int(x.gats)} {t('gats')}</span>
                  </div>
                )
              })}
              {H.gats > 0 && T.gats > 0 && T.canal_irrigated_pct_of_cca < H.canal_irrigated_pct_of_cca - 10 && (
                <p className="flag">{t('tail')}: {num(T.canal_irrigated_pct_of_cca, 0)}% vs {t('head')}: {num(H.canal_irrigated_pct_of_cca, 0)}%</p>
              )}
            </div>
          )
        })}
        <p className="hint">{t('canalIrrigated')} (% {t('cca')})</p>
        {tail && <button className="btn ghost" onClick={() => setBig('tail')}><Icon name="expand" size={16} />{t('enlargeChart')}</button>}
        {tail && tail.canals.every((c) => Object.values(c.reaches).every((x) => !x.canal_irrigated_ha)) && season.season !== 'Rabi' && (
          <div className="explain"><Icon name="info" size={18} /><div>{t('noCanalThisSeason')}
            <div><button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setSeason({ ...season, season: 'Rabi' })}>{t('showRabi')}</button></div></div></div>
        )}
      </Section>

      <Section title={t('historyTitle')} hint={t('historyNote')}>
        <select className="full-select" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">{t('wholeCommand')}</option>
          {['AMONA TAIL MINOR', 'MINOR-5', 'MINOR-6'].map((c) => <option key={c} value={`canal:${c}`}>{term(c)}</option>)}
          <option value="gat" disabled={selected?.kind !== 'gat'}>{t('selectedGat')}{selected?.kind === 'gat' ? ` (${selected.id})` : ` (${t('clickOne')})`}</option>
        </select>
        {hist && <Enlargeable onOpen={() => setBig('hist')}><HistoryChart rows={hist} current={season} /></Enlargeable>}
      </Section>
      {big === 'hist' && hist && <ChartModal title={t('historyTitle')} subtitle={scope === 'all' ? t('wholeCommand') : scope === 'gat' ? `${t('selectedGat')} ${selected?.id || ''}` : term(scope.slice(6))} onClose={() => setBig(null)}>
        <HistoryChart rows={hist} current={season} big /></ChartModal>}
      {big === 'tail' && tail && <ChartModal title={t('tailTitle')} subtitle={`${term(season.season)} ${digits(season.year)}. ${t('canalIrrigated')} (% ${t('cca')})`} onClose={() => setBig(null)}>
        <TailChart canals={tail.canals} season={season} onRabi={() => setSeason({ ...season, season: 'Rabi' })} /></ChartModal>}
    </>
  )
}

export function ManageTab({ meta, season, refresh, setPick, selected }) {
  const { t } = useI18n()
  const [mode, setMode] = useState('crop')
  return (
    <>
      <p className="hint">{t('manageIntro')}</p>
      <div className="seg wide">
        {['crop', 'owner', 'structure', 'upload', 'log'].map((k) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{t(`m_${k}`)}</button>)}
      </div>
      {mode === 'crop' && <CropForm meta={meta} season={season} refresh={refresh} selected={selected} />}
      {mode === 'owner' && <OwnerForm refresh={refresh} selected={selected} />}
      {mode === 'structure' && <StructureForm refresh={refresh} setPick={setPick} />}
      {mode === 'upload' && <UploadForm refresh={refresh} />}
      {mode === 'log' && <ChangeLog />}
    </>
  )
}

function useGatId(selected) {
  const [id, setId] = useState(selected?.kind === 'gat' ? selected.id : '')
  useEffect(() => { if (selected?.kind === 'gat') setId(selected.id) }, [selected])
  return [id, setId]
}

function CropForm({ meta, season, refresh, selected }) {
  const { t, term } = useI18n()
  const [gat, setGat] = useGatId(selected)
  const [f, setF] = useState({ year: season?.year, season: season?.season, crop: 'Soybean', area_ha: '', irrigation: 'Rainfed' })
  const [msg, setMsg] = useState('')
  const save = async (e) => {
    e.preventDefault()
    try { await api.setCrop({ gat_id: gat, ...f }); setMsg(`${t('saved')}: ${gat}`); refresh() } catch (x) { setMsg(x.message) }
  }
  return (
    <form className="form" onSubmit={save}>
      <label className="full">{t('gatField')}<input value={gat} onChange={(e) => setGat(e.target.value)} required /></label>
      <label>{t('year')}<input value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></label>
      <label>{t('season')}<select value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })}>{meta?.seasons.map((s) => <option key={s} value={s}>{term(s)}</option>)}</select></label>
      <label>{t('crop')}<select value={f.crop} onChange={(e) => setF({ ...f, crop: e.target.value })}>{Object.keys(CROP_COLORS).map((c) => <option key={c} value={c}>{term(c)}</option>)}</select></label>
      <label>{t('areaHa')}<input type="number" step="0.01" value={f.area_ha} onChange={(e) => setF({ ...f, area_ha: e.target.value })} required /></label>
      <label className="full">{t('irrig')}<div className="seg wide">{['Canal', 'Well', 'Rainfed'].map((s) => <button type="button" key={s} className={f.irrigation === s ? 'on' : ''} onClick={() => setF({ ...f, irrigation: s })}>{term(s)}</button>)}</div></label>
      <div className="full row"><button className="btn">{t('saveCrop')}</button><span className="ok-msg">{msg}</span></div>
    </form>
  )
}

function OwnerForm({ refresh, selected }) {
  const { t, num, person } = useI18n()
  const [gat, setGat] = useGatId(selected)
  const [g, setG] = useState(null)
  const [remove, setRemove] = useState([]); const [add, setAdd] = useState({ name: '', area_ha: '' })
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [msg, setMsg] = useState('')
  useEffect(() => { setG(null); if (gat) api.gat(gat).then(setG).catch(() => setG(null)) }, [gat])
  const save = async (e) => {
    e.preventDefault()
    try {
      const r = await api.ownership({ gat_id: gat, date, remove_owner_ids: remove, add_owners: add.name ? [{ name: add.name, area_ha: add.area_ha ? +add.area_ha : null }] : [] })
      setG(r); setRemove([]); setAdd({ name: '', area_ha: '' }); setMsg(t('ownerSaved')); refresh()
    } catch (x) { setMsg(x.message) }
  }
  return (
    <form className="form" onSubmit={save}>
      <label className="full">{t('gatField')}<input value={gat} onChange={(e) => setGat(e.target.value)} /></label>
      {g && <div className="full owner-picks">
        <div className="hint">{t('tickOwners')}</div>
        {g.owners.map((o) => <label key={o.id} className="check"><input type="checkbox" checked={remove.includes(o.id)} onChange={(e) => setRemove(e.target.checked ? [...remove, o.id] : remove.filter((x) => x !== o.id))} />{person(o)} <span className="muted">{num(o.area_ha, 3)}</span></label>)}
      </div>}
      <label>{t('newOwner')}<input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} /></label>
      <label>{t('areaHa')}<input type="number" step="0.001" value={add.area_ha} onChange={(e) => setAdd({ ...add, area_ha: e.target.value })} /></label>
      <label className="full">{t('mutationDate')}<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <div className="full row"><button className="btn" disabled={!g}>{t('recordChange')}</button><span className="ok-msg">{msg}</span></div>
    </form>
  )
}

function StructureForm({ refresh, setPick }) {
  const { t, term } = useI18n()
  const [f, setF] = useState({ type: 'Bridge', name: '', canal_id: '', chainage_m: '', year_built: '', built_by: '', owner_office: 'Khadakpurna Project Division, Deulgaon Raja', condition: 'Good', lat: '', lon: '' })
  const [msg, setMsg] = useState('')
  const save = async (e) => {
    e.preventDefault()
    try { const s = await api.addStructure(f); setMsg(`${t('saved')}: ${s.id}`); refresh() } catch (x) { setMsg(x.message) }
  }
  const types = ['Bridge', 'Well', 'Building', 'Office', 'Head regulator', 'Regulator', 'Aqueduct', 'CD work (culvert / siphon)', 'Outlet gate']
  return (
    <form className="form" onSubmit={save}>
      <div className="full type-pick">{types.map((ty) => (
        <button type="button" key={ty} className={f.type === ty ? 'on' : ''} onClick={() => setF({ ...f, type: ty })}><Icon name={ty} size={20} /><span>{term(ty)}</span></button>
      ))}</div>
      <label className="full">{t('name')}<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
      <label>{t('canal')}<select value={f.canal_id} onChange={(e) => setF({ ...f, canal_id: e.target.value })}><option value="">—</option>{['LBC', 'AMONA TAIL MINOR', 'MINOR-5', 'MINOR-6'].map((c) => <option key={c} value={c}>{term(c)}</option>)}</select></label>
      <label>RD (m)<input type="number" value={f.chainage_m} onChange={(e) => setF({ ...f, chainage_m: e.target.value })} /></label>
      <label>{t('builtIn')}<input type="number" value={f.year_built} onChange={(e) => setF({ ...f, year_built: e.target.value })} /></label>
      <label>{t('condition')}<select value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}>{Object.keys(CONDITION_COLORS).map((c) => <option key={c} value={c}>{term(c)}</option>)}</select></label>
      <label className="full">{t('builtBy')}<input value={f.built_by} onChange={(e) => setF({ ...f, built_by: e.target.value })} /></label>
      <div className="full row">
        <button type="button" className="btn ghost" onClick={() => setPick(() => (p) => setF((x) => ({ ...x, lat: p.lat, lon: p.lon })))}><Icon name="target" size={16} />{t('pickLocation')}</button>
        <span className="small muted">{f.lat ? `${f.lat}, ${f.lon}` : t('noLocation')}</span>
      </div>
      <div className="full row"><button className="btn" disabled={!f.lat}>{t('addStructure')}</button><span className="ok-msg">{msg}</span></div>
    </form>
  )
}

function UploadForm({ refresh }) {
  const { t, int } = useI18n()
  const [res, setRes] = useState(null); const [err, setErr] = useState('')
  const up = async (e) => {
    const file = e.target.files[0]; if (!file) return
    try { setRes(await api.upload(file)); setErr(''); refresh() } catch (x) { setErr(x.message) }
  }
  return (
    <div className="form">
      <p className="full hint">{t('uploadText')}</p>
      <div className="full row"><a className="btn ghost" href="/api/admin/template.xlsx"><Icon name="download" size={16} />{t('downloadTemplate')}</a>
        <label className="btn file">{t('uploadXlsx')}<input type="file" accept=".xlsx" onChange={up} /></label></div>
      {res && <p className="full ok-msg">{int(res.imported)} {t('imported')}. {res.errors.length ? `${int(res.errors.length)} ${t('skipped')}: ${res.errors.slice(0, 5).join('; ')}` : ''}</p>}
      {err && <p className="full error">{err}</p>}
    </div>
  )
}

function ChangeLog() {
  const { t, digits } = useI18n()
  const [rows, setRows] = useState(null)
  useEffect(() => { api.log().then(setRows) }, [])
  if (!rows) return null
  if (!rows.length) return <p className="hint">{t('noEdits')}</p>
  return <ol className="timeline">{rows.map((r) => <li key={r.id}><b className="num small">{digits(r.at)}</b><div>{r.entity} {r.entity_id}, {r.action}</div></li>)}</ol>
}
