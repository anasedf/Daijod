import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // ใช้ path แบบ relative เพื่อให้นำขึ้น GitHub Pages ใต้ /Daijod/ ได้โดยไม่ต้องแก้
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-64.png'],
      // เก็บฟอนต์ไว้ด้วย ให้หน้าตาเหมือนเดิมตอนออฟไลน์
      workbox: { globPatterns: ['**/*.{js,css,html,woff2}'] },
      manifest: {
        name: 'ได้จด — จดรายรับรายจ่าย',
        short_name: 'ได้จด',
        description: 'จดรายรับ รายจ่าย และโอนเงินระหว่างกระเป๋า แบบง่าย ๆ',
        lang: 'th',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f3ef',
        theme_color: '#0d7a5f',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
