import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { handleAi } from './server/ai-core'

// base './' lets the built site work from any folder or sub-path (GitHub Pages, a school server, a CDN).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: './',
    plugins: [
      react(),
      {
        name: 'local-ai-dev-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url && (req.url === '/api/ai' || req.url.startsWith('/api/ai?') || req.url.startsWith('/api/ai/'))) {
              try {
                const host = req.headers.host || 'localhost:5173'
                const fullUrl = `http://${host}${req.url}`
                let body: any = undefined
                if (req.method === 'POST') {
                  const chunks: Buffer[] = []
                  for await (const chunk of req) {
                    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
                  }
                  body = Buffer.concat(chunks).toString('utf8')
                }
                const webReq = new Request(fullUrl, {
                  method: req.method,
                  headers: req.headers as Record<string, string>,
                  body,
                })
                const webRes = await handleAi(webReq, {
                  AI_API_KEY: env.AI_API_KEY || process.env.AI_API_KEY,
                  AI_BASE_URL: env.AI_BASE_URL || process.env.AI_BASE_URL,
                  AI_MODEL: env.AI_MODEL || process.env.AI_MODEL,
                  ALLOWED_ORIGIN: env.ALLOWED_ORIGIN || process.env.ALLOWED_ORIGIN,
                })
                res.statusCode = webRes.status
                webRes.headers.forEach((val, key) => res.setHeader(key, val))
                const text = await webRes.text()
                res.end(text)
                return
              } catch (err: any) {
                res.statusCode = 500
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify({ error: err?.message || 'Local AI error' }))
                return
              }
            }
            next()
          })
        },
      },
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  }
})

