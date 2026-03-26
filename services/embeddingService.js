const { pipeline } = require('@xenova/transformers');

// Singleton to hold the model in memory
let extractor = null;

/**
 * Generate 384-dimensional vector embeddings for a given text
 * Uses the Xenova/all-MiniLM-L6-v2 model (Fast, Free, and LOCAL)
 * @param {string} text - User query or KB content
 * @returns {Promise<number[]>} - Vector embedding array
 */
exports.generateEmbedding = async (text) => {
  try {
    // 1. Initialize the local brain if not already loaded
    if (!extractor) {
      console.log('[EMBEDDING] Loading Local AI Brain (all-MiniLM-L6-v2)...');
      extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('[EMBEDDING] Local AI Brain is now ACTIVE.');
    }

    // 2. Generate embedding (returns a Tensor)
    const output = await extractor(text, { pooling: 'mean', normalize: true });

    // 3. Convert Tensor to standard JS array
    const embedding = Array.from(output.data);

    if (!embedding || embedding.length === 0) {
      throw new Error('Local Inference returned empty vector');
    }

    return embedding;
  } catch (error) {
    console.error('[EMBEDDING] Local Brain Error:', error.message);
    // Fallback to deterministic 0-filled vector if everything fails 
    // (Prevents crashing while preserving some consistency)
    return new Array(384).fill(0);
  }
};
