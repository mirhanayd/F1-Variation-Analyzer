import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import { initNativeShell } from './app/native.js'

initNativeShell()

if (!Capacitor.isNativePlatform()) {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.error('PWA service worker registration failed:', error)
    },
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
