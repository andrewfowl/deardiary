import { defineConfig } from 'vite'

// A leading dot allows the domain and all of its subdomains (e.g. *.vercel.run).
const allowedHosts = ['sb-311trafsb24e.vercel.run', '.vercel.run']

export default defineConfig({
  server: {
    allowedHosts
  },
  preview: {
    allowedHosts
  }
})
