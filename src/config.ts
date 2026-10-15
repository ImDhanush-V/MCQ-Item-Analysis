// Edit this file to brand the site for your institution.
export const site = {
  name: 'MCQ Item Analysis',
  org: 'For teachers, trainers and exam writers',
  contactEmail: 'dhanush.v@stjohns.in',
  contactName: 'Dhanush V',
  templateUrl: `${import.meta.env.BASE_URL}MCQ_Template.xlsx`,
  // Address of the AI helper (the serverless function in /server). Leave as is when it is deployed on the same site; or set VITE_AI_ENDPOINT at build time.
  aiEndpoint: (import.meta.env.VITE_AI_ENDPOINT as string | undefined) || '/api/ai',
  privacyLine: 'Your Excel file is read inside your browser and is never uploaded. If you choose an AI feature, only totals and percentages are sent, never names or IDs.',
}
