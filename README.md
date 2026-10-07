# MCQ Item Analysis

Upload an Excel file of students' answers and get an item analysis of every multiple-choice question. Everything is calculated in the browser; files are never uploaded. An optional AI helper words the results and suggests fixes, but it never calculates anything.

## What the teacher sees
1. **Results page (simple):** one table of questions with item analysis % (High + Low), difficulty index, discrimination index, NFDs, distractor efficiency and a recommendation, plus a plain-language summary.
2. **Detailed report (one click):** step-by-step working with the actual numbers, the item analysis table with the High/Low counts, students and groups, distractors, and data notes.

## The rules (all in `src/lib/stats.ts`)
- Rank students by total score (ties keep file order, with a warning at group boundaries).
- g = ⌊n ÷ 3⌋. **High = g, Low = g, Medium = n − 2g** (the remainder goes to Medium).
- **Item analysis % = (High correct + Low correct) ÷ (High total + Low total) × 100.** Example: 120 students → 40/40/40; 32 and 12 correct → 44/80 = 55%.
- Difficulty index = correct ÷ all × 100 (30–70 acceptable). Discrimination index = H/g − L/g. NFD = wrong option chosen by < 5%. Distractor efficiency = functional wrong options ÷ wrong options × 100. Cronbach's alpha for reliability.

## Files it understands
- Answers as letters (A–D…), numbers (1–4), "B. text", or the option **text itself** (each different answer becomes an option).
- The answer key can be: a row labelled **Key** / Answer key / Correct (top or bottom of Responses, label in column A or in a "Row Type"-style column); a sheet `Answer_Key` (down a column or across a row); a separate uploaded file; or **chosen on the page** (with a draft worked out from the answers, to confirm).
- Columns such as Row Type, Name, Section, Total are skipped. Blank rows are ignored.
- Anything unreadable is listed with its exact cell, what is wrong and what to change; for single cells the teacher can type the correction on the page (the Excel file is never changed).

## AI helper (optional)
Features: plain-language summary; per-question review (teacher pastes the question text, with consent); AI-suggested letters for messy answer cells (teacher confirms). Rules: only totals/percentages are sent (never IDs or names); all prompts are fixed on the server; every number and question label in an AI answer is checked against the calculated results and discarded if anything does not match; AI text is labelled.

It needs a small server function because the API key must stay secret. The code is in `server/ai-core.ts` with wrappers for **Cloudflare Pages** (`functions/api/ai.ts`), **Netlify** (`netlify/functions/ai.mts`) and **Vercel** (`api/ai.ts`). Set these environment variables on the host:
- `AI_API_KEY` (required). A free Google Gemini key from aistudio.google.com works.
- `AI_BASE_URL` (default Gemini's OpenAI-compatible address) and `AI_MODEL` (default `gemini-2.5-flash`). Groq, OpenRouter or any OpenAI-compatible service also works.
- `ALLOWED_ORIGIN` only if the website and the function are on different addresses (for example the site on GitHub Pages): set it to the site address and build the site with `VITE_AI_ENDPOINT=https://your-function-address/api/ai`.
Without a key the site works fully; the AI buttons simply do not appear.

## Run and deploy
```
npm install
npm test            # engine tests (46)
npm run typecheck
npm run dev
npm run build       # output in dist/
```
Easiest public hosting with AI: push to GitHub and import the repository into Cloudflare Pages, Netlify or Vercel (build command `npm run build`, output `dist`), then add `AI_API_KEY`. Without AI, `.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages.
Branding: edit `src/config.ts` (name, contact) and the colour tokens at the top of `src/index.css`.
