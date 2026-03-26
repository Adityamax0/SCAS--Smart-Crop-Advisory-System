/**
 * 🏛️ SCAS: Bharat-VISTAAR (ICAR-IARI 2026) Service
 * MOCK implementation of the Unified National Agriculture Knowledge Bridge.
 */

const ICAR_GUIDELINES = {
  "wheat": {
    recommendation: "Use ICAR-IARI 2026 'HD-3385' climate-resilient seeds for late sowing. Maintain soil moisture at 15-18%.",
    citation: "Source: ICAR-IARI 2026 Wheat Production Framework (V-2.4)"
  },
  "paddy": {
    recommendation: "Adopt 'Direct Seeded Rice' (DSR) to save 20% water. Monitor for Brown Plant Hopper (BPH) every 48 hours.",
    citation: "Source: ICAR-NRRI 2026 Sustainable Rice Mission"
  },
  "pest": {
    recommendation: "Integrated Pest Management (IPM) using Pheromone traps is mandatory for high-density areas.",
    citation: "Source: ICAR-NCIPM 2026 Integrated Pest Protocol"
  }
};

/**
 * Fetch localized ICAR guidelines based on crop or issue
 * @param {string} query - The disease or crop name
 * @returns {Promise<Object>} - Guidelines and official citation
 */
exports.getICARGuideline = async (query) => {
  console.log(`[Bharat-VISTAAR] Fetching ICAR guidelines for: ${query}...`);
  
  // Simulation of national knowledge base search
  await new Promise(resolve => setTimeout(resolve, 800));

  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('wheat') || lowerQuery.includes('gehun')) {
    return ICAR_GUIDELINES.wheat;
  }
  
  if (lowerQuery.includes('paddy') || lowerQuery.includes('rice') || lowerQuery.includes('dhaan')) {
    return ICAR_GUIDELINES.paddy;
  }

  // Generic Fallback for other crops
  return {
    recommendation: "Apply balanced NPK fertilization (4:2:1) and ensure proper drainage as per 2026 Regional Crop Standards.",
    citation: "Source: ICAR-ATIC 2026 General Advisory"
  };
};
