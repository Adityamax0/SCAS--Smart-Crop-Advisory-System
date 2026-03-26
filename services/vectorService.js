const KnowledgeBase = require('../models/KnowledgeBase');
const { generateEmbedding } = require('./embeddingService');

/**
 * Perform a similarity search in the KnowledgeBase 'Problem Vault'
 * @param {string} queryText - The farmer's question or audio transcript
 * @param {number} limit - Number of similar results to return
 * @returns {Promise<Object[]>} - Array of matching KB items
 */
exports.findSimilarProblems = async (queryText, limit = 1) => {
  try {
    const queryVector = await generateEmbedding(queryText);

    // 🚀 AT-SCALE VERSION: Use MongoDB Atlas Vector Search ($vectorSearch)
    if (process.env.MONGODB_URI.includes('mongodb+srv')) {
      const results = await KnowledgeBase.aggregate([
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryVector,
            numCandidates: 10,
            limit: limit
          }
        },
        {
          $project: {
            question: 1,
            answer: 1,
            category: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ]);

      // 🛡️ SECURITY AUDIT FIX: OOD (Out-of-Distribution) Threshold
      // Prevent force-classification of non-agri images/text.
      const MIN_SIMILARITY_SCORE = 0.82; 
      return results.filter(r => r.score >= MIN_SIMILARITY_SCORE);
    }


    // 🛡️ FALLBACK: Basic text search if vector index isn't ready or on local DB
    return await KnowledgeBase.find({ $text: { $search: queryText } })
      .limit(limit)
      .lean();

  } catch (error) {
    console.error('[VECTOR_SEARCH] Error:', error.message);
    return [];
  }
};
