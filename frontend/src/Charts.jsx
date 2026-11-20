import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from './i18n.js'
import { CROP_COLORS, REACH_COLORS } from './theme.js'
import { Icon } from './icons.jsx'

export function ChartModal({ title, subtitle, onClose, children }) {
  const { t } = useI18n()
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-btn" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button></header>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Enlargeable({ onOpen, children }) {
  const { t } = useI18n()
  return (
    <div className="enlargeable" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()} title={t('enlarge')}>
      {children}
      <span className="enlarge-btn"><Icon name="expand" size={15} />{t('enlarge')}</span>
    </div>
  )
}

export function HistoryChart({ rows, current, big = false }) {
  const { t, term, num, digits } = useI18n()
  const [hover, setHover] = useState(null)
  const totals = rows.map((r) => Object.values(r.crop_area_ha).reduce((a, b) => a + b, 0))
  const max = Math.max(1, ...totals)
  const crops = [...new Set(rows.flatMap((r) => Object.keys(r.crop_area_ha)))]
  const W = big ? 960 : 320, H = big ? 360 : 190, L = big ? 52 : 0, bw = (W - L) / rows.length
  const nice = Math.ceil(max / 100) * 100
  const ticks = big ? [0, 0.25, 0.5, 0.75, 1].map((f) => f * nice) : []
  const yOf = (v) => H - (v / (big ? nice : max)) * (H - 10)
  return (
    <div className={`hist ${big ? 'big' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H + 40}`} role="img" aria-label={t('historyTitle')}>
        {ticks.map((v) => (
          <g key={v} className="grid"><line x1={L} x2={W} y1={yOf(v)} y2={yOf(v)} /><text x={L - 8} y={yOf(v) + 4} textAnchor="end">{num(v, 0)}</text></g>
        ))}
        {rows.map((r, i) => {
          let acc = 0
          const isCur = current && r.year === current.year && r.season === current.season
          const x = L + i * bw
          return (
            <g key={i}>
              {Object.entries(r.crop_area_ha).map(([c, a]) => {
                const y1 = yOf(acc), y0 = yOf(acc + a); acc += a
                return <rect key={c} className={`bar-seg ${hover && hover.c !== c ? 'fade' : ''}`} x={x + bw * 0.18} y={y0} width={bw * 0.64} height={Math.max(0, y1 - y0)}
                  fill={CROP_COLORS[c] || '#bbb'} style={{ animationDelay: `${i * 40}ms` }}
                  onMouseEnter={() => setHover({ c, a, r })} onMouseLeave={() => setHover(null)}>
                  <title>{`${term(r.season)} ${digits(r.year)}: ${term(c)} ${num(a)} ${t('ha')}`}</title></rect>
              })}
              {big && totals[i] > 0 && <text x={x + bw / 2} y={yOf(totals[i]) - 6} textAnchor="middle" className="tot">{num(totals[i], 0)}</text>}
              {isCur && <rect x={x + 2} y={2} width={bw - 4} height={H - 1} fill="none" className="cur-box" />}
              <text x={x + bw / 2} y={H + 15} textAnchor="middle" className="ax">{big ? term(r.season) : term(r.season).slice(0, 5)}</text>
              {r.season === 'Kharif' && <text x={x + bw * 1.5} y={H + 33} textAnchor="middle" className="ax strong">{digits(r.year)}</text>}
            </g>
          )
        })}
        <line x1={L} x2={W} y1={H} y2={H} className="axis" />
      </svg>
      <div className="hist-hover">{hover ? <><i style={{ background: CROP_COLORS[hover.c] }} /><b>{term(hover.c)}</b> {num(hover.a, 1)} {t('ha')}, {term(hover.r.season)} {digits(hover.r.year)}</> : big ? t('hoverBars') : ''}</div>
      <div className="legend inline">{crops.map((c) => <div key={c}><i style={{ background: CROP_COLORS[c] }} />{term(c)}</div>)}</div>
      {big && (
        <div className="tablewrap big-table">
          <table className="tbl">
            <thead><tr><th>{t('crop')}</th>{rows.map((r, i) => <th key={i} className="r">{term(r.season)}<br />{digits(r.year)}</th>)}</tr></thead>
            <tbody>
              {crops.map((c) => <tr key={c}><td><i className="dot" style={{ background: CROP_COLORS[c] }} />{term(c)}</td>{rows.map((r, i) => <td key={i} className="r">{r.crop_area_ha[c] ? num(r.crop_area_ha[c], 1) : '—'}</td>)}</tr>)}
              <tr className="sum"><td>{t('total')}</td>{totals.map((v, i) => <td key={i} className="r">{num(v, 1)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function TailChart({ canals, season, onRabi }) {
  const { t, term, num, int } = useI18n()
  const list = canals.filter((c) => c.canal_id !== 'LBC')
  if (list.every((c) => Object.values(c.reaches).every((x) => !x.canal_irrigated_ha))) {
    return (
      <div className="chart-empty">
        <Icon name="rain" size={40} stroke={1.4} />
        <p>{t('noCanalThisSeason')}</p>
        {onRabi && season?.season !== 'Rabi' && <button className="btn" onClick={onRabi}>{t('showRabi')}</button>}
      </div>
    )
  }
  const W = 960, H = 320, L = 52, gw = (W - L) / list.length
  const yOf = (p) => H - (p / 100) * (H - 10)
  return (
    <div className="hist big">
      <svg viewBox={`0 0 ${W} ${H + 46}`} role="img" aria-label={t('tailTitle')}>
        {[0, 25, 50, 75, 100].map((v) => <g key={v} className="grid"><line x1={L} x2={W} y1={yOf(v)} y2={yOf(v)} /><text x={L - 8} y={yOf(v) + 4} textAnchor="end">{v}%</text></g>)}
        {list.map((c, i) => (
          <g key={c.canal_id}>
            {['Head', 'Middle', 'Tail'].map((r, j) => {
              const p = Math.min(100, c.reaches[r].canal_irrigated_pct_of_cca), bx = L + i * gw + gw * 0.14 + j * gw * 0.24
              return (
                <g key={r}>
                  <rect className="bar-seg" x={bx} y={yOf(p)} width={gw * 0.2} height={H - yOf(p)} fill={REACH_COLORS[r]} style={{ animationDelay: `${(i * 3 + j) * 50}ms` }} />
                  <text x={bx + gw * 0.1} y={yOf(p) - 6} textAnchor="middle" className="tot">{num(p, 0)}%</text>
                </g>
              )
            })}
            <text x={L + i * gw + gw / 2} y={H + 22} textAnchor="middle" className="ax strong">{term(c.canal)}</text>
          </g>
        ))}
        <line x1={L} x2={W} y1={H} y2={H} className="axis" />
      </svg>
      <div className="legend inline">{['Head', 'Middle', 'Tail'].map((r) => <div key={r}><i style={{ background: REACH_COLORS[r] }} />{t(r.toLowerCase())}</div>)}</div>
      <div className="tablewrap big-table">
        <table className="tbl">
          <thead><tr><th>{t('canal')}</th><th>{t('reach')}</th><th className="r">{t('gats')}</th><th className="r">{t('cca')} ({t('ha')})</th><th className="r">{t('canalIrrigated')} ({t('ha')})</th><th className="r">%</th><th>{t('mainCrops')}</th></tr></thead>
          <tbody>
            {list.flatMap((c) => ['Head', 'Middle', 'Tail'].map((r) => {
              const x = c.reaches[r]
              return <tr key={c.canal_id + r}><td>{term(c.canal)}</td><td><i className="dot" style={{ background: REACH_COLORS[r] }} />{t(r.toLowerCase())}</td>
                <td className="r">{int(x.gats)}</td><td className="r">{num(x.cca_ha, 1)}</td><td className="r">{num(x.canal_irrigated_ha, 1)}</td>
                <td className="r">{num(x.canal_irrigated_pct_of_cca, 0)}%</td><td>{x.top_crops.map(([k]) => term(k)).join(', ') || '—'}</td></tr>
            }))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
