export const CROP_COLORS = {
  Soybean: '#D4A72C', Cotton: '#EDE6D3', Tur: '#8C5A2E', Jowar: '#D9893B', Moong: '#7FA843', Udid: '#55663A',
  Sugarcane: '#2E9460', Orange: '#EF7A2A', 'Gram (Harbhara)': '#B66A2A', Wheat: '#E6C46E', Onion: '#A8466B',
  Fodder: '#8CBB6B', Groundnut: '#A07B53', Vegetables: '#43A851',
}
export const IRRIGATION_COLORS = { Canal: '#1C8FB0', Well: '#7451A8', Rainfed: '#D8C27E' }
export const REACH_COLORS = { Head: '#2E9460', Middle: '#E2A019', Tail: '#C2493D' }
export const CONDITION_COLORS = { Good: '#2E9460', 'Needs Repair': '#E2A019', Damaged: '#C2493D' }
export const KHARAB_STOPS = [[0, '#EEF0E6'], [2, '#E8D6AE'], [5, '#D7AE72'], [10, '#B5793F'], [20, '#7A4520']]

const match = (prop, table, none) => ['match', ['coalesce', ['get', prop], '__none'], ...Object.entries(table).flat(), none]

export function themeFill(theme, dark) {
  const none = dark ? '#2B3B45' : '#CFD5CC'
  switch (theme) {
    case 'crop': return match('crop', CROP_COLORS, none)
    case 'irrigation': return match('irrigation', IRRIGATION_COLORS, none)
    case 'kharab': return ['case', ['==', ['get', 'in_command'], 1],
      ['interpolate', ['linear'], ['coalesce', ['get', 'pot_kharab_pct'], 0], ...KHARAB_STOPS.flat()], none]
    case 'reach': return match('reach', REACH_COLORS, none)
    default: return ['case', ['==', ['get', 'in_command'], 1], dark ? '#2F5560' : '#BFD9D3', none]
  }
}

export const THEME_KEYS = ['crop', 'irrigation', 'kharab', 'reach', 'none']
export const THEME_LABEL = { none: 'th_none', crop: 'th_crop', irrigation: 'th_irrigation', kharab: 'th_kharab', reach: 'th_reach' }
export const themeLegend = (theme) => ({
  crop: CROP_COLORS, irrigation: IRRIGATION_COLORS, reach: REACH_COLORS,
  kharab: Object.fromEntries(KHARAB_STOPS.map(([v, c]) => [`${v}%+`, c])),
  none: { 'In command': '#BFD9D3', 'Outside command': '#CFD5CC' },
}[theme])

export function onlyExpr(only, crop) {
  switch (only) {
    case 'barren': return ['>', ['coalesce', ['get', 'pot_kharab_ha'], 0], 0]
    case 'tail': return ['==', ['get', 'reach'], 'Tail']
    case 'canal': return ['==', ['get', 'irrigation'], 'Canal']
    case 'outside': return ['==', ['get', 'in_command'], 0]
    case 'crop': return ['==', ['get', 'crop'], crop || '']
    default: return null
  }
}
export function onlyTest(only, crop) {
  switch (only) {
    case 'barren': return (p) => (p.pot_kharab_ha || 0) > 0
    case 'tail': return (p) => p.reach === 'Tail'
    case 'canal': return (p) => p.irrigation === 'Canal'
    case 'outside': return (p) => !p.in_command
    case 'crop': return (p) => p.crop === crop
    default: return null
  }
}
