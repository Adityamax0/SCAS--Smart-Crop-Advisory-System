const KnowledgeBase = require('../models/KnowledgeBase');
const { generateEmbedding } = require('./embeddingService');

/**
 * Perform a hybrid Semantic + Text search on the Knowledge Base.
 * @param {string} query - The user's question or keywords.
 * @returns {Promise<Object|null>} - The best matching entry, or null.
 */
const searchKB = async (query) => {
  try {
    const queryVector = await generateEmbedding(query);
    let bestMatch = null;

    // 1. Try Vector Search (Semantic)
    try {
      // Note: This requires a search index named 'vector_index' on your Atlas cluster
      const vectorResults = await KnowledgeBase.aggregate([
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector,
            numCandidates: 10,
            limit: 1
          }
        },
        {
          $addFields: { score: { $meta: 'vectorSearchScore' } }
        }
      ]);

      if (vectorResults.length > 0) {
        const score = vectorResults[0].score;
        console.log(`[KB] Semantic Search Score: ${score.toFixed(3)}`);

        if (score >= 0.75) {
          // High confidence — use this answer directly
          console.log(`[KB] ✅ High-Confidence Hit! Returning KB answer.`);
          bestMatch = await KnowledgeBase.findById(vectorResults[0]._id);
        } else if (score >= 0.5) {
          // Low confidence — don't hallucinate, trigger expert review
          console.warn(`[KB] ⚠️ Low-Confidence (${score.toFixed(2)}) — triggering Expert Review instead of AI.`);
          return { lowConfidence: true, score };
        }
        // Below 0.5 — fall through to keyword search
      }
    } catch (vErr) {
      // Index likely not ready yet, skip to text search
      console.warn('[KB] Vector index not found or error. Falling back to text search.');
    }

    // 2. Fallback to Keyword Text Search
    if (!bestMatch) {
      const textResults = await KnowledgeBase.find(
        { $text: { $search: query } },
        { score: { $meta: 'textScore' } }
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(1);

      if (textResults.length > 0 && textResults[0]._doc.score > 1.2) {
        console.log(`[KB] Keyword Hit! Score: ${textResults[0]._doc.score}`);
        bestMatch = textResults[0];
      }
    }

    if (bestMatch) {
      bestMatch.usageCount += 1;
      await bestMatch.save();
      return bestMatch;
    }
    
    return null;
  } catch (error) {
    console.error('[KB] Search error:', error);
    return null;
  }
};

/**
 * Add a new AI-generated solution to the Knowledge Base with Vector support.
 */
const addToKB = async (question, answer, category = 'general') => {
  try {
    const exists = await KnowledgeBase.findOne({ question });
    if (exists) return exists;

    // Generate semantic vector for the new knowledge
    const embedding = await generateEmbedding(question);

    return await KnowledgeBase.create({
      question,
      answer,
      category,
      embedding,
      source: 'ai_generated',
      usageCount: 1
    });
  } catch (error) {
    console.error('[KB] Add error:', error);
    return null;
  }
};

module.exports = { searchKB, addToKB };
