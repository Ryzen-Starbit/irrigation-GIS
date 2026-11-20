import { useEffect, useState } from 'react'
import { api, reportUrls } from './api.js'
import { useI18n } from './i18n.js'
import { CROP_COLORS, CONDITION_COLORS, REACH_COLORS } from './theme.js'
import { Icon } from './icons.jsx'
import Term from './Term.jsx'

export default function QuickCard({ sel, season, data, parcelIndex, onMore, onClose, showRoute, setShowRoute, openFlow, onStation }) {
  const { t, term, num, int, digits, person, lang } = useI18n()
  const [d, setD] = useState(null)

  useEffect(() => {
    setD(null)
    if (sel.kind === 'gat') api.gat(sel.id, season).then(setD).catch(() => setD({ error: true }))
    if (sel.kind === 'outlet') api.outlet(sel.id, season).then(setD).catch(() => setD({ error: true }))
    if (sel.kind === 'canal') api.canal(sel.id, season).then(setD).catch(() => setD({ error: true }))
    if (sel.kind === 'structure') api.structure(sel.id).then(setD).catch(() => setD({ error: true }))
  }, [sel.kind, sel.id, season?.year, season?.season])

  const R = (params) => reportUrls({ ...params, ...season }, lang)
  let body = null
  if (!d) body = <div className="qc-loading"><i /><i /><i /></div>
  else if (d.error) body = <p className="error">—</p>
  else if (sel.kind === 'gat') {
    const g = d, c = g.chaks?.[0]
    const crop = g.current?.[0]
    body = (
      <>
        <div className="qc-head">
          <span className="qc-kind"><Icon name="field" size={16} />{t('gat')}, {term(g.village)}</span>
          <h2>{digits(g.gat_no)}</h2>
          {g.in_command ? <span className="qc-flag ok">{t('inCommand')}</span> : <span className="qc-flag">{t('c_noCanal')}</span>}
        </div>
        <dl className="qc-facts">
          <div><dt>{t('c_owner')}</dt><dd>{g.owners[0] ? <>{person(g.owners[0])}{g.owners.length > 1 && <small> +{int(g.owners.length - 1)} {t('othersN')}</small>}</> : '—'}</dd></div>
          <div><dt>{t('c_area')}</dt><dd>{num(g.total_ha ?? g.map_area_ha, 2)} {t('ha')}{g.pot_kharab_ha ? <small> ({t('potKharab')} {num(g.pot_kharab_ha, 2)})</small> : null}</dd></div>
          <div><dt>{t('c_cropNow')}</dt><dd>{crop ? <><i className="dot" style={{ background: CROP_COLORS[crop.crop] }} />{term(crop.crop)}, {term(crop.irrigation)}</> : '—'}</dd></div>
          <div><dt>{t('c_waterFrom')}</dt><dd>{c ? <>{t('outlet')} {c.outlet}, {term(c.canal)} <small>({t(c.reach.toLowerCase())})</small></> : <>{t('nearestCanal')}: {term(g.nearest?.canal)}</>}</dd></div>
        </dl>
        <div className="qc-actions">
          {c && <button className={`qbtn ${showRoute ? 'on' : ''}`} onClick={() => setShowRoute(!showRoute)}><Icon name="flow" size={20} /><span>{t('waterRoute')}</span></button>}
          {g.record_url
            ? <a className="qbtn" href={g.record_url} target="_blank" rel="noreferrer"><Icon name="doc" size={20} /><span>{t('c_712')}</span></a>
            : <button className="qbtn" disabled title={t('record712Missing')}><Icon name="doc" size={20} /><span>{t('c_712')}</span></button>}
          <a className="qbtn" href={R({ scope: 'gat', id: g.id }).pdf} target="_blank" rel="noreferrer"><Icon name="download" size={20} /><span>{t('c_print')}</span></a>
          <button className="qbtn more" onClick={onMore}><Icon name="info" size={20} /><span>{t('moreDetails')}</span></button>
        </div>
      </>
    )
  } else if (sel.kind === 'outlet') {
    const o = d.outlet
    body = (
      <>
        <div className="qc-head">
          <span className="qc-kind"><Icon name="target" size={16} /><Term k="outlet">{t('outlet')}</Term>, <Term k="chak">{t('chak')} {digits(o.chak_no)}</Term></span>
          <h2>{o.name}</h2>
          <span className="qc-flag" style={{ color: REACH_COLORS[o.reach], borderColor: REACH_COLORS[o.reach] }}>{t(o.reach.toLowerCase())}</span>
        </div>
        <dl className="qc-facts">
          <div><dt>{t('onCanal')}</dt><dd>{term(o.canal)}, <Term k="chainage">{int(o.chainage_m)} m</Term></dd></div>
          <div><dt>{t('gatsServed')}</dt><dd>{int(d.totals.gats)} {t('gats')}, {int(d.totals.farmers)} {t('farmers')}</dd></div>
          <div><dt><Term k="cca">{t('cca')}</Term></dt><dd>{num(d.totals.cca_ha, 1)} {t('ha')}</dd></div>
        </dl>
        <div className="qc-actions">
          <button className="qbtn" onClick={() => onStation(d.gats.map((g) => g.id))}><Icon name="field" size={20} /><span>{t('c_showFields')}</span></button>
          <a className="qbtn" href={R({ scope: 'outlet', id: o.chak_no }).pdf} target="_blank" rel="noreferrer"><Icon name="download" size={20} /><span>{t('c_print')}</span></a>
          <button className="qbtn more" onClick={onMore}><Icon name="info" size={20} /><span>{t('moreDetails')}</span></button>
        </div>
      </>
    )
  } else if (sel.kind === 'canal') {
    body = (
      <>
        <div className="qc-head">
          <span className="qc-kind"><Icon name="flow" size={16} />{d.level === 'main' ? t('mainCanal') : t('minor')}</span>
          <h2 className="qc-h-sm">{term(d.name)}</h2>
        </div>
        <dl className="qc-facts">
          <div><dt>{t('gatsServed')}</dt><dd>{int(d.totals.gats)} {t('gats')}, {int(d.totals.farmers)} {t('farmers')}</dd></div>
          <div><dt><Term k="cca">{t('cca')}</Term></dt><dd>{num(d.totals.cca_ha, 1)} {t('ha')}</dd></div>
          <div><dt>{t('l_outlets')}</dt><dd>{int((d.outlets?.length || 0) + (d.children || []).reduce((a, c) => a + c.outlets.length, 0))}</dd></div>
        </dl>
        <div className="qc-actions">
          <button className="qbtn" onClick={openFlow}><Icon name="flow" size={20} /><span>{t('flowDiagram')}</span></button>
          <a className="qbtn" href={R({ scope: 'canal', id: d.id }).pdf} target="_blank" rel="noreferrer"><Icon name="download" size={20} /><span>{t('c_print')}</span></a>
          <button className="qbtn more" onClick={onMore}><Icon name="info" size={20} /><span>{t('moreDetails')}</span></button>
        </div>
      </>
    )
  } else if (sel.kind === 'structure') {
    body = (
      <>
        <div className="qc-head">
          <span className="qc-kind"><Icon name={d.type} size={16} />{term(d.type)}</span>
          <h2 className="qc-h-sm">{d.name}</h2>
          <span className="qc-flag solid" style={{ background: CONDITION_COLORS[d.condition] }}>{term(d.condition)}</span>
        </div>
        <div className="qc-photo">{d.photo ? <img src={d.photo} alt={d.name} /> : <Icon name={d.type} size={40} stroke={1.3} />}</div>
        <dl className="qc-facts">
          {d.canal && <div><dt>{t('canalLbl')}</dt><dd>{term(d.canal)}{d.chainage_m ? `, ${int(d.chainage_m)} m` : ''}</dd></div>}
          <div><dt>{t('c_builtIn')}</dt><dd>{digits(d.year_built) || '—'}</dd></div>
          <div><dt>{t('inspections')}</dt><dd>{d.inspections[0] ? `${digits(d.inspections[0].date)}: ${d.inspections[0].finding}` : '—'}</dd></div>
        </dl>
        <div className="qc-actions">
          <button className="qbtn more" onClick={onMore}><Icon name="info" size={20} /><span>{t('moreDetails')}</span></button>
        </div>
      </>
    )
  }
  return (
    <section className="quickcard" aria-live="polite">
      <div className="qc-grip" aria-hidden />
      <button className="icon-btn qc-close" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button>
      {body}
    </section>
  )
}
