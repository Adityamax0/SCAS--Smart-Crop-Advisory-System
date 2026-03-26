const mongoose = require('mongoose');

const knowledgeBaseSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    answer: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['pest', 'disease', 'nutrient_deficiency', 'irrigation', 'weather_damage', 'subsidy', 'general'],
      default: 'general',
    },
    tags: [String],
    source: {
      type: String,
      enum: ['expert', 'ai_generated', 'government_manual'],
      default: 'ai_generated',
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    embedding: {
      type: [Number],
      select: false, // Don't return vectors in normal queries to save bandwidth
    },
  },
  {
    timestamps: true,
  }
);

// Create a text index for fast searching across questions and answers
knowledgeBaseSchema.index({ question: 'text', answer: 'text', tags: 'text' });

module.exports = mongoose.model('KnowledgeBase', knowledgeBaseSchema);
