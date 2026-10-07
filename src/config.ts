// Edit this file to brand the site for your institution.
export const site = {
  name: 'MCQ Item Analysis',
  org: 'For medical and health-professions educators',
  contactEmail: 'your.name@your-institution.org',
  templateUrl: `${import.meta.env.BASE_URL}MCQ_Template.xlsx`,
  // Address of the AI helper (the serverless function in /server). Leave as is when it is deployed on the same site; or set VITE_AI_ENDPOINT at build time.
  aiEndpoint: (import.meta.env.VITE_AI_ENDPOINT as string | undefined) || '/api/ai',
  privacyLine: 'Your files are read inside your browser and are never uploaded to a server.',
}
