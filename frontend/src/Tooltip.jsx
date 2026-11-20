import { useI18n } from './i18n.js'

export default function Tooltip({ hover }) {
  const { t, term, num, int, digits, person } = useI18n()
  if (!hover) return null
  const { p, layer } = hover
  let title, lines
  if (layer === 'parcel-fill') {
    title = `${t('gat')} ${digits(p.gat_no)}, ${term(p.village)}`
    const owner = p.owner_first ? person(p, 'owner_first', 'owner_first_en') : null
    lines = [
      owner ? `${owner}${p.owner_count > 1 ? ` +${int(p.owner_count - 1)} ${t('more')}` : ''}` : t('ownerNotListed'),
      p.crop ? `${term(p.crop)}, ${term(p.irrigation || 'Rainfed')}` : t('noCropRecorded'),
      p.in_command ? `${num(p.total_ha)} ${t('ha')}, ${p.outlet} (${t('chak')} ${digits(p.chak_no)})` : t('outsideList'),
    ]
  } else if (layer === 'outlet-circle') {
    title = `${t('outlet')} ${p.name}, ${t('chak')} ${digits(p.chak_no)}`
    lines = [`${term(p.canal_id)} @ ${int(p.chainage_m)} m`, `${int(p.gats)} ${t('gats')}, ${t('cca')} ${num(p.cca_ha)} ${t('ha')}`, `${t(p.reach.toLowerCase())} ${t('reachLbl')}`]
  } else if (layer === 'structure-icon') {
    title = p.name
    lines = [term(p.type), `${t('condition')}: ${term(p.condition)}`]
  } else if (layer === 'canal-line') {
    title = term(p.name)
    lines = [p.level === 'main' ? t('mainCanal') : `${t('minor')}, ${t('offtakeAt')} ${int(p.offtake_rd_m)} m`, `${num(p.length_m / 1000, 2)} ${t('km')} ${t('drawn')}`]
  } else return null
  const flip = hover.x > window.innerWidth - 780
  return (
    <div className="tooltip" style={{ left: flip ? hover.x - 14 : hover.x + 14, top: hover.y + 14, transform: flip ? 'translateX(-100%)' : 'none' }}>
      <div className="tt-title">{title}</div>
      {lines.map((l, i) => <div key={i}>{l}</div>)}
      <div className="tt-hint">{t('clickDetails')}</div>
    </div>
  )
}
