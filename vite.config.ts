// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'
// import path from 'path'
// import tailwindcss from '@tailwindcss/vite';

// export default defineConfig({
//   plugins: [react(), tailwindcss()],
//   resolve: {
//     alias: {
//       "@": path.resolve(__dirname, "src")
//     }
//   },
//   server: {
//     host: '0.0.0.0',
//     port: 4000,
//     proxy: {
//       "/api": {
//         target: "http://10.0.20.4:8081",
//         changeOrigin: true,
//         secure: false,
//       },
//     },
//   },
// })


import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // https: {
    //   key: fs.readFileSync('./certs/local-key.pem'),
    //   cert: fs.readFileSync('./certs/local-cert.pem'),
    // },
    // proxy: {
    //   "/api": {
    //     target: "http://10.0.20.4:8081",
    //     changeOrigin: true,
    //     secure: false,
    //   },
    // },
  },
})