import { useEffect, useRef, useState } from 'react'
import { useI18n } from './i18n.js'

export default function Term({ k, children }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef()
  useEffect(() => {
    if (!open) return
    const off = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [open])
  return (
    <span className="term" ref={ref}>
      {children}
      <button type="button" className="term-q" aria-label={t('whatIs')} aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open) }}>?</button>
      {open && <span className="term-pop" role="tooltip">{t(`g_${k}`)}</span>}
    </span>
  )
}
