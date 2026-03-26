const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const KnowledgeBase = require('../models/KnowledgeBase');
const { generateEmbedding } = require('../services/embeddingService');

async function migrate() {
  try {
    console.log('🚀 Starting Knowledge Base Vector Migration...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Force re-index all items to replace any mock vectors from failed runs
    const items = await KnowledgeBase.find({});
    console.log(`📦 Re-indexing all ${items.length} items with BGE-Small embeddings.`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`[${i + 1}/${items.length}] Indexing: ${item.question.slice(0, 30)}...`);
      
      const vector = await generateEmbedding(item.question);
      item.embedding = vector;
      await item.save();
    }

    console.log('✨ Migration Complete! All items are now vector-indexed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
