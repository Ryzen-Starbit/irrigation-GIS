import { useMemo, useState } from 'react'
import { useI18n } from './i18n.js'
import { REACH_COLORS, CROP_COLORS } from './theme.js'

const WIDE = { W: 1400, LABEL_X: 60, JUNCTION_X: 520, ROW_X0: 600, PAD: 150 }
const NARROW = { W: 1120, LABEL_X: 34, JUNCTION_X: 330, ROW_X0: 360, PAD: 40 }
let W, LABEL_X, JUNCTION_X, ROW_X0, ROW_X1, PAD
const LBC_Y = 92
const ROW_H = 204          
const BAR_MAX = 52
const FAN_H = 104            
const SQ = 15, GAP = 4    

export default function FlowDiagram({ tree, onSelect, onStation, focus, compact = false, theme = 'crop', narrow = false }) {
  ;({ W, LABEL_X, JUNCTION_X, ROW_X0, PAD } = narrow ? NARROW : WIDE); ROW_X1 = W - 40
  const { t, term, int, num, digits } = useI18n()
  const [hover, setHover] = useState(null)
  const [open, setOpen] = useState(null)         
  const lbc = tree?.[0]

  const L = useMemo(() => {
    if (!lbc) return null
    const dors = [...(lbc.outlets || [])].sort((a, b) => a.chainage_m - b.chainage_m)
    const minors = [...(lbc.children || [])].sort((a, b) => (a.offtake_rd_m || 0) - (b.offtake_rd_m || 0) || b.outlets.length - a.outlets.length)
    const allCca = [...dors, ...minors.flatMap((m) => m.outlets)].map((o) => o.totals.cca_ha)
    const maxCca = Math.max(...allCca, 1)
    const bar = (cca) => Math.max(3, (cca / maxCca) * BAR_MAX)
    const lbcStations = dors.map((o, i) => ({ ...o, x: LABEL_X + PAD + (i + 1) * ((JUNCTION_X - LABEL_X - PAD - 20) / (dors.length + 1)), y: LBC_Y, h: bar(o.totals.cca_ha), canal: 'LBC' }))
    let y = LBC_Y + 150
    const rows = minors.map((m) => {
      const outs = [...m.outlets].sort((a, b) => a.chainage_m - b.chainage_m || a.name.localeCompare(b.name))
      const step = (ROW_X1 - ROW_X0 - 30) / Math.max(outs.length, 1)
      const st = outs.map((o, i) => ({ ...o, x: ROW_X0 + 40 + i * step + step / 2 - 10, y, h: bar(o.totals.cca_ha), canal: m.id }))
      const row = { node: m, y, stations: st, step }
      const fanOpen = st.some((s) => s.id === open)
      y += ROW_H + (fanOpen ? FAN_H : 0)
      return row
    })
    const brackets = (st) => {
      const out = []
      st.forEach((s) => {
        const last = out[out.length - 1]
        if (last && last.reach === s.reach) last.x1 = s.x
        else out.push({ reach: s.reach, x0: s.x, x1: s.x })
      })
      return out
    }
    return { lbcStations, rows, brackets, H: y - 10 }
  }, [lbc, open, narrow])

  if (!L) return <div className="flow-empty">{t('loading')}</div>
  const dim = (id) => focus && focus !== id && focus !== 'LBC'

  const station = (s, rowNode, labelAbove = true) => {
    const isOpen = open === s.id
    const act = () => {
      if (onStation) { setOpen(isOpen ? null : s.id); onStation(isOpen ? null : s) }
      else onSelect?.({ kind: 'outlet', id: s.chak_no })
    }
    return (
      <g key={s.id} className={`stn ${hover?.id === s.id ? 'on' : ''} ${isOpen ? 'open' : ''}`} transform={`translate(${s.x},${s.y})`}
        onMouseEnter={() => setHover({ ...s, canalName: rowNode })} onMouseLeave={() => setHover(null)} onClick={act}
        onKeyDown={(e) => e.key === 'Enter' && act()} tabIndex={0} role="button"
        aria-label={`${s.name}, ${int(s.chainage_m)} m, ${int(s.totals.gats)} ${t('gats')}`}>
        <rect className="hit" x={-18} y={-34} width={36} height={BAR_MAX + 74} />
        {/* CCA bar hangs under the station like a gauge */}
        <rect className="cca" x={-5} y={16} width={10} height={s.h} rx={2} fill={REACH_COLORS[s.reach]} />
        {!compact && <text className="v" y={16 + s.h + 12} textAnchor="middle">{num(s.totals.cca_ha, 1)}</text>}
        <circle className="ring" r={9} stroke={REACH_COLORS[s.reach]} />
        {s.is_tail ? <circle r={3.5} className="tailmark" /> : null}
        {!compact && labelAbove && <text className="nm" y={-17} textAnchor="middle">{s.name}</text>}
        {!compact && labelAbove && <text className="ch" y={-30} textAnchor="middle">{digits(s.chainage_m)}</text>}
      </g>
    )
  }

  return (
    <div className={`flow ${compact ? 'compact' : ''}`}>
      <svg viewBox={`0 0 ${W} ${L.H}`} role="img" aria-label={t('flowDiagram')}>
        {}
        <g className={`canal ${dim('LBC') ? 'dim' : ''}`}>
          <g className="source" transform={`translate(${LABEL_X},${LBC_Y})`}>
            <path d="M-12 -14 L12 -14 L12 14 L-12 14 Z" className="dam" />
            <path d="M-6 -6 L6 -6 M-6 0 L6 0 M-6 6 L6 6" className="dam-lines" />
          </g>
          {!compact && <text x={LABEL_X - 16} y={LBC_Y + 34} className="lbl tiny muted">{t('fromDam')}</text>}
          <path d={`M${LABEL_X + 12},${LBC_Y} H${JUNCTION_X}`} className="pipe-rail main" onClick={() => onSelect?.({ kind: 'canal', id: 'LBC' })} />
          <path d={`M${LABEL_X + 12},${LBC_Y} H${JUNCTION_X}`} className="water main" />
          <text x={LABEL_X + 30} y={LBC_Y - 40} className="lbl title" onClick={() => onSelect?.({ kind: 'canal', id: 'LBC' })}>{term('Left Bank Canal')}</text>
          <text x={LABEL_X + 30} y={LBC_Y - 22} className="lbl small muted">{int(lbc.totals.gats)} {t('gats')}, {t('cca')} {num(lbc.totals.cca_ha, 1)} {t('ha')}</text>
          {L.lbcStations.map((s) => station(s, 'LBC'))}
          <circle cx={JUNCTION_X} cy={LBC_Y} r={11} className="junction" />
        </g>

        {}
        {L.rows.map((r) => {
          const n = r.node
          const last = r.stations[r.stations.length - 1]
          const fan = r.stations.find((s) => s.id === open)
          const branch = `M${JUNCTION_X},${LBC_Y} V${r.y - 24} Q${JUNCTION_X},${r.y} ${JUNCTION_X + 24},${r.y} H${last.x + 24}`
          return (
            <g key={n.id} className={`canal ${dim(n.id) ? 'dim' : ''}`}>
              <path d={branch} className="pipe-rail" onClick={() => onSelect?.({ kind: 'canal', id: n.id })} />
              <path d={branch} className="water" />
              <text x={JUNCTION_X + 34} y={r.y - 64} className="lbl title" onClick={() => onSelect?.({ kind: 'canal', id: n.id })}>{term(n.name)}</text>
              <text x={JUNCTION_X + 34} y={r.y - 47} className="lbl small muted">{t('offtakeAt')} {digits(n.offtake_rd_m)} m, {int(r.stations.length)} {t('l_outlets')}, {int(n.totals.gats)} {t('gats')}, {num(n.totals.cca_ha, 1)} {t('ha')}</text>
              <circle cx={last.x + 24} cy={r.y} r={5} className="end" />
              {r.stations.map((s) => station(s, n.id))}
              {/* head / middle / tail brackets */}
              {!compact && L.brackets(r.stations).map((b, i) => (
                <g key={i} className="bracket" transform={`translate(0,${r.y + BAR_MAX + 46})`}>
                  <path d={`M${b.x0 - 12},-5 V0 H${b.x1 + 12} V-5`} stroke={REACH_COLORS[b.reach]} />
                  <text x={(b.x0 + b.x1) / 2} y={14} textAnchor="middle" fill={REACH_COLORS[b.reach]}>{t(b.reach.toLowerCase())}</text>
                </g>
              ))}
              {}
              {fan && !compact && <Fan s={fan} y={r.y + BAR_MAX + 96} onSelect={onSelect} theme={theme} />}
            </g>
          )
        })}
      </svg>

      {narrow && !compact && <div className="swipe-hint">← {t('swipe')} →</div>}
      <div className="flow-foot">
        {hover ? (
          <div className="flow-hover">
            <b>{hover.name}</b> {t('onCanal')} {term(hover.canal)} @ {int(hover.chainage_m)} m
            <span className="sep" />{int(hover.totals.gats)} {t('gats')}, {int(hover.totals.farmers)} {t('farmers')}, {t('cca')} {num(hover.totals.cca_ha, 1)} {t('ha')}
            <span className="sep" /><span style={{ color: REACH_COLORS[hover.reach] }}>{t(hover.reach.toLowerCase())}</span>
            <span className="sep" /><span className="muted">{t('clickFields')}</span>
          </div>
        ) : (
          <div className="flow-legend">
            <span><i className="lg-ring" />{t('l_outlets')}</span>
            <span><i className="lg-bar" />{t('barIsCca')}</span>
            {['Head', 'Middle', 'Tail'].map((r) => <span key={r}><i style={{ background: REACH_COLORS[r] }} />{t(r.toLowerCase())}</span>)}
            <span className="muted">{t('evenSpacing')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Fan({ s, y, onSelect }) {
  const { t, term, digits } = useI18n()
  const gats = [...s.gats].sort((a, b) => +a.gat_no - +b.gat_no)
  const perRow = Math.floor((ROW_X1 - ROW_X0) / (SQ + GAP))
  const width = Math.min(gats.length, perRow) * (SQ + GAP)
  const x0 = Math.min(Math.max(s.x - width / 2, ROW_X0), ROW_X1 - width)
  return (
    <g className="fan">
      <path d={`M${s.x},${s.y + 16 + s.h + 16} V${y - 14} H${x0 + width / 2} V${y - 4}`} className="channel" />
      <text x={x0} y={y - 18} className="lbl tiny muted">{t('fieldChannel')}: {digits(gats.length)} {t('gats')}</text>
      {gats.map((g, i) => {
        const gx = x0 + (i % perRow) * (SQ + GAP), gy = y + Math.floor(i / perRow) * (SQ + GAP)
        return (
          <g key={g.id} className="plot" transform={`translate(${gx},${gy})`} onClick={(e) => { e.stopPropagation(); onSelect?.({ kind: 'gat', id: g.id }) }}
            style={{ animationDelay: `${i * 18}ms` }} role="button" tabIndex={0}>
            <rect width={SQ} height={SQ} rx={2} fill={CROP_COLORS[g.crop] || 'var(--ink-3)'} />
            <title>{`${t('gat')} ${digits(g.gat_no)} — ${term(g.crop) || ''}`}</title>
          </g>
        )
      })}
    </g>
  )
}
