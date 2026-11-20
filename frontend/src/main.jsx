import React from 'react'
import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@fontsource/mukta/400.css'
import '@fontsource/mukta/500.css'
import '@fontsource/mukta/600.css'
import '@fontsource/mukta/700.css'
import '@fontsource/martel/700.css'
import '@fontsource/martel/800.css'
import './styles.css'
import App from './App.jsx'
import Report from './Report.jsx'

const isReport = window.location.hash.startsWith('#/report')
createRoot(document.getElementById('root')).render(isReport ? <Report /> : <App />)
