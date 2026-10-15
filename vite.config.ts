


import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'

// export default defineConfig({
//   plugins: [react(), tailwindcss()],
//   resolve: { alias: { "@": path.resolve(__dirname, "src") } },
//   server: {
//     host: '0.0.0.0',
//     // port: 5173,
//     proxy: {
//       "/api": { target: "http://10.0.20.4:8000", changeOrigin: true, secure: false },
//       "/socket.io": { target: "http://10.0.20.4:8000", changeOrigin: true, secure: false, ws: true },
//     },
//   },
//   preview: {
//     host: '0.0.0.0',
//     port: 4000,
//     proxy: {
//       "/api": { target: "http://10.0.20.4:8000", changeOrigin: true, secure: false },
//       "/socket.io": { target: "http://10.0.20.4:8000", changeOrigin: true, secure: false, ws: true },
//     },
//   },
// })
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    // host: '0.0.0.0',
    port: 5173,
    // proxy: {
    //   "/api": { target: "http://10.0.20.4:8000", changeOrigin: true, secure: false },
    //   "/socket.io": { target: "http://10.0.20.4:8000", changeOrigin: true, secure: false, ws: true },
    // },
  },
  // preview: {
  //   host: '0.0.0.0',
  //   port: 4000,
  //   proxy: {
  //     "/api": { target: "http://10.0.20.4:8000", changeOrigin: true, secure: false },
  //     "/socket.io": { target: "http://10.0.20.4:8000", changeOrigin: true, secure: false, ws: true },
  //   },
  // },
})