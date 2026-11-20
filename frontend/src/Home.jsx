import { useEffect, useMemo, useState } from 'react'
import { api, reportUrls } from './api.js'
import { useI18n } from './i18n.js'
import { Icon } from './icons.jsx'
import { CROP_COLORS, CONDITION_COLORS, REACH_COLORS, themeLegend, THEME_LABEL } from './theme.js'
import { SearchBox, FindTab } from './Sidebar.jsx'

export function HomeTab({ select, setTab, setBrowseMode, openFlow, theme, meta, season, setSeason, tree, data, SeasonPicker }) {
  const { t, term } = useI18n()
  const [printing, setPrinting] = useState(false)
  const legend = themeLegend(theme)
  const present = useMemo(() => {
    if (theme !== 'crop' || !data?.parcels) return legend
    const crops = new Set(data.parcels.features.map((f) => f.properties.crop).filter(Boolean))
    return Object.fromEntries(Object.entries(legend).filter(([k]) => crops.has(k)))
  }, [theme, data?.parcels, legend])
  return (
    <div className="home">
      {SeasonPicker && <div className="mobile-only"><SeasonPicker meta={meta} season={season} setSeason={setSeason} light /></div>}
      <h3 className="home-title">{t('homeTitle')}</h3>
      <div className="home-search"><SearchBox select={select} /></div>
      <div className="tasks">
        <button onClick={() => { setBrowseMode('gats'); setTab('browse') }}><Icon name="field" size={26} /><span>{t('h_findGat')}</span></button>
        <button onClick={() => { setBrowseMode('farmers'); setTab('browse') }}><Icon name="farmer" size={26} /><span>{t('h_findFarmer')}</span></button>
        <button onClick={openFlow}><Icon name="flow" size={26} /><span>{t('h_route')}</span></button>
        <button className={printing ? 'on' : ''} onClick={() => setPrinting(!printing)}><Icon name="doc" size={26} /><span>{t('h_print')}</span></button>
      </div>
      {printing && <ReportPicker meta={meta} season={season} tree={tree} />}

      <section className="sec">
        <h4>{t('mapColours')}: {t(THEME_LABEL[theme])}</h4>
        <div className="legend">
          {Object.entries(present).map(([k, c]) => <div key={k}><i style={{ background: c }} />{['Head', 'Middle', 'Tail'].includes(k) ? t(k.toLowerCase()) : k === 'In command' ? t('inCommand') : k === 'Outside command' ? t('outside') : term(k)}</div>)}
        </div>
        <button className="link small" onClick={() => setTab('tools')}>{t('changeIn')}</button>
      </section>
    </div>
  )
}

function ReportPicker({ meta, season, tree }) {
  const { t, term, lang } = useI18n()
  const [kind, setKind] = useState('whole')
  const [id, setId] = useState('')
  const lbc = tree?.[0]
  const options = {
    whole: [],
    canal: (lbc?.children || []).map((c) => [c.id, term(c.name)]),
    outlet: [...(lbc?.outlets || []), ...(lbc?.children || []).flatMap((c) => c.outlets.map((o) => ({ ...o, canal: c.name })))]
      .map((o) => [o.chak_no, `${o.name}, ${term(o.canal || 'Left Bank Canal')} (${o.chainage_m} m)`]),
    village: (meta?.villages || []).map((v) => [v.id, term(v.name)]),
  }
  const params = kind === 'whole' ? { scope: 'canal', id: 'LBC' } : { scope: kind, id }
  const u = reportUrls({ ...params, ...season }, lang)
  const ready = kind === 'whole' || id
  return (
    <div className="report-picker">
      <div className="seg wide">
        {['whole', 'canal', 'outlet', 'village'].map((k) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setId('') }}>{t(`rp_${k}`)}</button>)}
      </div>
      {kind !== 'whole' && (
        <select className="full-select" value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">{t('pickOne')}</option>
          {options[kind].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
      <div className="row">
        <a className={`btn ${ready ? '' : 'disabled'}`} href={ready ? u.pdf : undefined} target="_blank" rel="noreferrer"><Icon name="doc" size={16} />{t('pdf')}</a>
        <a className={`btn ghost ${ready ? '' : 'disabled'}`} href={ready ? u.xlsx : undefined}><Icon name="download" size={16} />{t('excel')}</a>
      </div>
    </div>
  )
}

export function BrowseTab(ctx) {
  const { t } = useI18n()
  const { browseMode: mode, setBrowseMode: setMode } = ctx
  return (
    <>
      <div className="seg wide browse-seg">
        {['gats', 'farmers', 'structures', 'canals', 'filter'].map((k) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{t(`b_${k}`)}</button>)}
      </div>
      {mode === 'gats' && <GatList {...ctx} />}
      {mode === 'farmers' && <FarmerList {...ctx} />}
      {mode === 'structures' && <StructureList {...ctx} />}
      {mode === 'canals' && <CanalList {...ctx} />}
      {mode === 'filter' && <FindTab {...ctx} />}
    </>
  )
}

function GatList({ data, meta, select }) {
  const { t, term, digits, person, int } = useI18n()
  const [q, setQ] = useState(''); const [v, setV] = useState('')
  const all = useMemo(() => (data?.parcels?.features || []).map((f) => f.properties)
    .sort((a, b) => a.village_id.localeCompare(b.village_id) || +a.gat_no - +b.gat_no), [data?.parcels])
  const qq = q.replace(/[०-९]/g, (d) => '०१२३४५६७८९'.indexOf(d)).trim()
  const rows = all.filter((p) => (!v || p.village_id === v) && (!qq || String(p.gat_no).startsWith(qq)))
  return (
    <>
      <div className="list-tools">
        <input className="big-input" inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('typeGat')} autoFocus />
        <select value={v} onChange={(e) => setV(e.target.value)}>
          <option value="">{t('allVillages')}</option>
          {(meta?.villages || []).map((x) => <option key={x.id} value={x.id}>{term(x.name)}</option>)}
        </select>
      </div>
      <p className="hint">{t('showing')} {int(Math.min(rows.length, 300))} / {int(rows.length)}</p>
      <ul className="item-list">
        {rows.slice(0, 300).map((p) => (
          <li key={p.id}><button onClick={() => select({ kind: 'gat', id: p.id })}>
            <span className="il-num">{digits(p.gat_no)}</span>
            <span className="il-main"><b>{p.owner_first ? person(p, 'owner_first', 'owner_first_en') : t('outsideList')}</b>
              <small>{term(p.village)}{p.owner_count > 1 ? `, +${int(p.owner_count - 1)} ${t('othersN')}` : ''}</small></span>
            {p.crop && <span className="il-tag"><i style={{ background: CROP_COLORS[p.crop] }} />{term(p.crop)}</span>}
          </button></li>
        ))}
      </ul>
    </>
  )
}

function FarmerList({ select }) {
  const { t, term, digits, person } = useI18n()
  const [q, setQ] = useState(''); const [res, setRes] = useState(null)
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return }
    const h = setTimeout(() => api.search(q).then((r) => setRes(r.filter((x) => x.type === 'owner'))), 200)
    return () => clearTimeout(h)
  }, [q])
  return (
    <>
      <input className="big-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('typeName')} autoFocus />
      {!res && <p className="hint">{t('typeMore')}</p>}
      {res && !res.length && <p className="hint">{t('noMatch')}</p>}
      <ul className="item-list">
        {(res || []).map((r, i) => (
          <li key={i}><button onClick={() => select({ kind: 'gat', id: r.id })}>
            <span className="il-icon"><Icon name="farmer" size={20} /></span>
            <span className="il-main"><b>{person(r)}</b><small>{person(r) === r.name ? r.name_en : r.name}</small></span>
            <span className="il-tag">{t('gat')} {digits(r.gat_no)}, {term(r.village_id)}</span>
          </button></li>
        ))}
      </ul>
    </>
  )
}

function StructureList({ data, select }) {
  const { t, term, int } = useI18n()
  const groups = useMemo(() => {
    const g = {}
    ;(data?.structures?.features || []).forEach((f) => { (g[f.properties.type] ||= []).push(f.properties) })
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length)
  }, [data?.structures])
  return groups.map(([type, items]) => (
    <section key={type} className="sec">
      <h4 className="with-icon"><span className="sicon"><Icon name={type} size={16} /></span>{term(type)} <span className="count">{int(items.length)}</span></h4>
      <ul className="item-list">
        {items.map((s) => (
          <li key={s.id}><button onClick={() => select({ kind: 'structure', id: s.id })}>
            <span className="il-cond" style={{ background: CONDITION_COLORS[s.condition] }} />
            <span className="il-main"><b>{s.name}</b><small>{s.id}{s.canal_id ? `, ${term(s.canal_id)}` : ''}</small></span>
            <span className="il-tag">{term(s.condition)}</span>
          </button></li>
        ))}
      </ul>
    </section>
  ))
}

function CanalList({ tree, select }) {
  const { t, term, int, num } = useI18n()
  if (!tree) return null
  const lbc = tree[0]
  const outletRow = (o) => (
    <li key={o.id}><button onClick={() => select({ kind: 'outlet', id: o.chak_no })}>
      <span className="il-cond" style={{ background: REACH_COLORS[o.reach] }} />
      <span className="il-main"><b>{o.name}</b><small>{int(o.chainage_m)} m, {t(o.reach.toLowerCase())}</small></span>
      <span className="il-tag">{int(o.totals.gats)} {t('gats')}, {num(o.totals.cca_ha, 1)} {t('ha')}</span>
    </button></li>
  )
  return (
    <>
      {[lbc, ...lbc.children].map((c) => (
        <section key={c.id} className="sec">
          <button className="canal-head" onClick={() => select({ kind: 'canal', id: c.id })}>
            <Icon name="flow" size={18} /><b>{term(c.name)}</b><span>{int(c.totals.gats)} {t('gats')}, {num(c.totals.cca_ha, 1)} {t('ha')}</span>
          </button>
          <ul className="item-list">{c.outlets.map(outletRow)}</ul>
        </section>
      ))}
    </>
  )
}
