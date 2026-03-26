/**
 * SCAS FEATURE FLAGS (Backend)
 * Centralized control for post-deployment modular expansion.
 * Toggle these via .env or directly here.
 */

const FEATURE_FLAGS = {
  // Enables AI Vision Diagnosis on Ticket Submission
  ENABLE_AI_VISION: process.env.ENABLE_AI_VISION === 'true',

  // Enables Real-Time Geo-Heatmaps for Sub-Heads
  ENABLE_GEO_HEATMAPS: process.env.ENABLE_GEO_HEATMAPS === 'true',

  // Enables Multilingual Voice Translation
  ENABLE_VERNACULAR_VOICE: process.env.ENABLE_VERNACULAR_VOICE === 'true',

  // Enables Advanced Predictive Analytics
  ENABLE_PREDICTIVE_AGMET: process.env.ENABLE_PREDICTIVE_AGMET === 'true',
};

module.exports = { FEATURE_FLAGS };
