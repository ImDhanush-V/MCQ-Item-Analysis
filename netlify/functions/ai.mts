// Netlify Functions (v2): served at /api/ai through the path below. Set AI_API_KEY in Site settings > Environment variables.
import { handleAi } from '../../server/ai-core'
export default (req: Request) => handleAi(req, (globalThis as any).Netlify?.env?.toObject?.() ?? (globalThis as any).process?.env ?? {})
export const config = { path: '/api/ai' }
