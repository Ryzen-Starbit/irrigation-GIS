import { useState } from 'react'

const STAGES = [
  'M20 9s7 7.6 7 12.6a7 7 0 0 1-14 0C13 16.6 20 9 20 9z',
  'M10 16c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-2M10 21c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-2M10 26c2.5-2 5-2 7.5 0s5 2 7.5 0 3.5-1.5 5-2',
  'M20 30V18M20 21c-4 0-7-3-7-7 4 0 7 3 7 7zM20 18c0-4 3-7 7-7 0 4-3 7-7 7zM13 30h14',
  'M20 25a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM20 9v2.5M20 28.5V31M9 20h2.5M28.5 20H31M12.2 12.2l1.8 1.8M26 26l1.8 1.8M12.2 27.8l1.8-1.8M26 14l1.8-1.8',
]

export default function Logo({ label }) {
  const [stage, setStage] = useState(0)
  const [spins, setSpins] = useState(0)
  const tap = () => { setSpins((s) => s + 1); setTimeout(() => setStage((x) => (x + 1) % STAGES.length), 260) }
  return (
    <button className="logo" onClick={tap} aria-label={label} title={label}>
      <svg viewBox="0 0 40 40" aria-hidden>
        <defs>
          <linearGradient id="lg-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7FD9E4" /><stop offset="1" stopColor="#E2A019" /></linearGradient>
        </defs>
        <circle cx="20" cy="20" r="18" className="logo-bg" />
        <g key={spins} className={spins ? 'logo-spin' : ''}>
          <circle cx="20" cy="20" r="18" fill="none" stroke="url(#lg-ring)" strokeWidth="2.4" strokeDasharray="88 25" strokeLinecap="round" />
          <circle cx="20" cy="2.2" r="2" fill="#E2A019" />
        </g>
        <path key={`g${stage}`} d={STAGES[stage]} className="logo-glyph" />
      </svg>
      <span className="logo-ripple" key={`r${spins}`} />
    </button>
  )
}
