import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { isImageResponse, resolveImageTarget, upstreamHeaders } from './src/lib/imageProxy'

// Proxy d'images en DÉVELOPPEMENT. En production, c'est la fonction Cloudflare Pages
// functions/api/proxy-image.ts qui répond à la même URL `/api/proxy-image?url=...` ; ici on
// reproduit son comportement pour que les images fonctionnent aussi sous `pnpm dev`. Les deux
// partagent la validation de src/lib/imageProxy.ts (liste blanche d'hôtes anti-SSRF).
//
// Remplace l'ancien `server.proxy['/api']` qui renvoyait vers un serveur localhost:3000
// inexistant dans ce dépôt — d'où l'échec systématique des images en dev.
function imageProxyDevPlugin(): Plugin {
  return {
    name: 'inducks-image-proxy-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/proxy-image')) return next()

        const resolved = resolveImageTarget(new URL(req.url, 'http://localhost').searchParams.get('url'))
        res.setHeader('access-control-allow-origin', '*')
        if (!resolved.ok) {
          res.statusCode = resolved.status
          res.end(resolved.message)
          return
        }

        fetch(resolved.target, { headers: upstreamHeaders(resolved.referer) })
          .then(async (upstream) => {
            const contentType = upstream.headers.get('content-type')
            if (!isImageResponse(upstream.ok, contentType)) {
              res.statusCode = 502
              res.end("la réponse amont n'est pas une image")
              return
            }
            res.setHeader('content-type', contentType as string)
            res.setHeader('cache-control', 'public, max-age=86400')
            res.end(Buffer.from(await upstream.arrayBuffer()))
          })
          .catch(() => {
            res.statusCode = 502
            res.end('échec de récupération amont')
          })
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/InducksButBetter/',
  plugins: [react(), imageProxyDevPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('cmdk') || id.includes('class-variance-authority')) {
              return 'ui-vendor';
            }
            if (id.includes('@libsql') || id.includes('hrana')) {
              return 'db-vendor';
            }
            if (id.includes('@mlc-ai') || id.includes('web-llm')) {
              return 'ai-vendor';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
