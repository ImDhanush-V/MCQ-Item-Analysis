// Cloudflare Pages Functions: served at /api/ai. Set AI_API_KEY (secret), and optionally AI_BASE_URL, AI_MODEL, ALLOWED_ORIGIN.
import { handleAi, type Env } from '../../server/ai-core'
export const onRequest = (ctx: { request: Request; env: Env }) => handleAi(ctx.request, ctx.env)
