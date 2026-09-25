import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // ใช้ path แบบ relative เพื่อให้นำขึ้น GitHub Pages ใต้ /Daijod/ ได้โดยไม่ต้องแก้
  base: './',
  plugins: [react(), tailwindcss()],
})
