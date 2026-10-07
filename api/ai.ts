// Vercel Functions: served at /api/ai. Set AI_API_KEY in Project settings > Environment Variables.
import { handleAi } from '../server/ai-core'
export default { fetch: (req: Request) => handleAi(req, (globalThis as any).process?.env ?? {}) }
