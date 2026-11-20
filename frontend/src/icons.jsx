export const GLYPHS = {
  Well: 'M5 9h14M7 9v10h10V9M9 5h6l2 4H7l2-4M9.5 14c1-.8 2-.8 3 0s2 .8 3 0',
  Bridge: 'M3 9h18M3 9v8M21 9v8M6 17c0-3.3 2.7-6 6-6s6 2.7 6 6M3 20h4M17 20h4M10 20h4',
  Building: 'M4 20V10l8-6 8 6v10M4 20h16M10 20v-5h4v5M8 12h1M15 12h1',
  Office: 'M5 20V8h14v12M3 20h18M8 11h2M14 11h2M8 15h2M14 15h2M12 4v4M12 4h4l-1 1.5L16 7h-4',
  'Head regulator': 'M4 6h16M4 18h16M6 6v12M10 6v12M14 6v12M18 6v12M3 12h2M19 12h2',
  'CD work (culvert / siphon)': 'M3 8h18M3 8v10h18V8M7 18c0-2.8 2.2-5 5-5s5 2.2 5 5M2 21c2-1.2 4-1.2 6 0s4 1.2 6 0 4-1.2 6 0',
  Regulator: 'M4 6h16M4 18h16M6 6v12M10 6v12M14 6v12M18 6v12',
  Aqueduct: 'M3 8h18M4 8v10M20 8v10M8 18c0-2.2 1.8-4 4-4s4 1.8 4 4M3 5c3-1 6 1 9 0s6-1 9 0',
  'Outlet gate': 'M6 4v16M18 4v16M6 9h12M9 9v6h6V9',

  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  find: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.8-4.8',
  flow: 'M3 7c2.5-2 5-2 7.5 0S15.5 9 18 7l3-2M3 13c2.5-2 5-2 7.5 0s5 2 7.5 0l3-2M3 19c2.5-2 5-2 7.5 0s5 2 7.5 0l3-2',
  insights: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  manage: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  close: 'M6 6l12 12M18 6 6 18',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  layers: 'M12 3 2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 17.5 12 22l10-4.5',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5v.5',
  farmer: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7',
  field: 'M3 20 7 6h10l4 14zM5 13h14M9 6l-2 14M15 6l2 14',
  chevron: 'M9 6l6 6-6 6',
  expand: 'M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7',
  reset: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5',
  rain: 'M7 15a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.5A3.5 3.5 0 0 1 17 15H7zM8 18l-1 2M12 18l-1 2M16 18l-1 2',
  wheat: 'M12 21V8M12 8c-2-1-3-3-3-5 2 0 3 1.5 3 3M12 8c2-1 3-3 3-5-2 0-3 1.5-3 3M12 13c-2-1-3.5-3-3.5-5 2 .3 3.5 2 3.5 3.5M12 13c2-1 3.5-3 3.5-5-2 .3-3.5 2-3.5 3.5M12 18c-2-1-3.5-3-3.5-5 2 .3 3.5 2 3.5 3.5M12 18c2-1 3.5-3 3.5-5-2 .3-3.5 2-3.5 3.5',
  textsize: 'M4 18 9 6l5 12M5.8 14h6.4M15 18l3-7 3 7M15.9 16h4.2',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
}

export function Icon({ name, size = 18, stroke = 1.8, className = '', title }) {
  const d = GLYPHS[name] || GLYPHS.info
  return (
    <svg className={`ico ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={d} />
    </svg>
  )
}

export function markerImage(type, ring, dark) {
  const size = 64
  const glyph = GLYPHS[type] || GLYPHS.Building
  const fill = dark ? '#15232D' : '#ffffff'
  const ink = dark ? '#E4ECE8' : '#1F2622'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="27" fill="${fill}" stroke="${ring}" stroke-width="6"/>
    <g transform="translate(16 16) scale(1.333)" fill="none" stroke="${ink}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${glyph}"/></g>
  </svg>`
  return new Promise((resolve) => {
    const img = new Image(size, size)
    img.onload = () => resolve(img)
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  })
}
