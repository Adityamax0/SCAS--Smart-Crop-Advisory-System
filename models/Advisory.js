const mongoose = require('mongoose');

const subsidySchema = new mongoose.Schema({
  name: {
    en: { type: String, required: true },
    hi: { type: String },
    local: { type: String }
  },
  description: {
    en: { type: String, required: true },
    hi: { type: String },
    local: { type: String }
  },
  eligibility: {
    minLand: Number, // in hectares
    maxLand: Number,
    cropTypes: [String],
    districts: [String],
    states: [String]
  },
  benefits: {
    en: { type: String },
    hi: { type: String },
    local: { type: String }
  },
  applicationLink: String,
  category: { type: String, enum: ['financial', 'equipment', 'seeds', 'fertilizer', 'other'] }
});

const cropRecommendationSchema = new mongoose.Schema({
  district: { type: String, required: true },
  state: { type: String, required: true },
  soilType: String,
  recommendedCrops: [
    {
      name: {
        en: { type: String, required: true },
        hi: { type: String },
        local: { type: String }
      },
      season: { type: String, enum: ['Kharif', 'Rabi', 'Zaid'] },
      expectedYield: String,
      suitabilityScore: Number, // 1-100
      guidance: {
        en: { type: String },
        hi: { type: String },
        local: { type: String }
      }
    }
  ]
});

const Subsidy = mongoose.model('Subsidy', subsidySchema);
const CropRecommendation = mongoose.model('CropRecommendation', cropRecommendationSchema);

module.exports = { Subsidy, CropRecommendation };
