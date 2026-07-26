import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: '/',
        name: 'PITWALL — F1 Race Companion',
        short_name: 'PITWALL',
        description: 'Formula 1 schedules, standings, circuits, live tracking and simulations.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#05070b',
        theme_color: '#0b0d13',
        orientation: 'any',
        categories: ['sports', 'entertainment'],
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Standings',
            short_name: 'Standings',
            url: '/standings',
            icons: [{ src: '/icons/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Live Tracking',
            short_name: 'Live',
            url: '/live',
            icons: [{ src: '/icons/pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,webp,woff2,geojson}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.jolpi\.ca\/ergast\/f1\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'jolpica-api',
              networkTimeoutSeconds: 6,
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/(?:media|www)\.formula1\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'f1-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
