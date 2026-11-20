import { useEffect, useMemo, useState } from 'react'
import { api, reportUrls } from './api.js'
import { useI18n } from './i18n.js'
import { CROP_COLORS, CONDITION_COLORS, REACH_COLORS } from './theme.js'
import { Icon } from './icons.jsx'
import FlowDiagram from './FlowDiagram.jsx'
import Term from './Term.jsx'

export default function DetailPanel({ sel, season, onClose, onBack, ...ctx }) {
  const { t } = useI18n()
  return (
    <section className="detail" aria-live="polite">
      <div className="d-bar">
        {onBack && <button className="back-btn" onClick={onBack}><Icon name="chevron" size={16} className="flip" />{t('back')}</button>}
        <button className="close icon-btn" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button>
      </div>
      {sel.kind === 'gat' && <GatDetail id={sel.id} season={season} {...ctx} />}
      {sel.kind === 'outlet' && <OutletDetail chak={sel.id} season={season} {...ctx} />}
      {sel.kind === 'canal' && <CanalDetail id={sel.id} season={season} {...ctx} />}
      {sel.kind === 'structure' && <StructureDetail id={sel.id} {...ctx} />}
    </section>
  )
}

function useLoad(fn, deps) {
  const [d, setD] = useState(null); const [err, setErr] = useState(null)
  useEffect(() => { setD(null); fn().then(setD).catch((e) => setErr(e.message)) }, deps) 
  return [d, err, setD]
}

export function Reports({ params }) {
  const { t, lang } = useI18n()
  const u = reportUrls(params, lang)
  return (
    <div className="reports">
      <a className="btn" href={u.pdf} target="_blank" rel="noreferrer"><Icon name="doc" size={16} />{t('pdf')}</a>
      <a className="btn ghost" href={u.xlsx}><Icon name="download" size={16} />{t('excel')}</a>
    </div>
  )
}

export function CountUp({ value, d = 0 }) {
  const { num } = useI18n()
  const [v, setV] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(value); return }
    let raf, start
    const step = (ts) => { start ??= ts; const p = Math.min(1, (ts - start) / 650); setV(value * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{num(v, d)}</>
}

export function Stat({ label, value, unit, d = 0 }) {
  return <div className="stat"><div className="stat-v"><CountUp value={value || 0} d={d} /><span>{unit}</span></div><div className="stat-l">{label}</div></div>
}

export function CropBars({ crops }) {
  const { t, term, num } = useI18n()
  const total = Object.values(crops || {}).reduce((a, b) => a + b, 0)
  if (!total) return <p className="muted">{t('noCrop')}</p>
  return (
    <div className="cropbars">
      <div className="stack">{Object.entries(crops).map(([c, a]) => <span key={c} title={`${term(c)}: ${num(a)} ${t('ha')}`} style={{ flexGrow: a, background: CROP_COLORS[c] || '#bbb' }} />)}</div>
      <ul>{Object.entries(crops).map(([c, a]) => <li key={c}><i style={{ background: CROP_COLORS[c] || '#bbb' }} />{term(c)}<b>{num(a, 1)}</b></li>)}</ul>
    </div>
  )
}

function Totals({ tt }) {
  const { t } = useI18n()
  return (
    <div className="stats">
      <Stat label={t('gats')} value={tt.gats} />
      <Stat label={t('farmers')} value={tt.farmers} />
      <Stat label={<Term k="cca">{t('cca')}</Term>} value={tt.cca_ha} unit={` ${t('ha')}`} d={1} />
      <Stat label={<Term k="ica">{t('ica')}</Term>} value={tt.ica_ha} unit={` ${t('ha')}`} d={1} />
      <Stat label={<Term k="gca">{t('gca')}</Term>} value={tt.gca_ha} unit={` ${t('ha')}`} d={1} />
      <Stat label={<Term k="kharab">{t('potKharab')}</Term>} value={tt.pot_kharab_ha} unit={` ${t('ha')}`} d={1} />
    </div>
  )
}

export function GatTable({ gats, select, showOutlet = false }) {
  const { t, term, num, digits } = useI18n()
  const [q, setQ] = useState('')
  const rows = q ? gats.filter((g) => String(g.gat_no).includes(q.replace(/[०-९]/g, (d) => '०१२३४५६७८९'.indexOf(d)))) : gats
  return (
    <>
      {gats.length > 12 && <input className="mini-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${t('gatNo')}…`} />}
      <div className="tablewrap">
        <table className="tbl click">
          <thead><tr><th>{t('gat')}</th><th>{t('village')}</th>{showOutlet && <th>{t('outlet')}</th>}<th className="r">{t('cca')}</th><th>{t('crop')}</th><th className="r">{t('owners')}</th></tr></thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id + (g.outlet || '')} onClick={() => select({ kind: 'gat', id: g.id })} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && select({ kind: 'gat', id: g.id })}>
                <td className="num strong">{digits(g.gat_no)}</td><td>{term(g.village)}</td>{showOutlet && <td>{g.outlet}</td>}
                <td className="r num">{num(g.cca_ha)}</td>
                <td><i className="dot" style={{ background: CROP_COLORS[g.crop] || 'transparent' }} />{term(g.crop) || '—'}</td>
                <td className="r num">{digits(g.owner_count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Head({ kicker, title, children, accent }) {
  return (
    <div className="d-head" style={accent ? { '--accent': accent } : undefined}>
      <div className="kicker">{kicker}</div>
      <h2>{title}</h2>
      {children}
    </div>
  )
}

function GatDetail({ id, season, select, route, showRoute, setShowRoute }) {
  const { t, term, num, int, digits, person } = useI18n()
  const [g, err] = useLoad(() => api.gat(id, season), [id, season?.year, season?.season])
  if (err) return <p className="error">{err}</p>
  if (!g) return <Skeleton />
  const byYear = {}
  g.crops.forEach((c) => { (byYear[c.year] ||= {})[c.season] = [...((byYear[c.year] || {})[c.season] || []), c] })
  const sample = g.crops.some((c) => c.data_source === 'sample')
  const kh = g.pot_kharab_pct || 0
  return (
    <>
      <Head kicker={`${t('gatNo')}, ${term(g.village)}`} title={digits(g.gat_no)} accent={g.in_command ? 'var(--water)' : 'var(--ink-3)'}>
        <div className="badges">
          {g.in_command ? <span className="badge ok">{t('inCommand')}</span> : <span className="badge">{t('outside')}</span>}
          {g.tail_end && <span className="badge tail">{t('tailEnd')}</span>}
          {g.shape_approx ? <span className="badge warn">{t('approx')}</span> : null}
        </div>
      </Head>

      {!g.in_command && (
        <div className="explain">
          <Icon name="info" size={18} />
          <div>
            <b>{t('whyNoData')}</b>
            <p>{t('whyNoDataText')}</p>
            {g.nearest && <p className="muted">{t('nearestCanal')}: {term(g.nearest.canal)}, ~{int(g.nearest.canal_m)} m {t('away')}. {t('nearestOutlet')}: {g.nearest.outlet?.name} ({t('chak')} {digits(g.nearest.outlet?.chak_no)}), ~{int(g.nearest.outlet_m)} m.</p>}
          </div>
        </div>
      )}

      <h3>{t('area')}</h3>
      {g.in_command ? (
        <>
          <div className="area-bar" title={`${t('cultivable')} ${num(g.cultivable_ha, 3)} / ${t('potKharab')} ${num(g.pot_kharab_ha, 3)}`}>
            <span className="cult" style={{ flexGrow: g.cultivable_ha || 0 }} /><span className="kharab" style={{ flexGrow: g.pot_kharab_ha || 0 }} />
          </div>
          <dl className="kv">
            <dt>{t('totalArea')}</dt><dd>{num(g.total_ha, 3)} {t('ha')}</dd>
            <dt><i className="sq cult" />{t('cultivable')}</dt><dd>{num(g.cultivable_ha, 3)} {t('ha')}</dd>
            <dt><i className="sq kharab" /><Term k="kharab">{t('potKharab')}</Term></dt><dd>{num(g.pot_kharab_ha, 3)} {t('ha')} <span className="muted">({num(kh, 1)}%)</span></dd>
            <dt><Term k="cca">{t('ccaIca')}</Term></dt><dd>{num(g.cca_ha, 3)} / {num(g.ica_ha, 3)} {t('ha')}</dd>
            <dt className="muted">{t('mapArea')}</dt><dd className="muted">{num(g.map_area_ha, 2)} {t('ha')}</dd>
          </dl>
        </>
      ) : (
        <dl className="kv"><dt>{t('mapArea')}</dt><dd>~{num(g.map_area_ha, 2)} {t('ha')}</dd></dl>
      )}

      {g.in_command ? <>
        <h3>{t('owners')} <span className="count">{int(g.owners.length)}</span></h3>
        <div className="owners">
          {g.owners.map((o) => (
            <div className="owner" key={o.id}>
              <div className="owner-name">{person(o)}{o.name_en && <small>{lang2(o, person)}</small>}</div>
              <div className="owner-share">
                <span className="num">{o.area_ha ? `${num(o.area_ha, 3)} ${t('ha')}` : '—'}</span>
                {o.share_pct ? <div className="sharebar"><span style={{ width: `${Math.min(100, o.share_pct)}%` }} /></div> : null}
              </div>
            </div>
          ))}
        </div>
        {g.past_owners.length > 0 && <p className="muted small">{t('pastOwners')}: {g.past_owners.map((o) => `${person(o)} (${t('until')} ${digits(o.valid_to || '—')})`).join(', ')}</p>}
      </> : null}

      {g.chaks.length > 0 && <>
        <h3>{t('servedBy')}</h3>
        {g.chaks.map((c) => (
          <div className="chain" key={c.chak_no}>
            <button className="chain-step" onClick={() => select({ kind: 'canal', id: 'LBC' })}><Icon name="drop" size={14} />{term('Left Bank Canal')}</button>
            {c.canal_id !== 'LBC' && <button className="chain-step" onClick={() => select({ kind: 'canal', id: c.canal_id })}>{term(c.canal)}</button>}
            <button className="chain-step" onClick={() => select({ kind: 'outlet', id: c.chak_no })}>{c.outlet} @ {int(c.chainage_m)} m</button>
            <span className="chain-end"><i className="dot" style={{ background: REACH_COLORS[c.reach] }} />{t('chak')} {digits(c.chak_no)}, {t(c.reach.toLowerCase())}{g.chaks.length > 1 ? `, ${t('cca')} ${num(c.cca_ha)} ${t('ha')}` : ''}</span>
          </div>
        ))}
      </>}

      {g.chaks.length > 0 && (
        <>
          <h3>{t('waterRoute')} <button className="link small" onClick={() => setShowRoute(!showRoute)}>{showRoute ? t('hideRoute') : t('showRoute')}</button></h3>
          <ol className="route">
            <li><b>{term('Left Bank Canal')}</b><span>{route ? `${num(route.steps.lbc_m / 1000, 2)} ${t('km')}` : ''}</span></li>
            {g.chaks[0].canal_id !== 'LBC' && <li><b>{term(g.chaks[0].canal)}</b><span>{route ? `${num(route.steps.minor_m / 1000, 2)} ${t('km')}` : ''}</span></li>}
            <li><b>{t('outlet')} {g.chaks[0].outlet}</b><span>@ {int(g.chaks[0].chainage_m)} m</span></li>
            <li className="dest"><b>{t('fieldChannel')} → {t('gat')} {digits(g.gat_no)}</b><span>{route ? `~${int(route.steps.channel_m)} m` : ''}</span></li>
          </ol>
          <p className="hint">{t('routeText')}</p>
        </>
      )}

      <h3>{t('crops')} {sample && <span className="badge sample">{t('sample')}</span>}</h3>
      <div className="seasons">
        {Object.entries(byYear).map(([y, s]) => (
          <div key={y} className={`season-row ${y === season.year ? 'cur' : ''}`}>
            <div className="num strong">{digits(y)}</div>
            {['Kharif', 'Rabi', 'Hot weather'].map((k) => (
              <div key={k} className={`season-cell ${k === season.season && y === season.year ? 'now' : ''}`}>
                <small>{term(k)}</small>
                {(s[k] || []).map((c) => <div key={c.id}><i className="dot" style={{ background: CROP_COLORS[c.crop] }} />{term(c.crop)}<em>{term(c.irrigation)}</em></div>)}
                {!(s[k] || []).length && <span className="muted">—</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="d-actions">
        {g.record_url
          ? <a className="btn ghost" href={g.record_url} target="_blank" rel="noreferrer"><Icon name="doc" size={16} />{t('record712')}</a>
          : g.record_expected && <div className="missing712"><Icon name="doc" size={16} /><div><b>{t('record712Missing')}</b><small>{t('copy712')} <code>{g.record_expected}</code> {t('toEnable')}</small></div></div>}
        <Reports params={{ scope: 'gat', id: g.id, ...season }} />
      </div>
    </>
  )
}
const lang2 = (o, person) => (person(o) === o.name ? o.name_en : o.name)

function OutletDetail({ chak, season, select, setHighlight, zoomToGats }) {
  const { t, term, int, digits } = useI18n()
  const [d, err] = useLoad(() => api.outlet(chak, season), [chak, season?.year, season?.season])
  useEffect(() => { if (d) setHighlight(d.gats.map((g) => g.id)) }, [d])  
  if (err) return <p className="error">{err}</p>
  if (!d) return <Skeleton />
  const o = d.outlet
  return (
    <>
      <Head kicker={`${t('outlet')}, ${t('chak')} ${digits(o.chak_no)}`} title={o.name} accent={REACH_COLORS[o.reach]}>
        <div className="badges">
          <Term k="reach"><span className="badge" style={{ borderColor: REACH_COLORS[o.reach], color: REACH_COLORS[o.reach] }}>{t(o.reach.toLowerCase())} {t('reachLbl')}</span></Term>
          {o.is_tail ? <span className="badge tail">{t('tailOutlet')}</span> : null}
        </div>
        <p className="muted">{t('onCanal')} <button className="link" onClick={() => select({ kind: 'canal', id: o.canal_id })}>{term(o.canal)}</button> <Term k="chainage">{t('atChainage')} {int(o.chainage_m)} m</Term></p>
      </Head>
      <Totals tt={d.totals} />
      <h3>{t('cropArea')}, {term(season.season)} {digits(season.year)}</h3>
      <CropBars crops={d.totals.crop_area_ha} />
      <h3>{t('gatsServed')} <span className="count">{int(d.gats.length)}</span> <button className="link small" onClick={() => zoomToGats(d.gats.map((g) => g.id))}>{t('zoom')}</button></h3>
      <GatTable gats={d.gats} select={select} />
      <div className="d-actions"><Reports params={{ scope: 'outlet', id: o.chak_no, ...season }} /></div>
    </>
  )
}

function collect(n, out = []) {
  n.outlets?.forEach((o) => o.gats.forEach((g) => out.push({ ...g, outlet: o.name })))
  n.children?.forEach((c) => collect(c, out))
  return out
}

function CanalDetail({ id, season, select, setHighlight, zoomToGats, tree, openFlow, mobile }) {
  const { t, term, int, digits } = useI18n()
  const [n, err] = useLoad(() => api.canal(id, season), [id, season?.year, season?.season])
  const gats = useMemo(() => {
    if (!n) return []
    const seen = new Map()
    collect(n).forEach((g) => { if (!seen.has(g.id)) seen.set(g.id, g) })
    return [...seen.values()].sort((a, b) => a.village.localeCompare(b.village) || +a.gat_no - +b.gat_no)
  }, [n])
  useEffect(() => { if (n) setHighlight(gats.map((g) => g.id)) }, [n])  
  if (err) return <p className="error">{err}</p>
  if (!n) return <Skeleton />
  return (
    <>
      <Head kicker={`${n.level === 'main' ? t('mainCanal') : t('minor')}${n.offtake_rd_m ? `, ${t('offtakeAt')} ${int(n.offtake_rd_m)} m` : ''}`} title={term(n.name)} accent="var(--water)">
        <p className="muted">{t('canalTotals')}</p>
      </Head>
      <Totals tt={n.totals} />
      <h3>{t('flowDiagram')}</h3>
      <div className="mini-flow"><FlowDiagram tree={tree} compact narrow={mobile} focus={n.id} onSelect={select} /></div>
      <button className="link small" onClick={openFlow}>{t('flowDiagram')}</button>
      <h3>{t('cropArea')}, {term(season.season)} {digits(season.year)}</h3>
      <CropBars crops={n.totals.crop_area_ha} />
      <h3>{t('gatsServed')} <span className="count">{int(gats.length)}</span> <button className="link small" onClick={() => zoomToGats(gats.map((g) => g.id))}>{t('zoom')}</button></h3>
      <GatTable gats={gats} select={select} showOutlet />
      <div className="d-actions"><Reports params={{ scope: 'canal', id: n.id, ...season }} /></div>
    </>
  )
}

function StructureDetail({ id, refresh }) {
  const { t, term, int, digits } = useI18n()
  const [s, err, setS] = useLoad(() => api.structure(id), [id])
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), finding: '', repair_done: '', condition_after: 'Good', inspected_by: '' })
  const [msg, setMsg] = useState('')
  if (err) return <p className="error">{err}</p>
  if (!s) return <Skeleton />
  const save = async (e) => {
    e.preventDefault()
    try { setS(await api.addInspection(id, form)); setMsg(t('saved')); refresh() } catch (x) { setMsg(x.message) }
  }
  return (
    <>
      <Head kicker={term(s.type)} title={<span className="h2-sm">{s.name}</span>} accent={CONDITION_COLORS[s.condition]}>
        <div className="badges">
          <span className="badge solid" style={{ background: CONDITION_COLORS[s.condition] }}>{term(s.condition)}</span>
          {s.details_source === 'sample' && <span className="badge sample">{t('sample')}</span>}
        </div>
      </Head>
      <div className="photo">
        {s.photo ? <img src={s.photo} alt={s.name} /> : <><Icon name={s.type in { Well: 1, Bridge: 1, Building: 1, Office: 1, 'Head regulator': 1 } ? s.type : 'CD work (culvert / siphon)'} size={44} stroke={1.4} /><span>{t('noPhoto')} {s.id}.jpg</span></>}
      </div>
      <dl className="kv">
        <dt>{t('structureId')}</dt><dd>{s.id}</dd>
        {s.canal && <><dt>{t('canalLbl')}</dt><dd>{term(s.canal)}{s.chainage_m ? ` @ ${int(s.chainage_m)} m` : ''}</dd></>}
        <dt>{t('builtIn')}</dt><dd>{digits(s.year_built) || '—'}</dd>
        <dt>{t('builtBy')}</dt><dd>{s.built_by || '—'}</dd>
        <dt>{t('maintainedBy')}</dt><dd>{s.owner_office || '—'}</dd>
        {s.cost_lakh && <><dt>{t('cost')}</dt><dd>₹ {digits(s.cost_lakh)} {t('lakh')}</dd></>}
        <dt className="muted">{t('locFrom')}</dt><dd className="muted">{s.location_source}</dd>
      </dl>
      <h3>{t('inspections')} <span className="count">{int(s.inspections.length)}</span></h3>
      <ol className="timeline">
        {s.inspections.map((i) => (
          <li key={i.id} style={{ '--c': CONDITION_COLORS[i.condition_after] }}>
            <div className="tl-head"><b className="num">{digits(i.date)}</b><span className="pill" style={{ background: CONDITION_COLORS[i.condition_after] }}>{term(i.condition_after)}</span></div>
            <div>{i.finding}</div>
            {i.repair_done && <div className="muted">{t('repair')}: {i.repair_done}</div>}
            <div className="muted small">{i.inspected_by}</div>
          </li>
        ))}
      </ol>
      <h3>{t('recordInspection')}</h3>
      <form className="form" onSubmit={save}>
        <label>{t('date')}<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
        <label>{t('condition')}<select value={form.condition_after} onChange={(e) => setForm({ ...form, condition_after: e.target.value })}>{Object.keys(CONDITION_COLORS).map((c) => <option key={c} value={c}>{term(c)}</option>)}</select></label>
        <label className="full">{t('found')}<input value={form.finding} onChange={(e) => setForm({ ...form, finding: e.target.value })} /></label>
        <label className="full">{t('repair')}<input value={form.repair_done} onChange={(e) => setForm({ ...form, repair_done: e.target.value })} /></label>
        <label className="full">{t('inspectedBy')}<input value={form.inspected_by} onChange={(e) => setForm({ ...form, inspected_by: e.target.value })} /></label>
        <div className="full row"><button className="btn" type="submit">{t('saveInspection')}</button>{msg && <span className="ok-msg">{msg}</span>}</div>
      </form>
    </>
  )
}

function Skeleton() {
  return <div className="skeleton" aria-hidden><i style={{ width: '40%' }} /><i style={{ width: '70%', height: 34 }} /><i /><i /><i style={{ width: '85%' }} /><i style={{ width: '60%' }} /></div>
}
