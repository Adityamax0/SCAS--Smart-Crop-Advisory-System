const { Subsidy, CropRecommendation } = require('../models/Advisory');
const { cacheGet } = require('../config/redis');

/**
 * GET /api/advisory
 * Returns personalized subsidies and crop recommendations based on User profile
 */
const getAdvisory = async (req, res) => {
  try {
    let { district, state } = req.user;
    const { lat, lon } = req.query;

    // 0. If GPS coordinates provided, reverse geocode to find current location
    if (lat && lon) {
      const { reverseGeocode } = require('../services/groqService');
      const detected = await reverseGeocode(lat, lon);
      if (detected && detected.district) {
        console.log(`[GEO] GPS Overriding District: ${detected.district}, ${detected.state}`);
        district = detected.district;
        state = detected.state;
      }
    }

    // Define cache key based on location
    const cacheKey = `advisory:${state.toLowerCase()}:${district.toLowerCase()}`;

    // Cache TTL: 1 hour (3600 seconds)
    const advisoryData = await cacheGet(cacheKey, async () => {
      // 1. Find Subsidies matching State or tagged for All states
      const dbSubsidies = await Subsidy.find({
        $or: [
          { 'eligibility.states': state },
          { 'eligibility.states': { $exists: false } },
          { 'eligibility.states': { $size: 0 } }
        ]
      }).lean();

      // Normalize subsidies to ensure language_context integrity
      const subsidies = dbSubsidies.map(s => ({
        ...s,
        display_name: s.name.hi || s.name.en, // Priority for local/hindi in advisory
        language_context: {
          en: s.name.en,
          hi: s.name.hi || s.name.en,
          local: s.name.local || s.name.hi || s.name.en
        }
      }));

      // 2. Find Crop Recommendations for the User's District
      let crops = [];
      const dbRecommendation = await CropRecommendation.findOne({ 
        district: { $regex: new RegExp(district, 'i') }, 
        state: { $regex: new RegExp(state, 'i') } 
      }).lean();

      if (dbRecommendation) {
        crops = dbRecommendation.recommendedCrops.map(c => ({
          ...c,
          language_context: {
            en: c.name.en,
            hi: c.name.hi || c.name.en,
            local: c.name.local || c.name.hi || c.name.en
          }
        }));
      } else {
        // AI Fallback for unseeded districts
        const { generateRegionalAdvisory } = require('../services/groqService');
        const aiCrops = await generateRegionalAdvisory(district, state);
        
        // Wrap AI response in multilingual slots (Mocked translation for demo/fallback)
        crops = aiCrops.map(c => ({
          name: { en: c.name, hi: c.name, local: c.name },
          suitabilityScore: c.suitabilityScore || 85,
          guidance: { en: c.guidance, hi: c.guidance, local: c.guidance },
          language_context: { en: c.name, hi: c.name, local: c.name }
        }));
      }

      return { subsidies, recommendations: crops, location: { district, state } };
    }, 3600);

    res.status(200).json({
      success: true,
      data: advisoryData
    });
  } catch (error) {
    console.error('[ADVISORY] Controller Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAdvisory };
