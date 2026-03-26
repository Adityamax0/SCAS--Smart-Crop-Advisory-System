require('dotenv').config();
const mongoose = require('mongoose');
const KnowledgeBase = require('../models/KnowledgeBase');
const { generateEmbedding } = require('../services/embeddingService');

async function seedVault() {
  try {
    console.log('🌱 Seeding the Problem Vault (Vector KnowledgeBase)...');
    await mongoose.connect(process.env.MONGODB_URI);

    const problems = [
      {
        question: "Yellow spots on rice leaves and drying tips",
        answer: "This is likely Rice Blast. Apply Tricyclazole 75 WP at 0.6g/liter of water and ensure proper drainage in the field.",
        category: "disease",
        tags: ["rice", "yellowing", "blast"]
      },
      {
        question: "Wheat plants turning brown and wilting in clusters",
        answer: "Possible Root Rot. Improve soil aeration and apply a soil-based fungicide. Avoid over-irrigation during high humidity.",
        category: "disease",
        tags: ["wheat", "wilting", "root rot"]
      },
      {
        question: "Tomato leaves curling upwards and white flies visible",
        answer: "Leaf Curl Virus transmitted by Whiteflies. Use yellow sticky traps and spray Imidacloprid (0.3ml/liter) early morning.",
        category: "pest",
        tags: ["tomato", "whitefly", "curl"]
      },
      {
        question: "Cotton balls falling off before opening",
        answer: "Bollworm infestation. Use Pheromone traps and consider planting Bt-Cotton next season. Spray Spinosad for immediate control.",
        category: "pest",
        tags: ["cotton", "bollworm", "shedding"]
      }
    ];

    console.log(`🧠 Generating embeddings for ${problems.length} cases...`);
    
    for (const p of problems) {
      // Generate the vector for the question
      p.embedding = await generateEmbedding(p.question);
      
      // Upsert into KB
      await KnowledgeBase.findOneAndUpdate(
        { question: p.question },
        p,
        { upsert: true, new: true }
      );
      process.stdout.write('.');
    }

    console.log('\n✅ Problem Vault seeded with local embeddings.');
    process.exit(0);
  } catch (error) {
    console.error('❌ SEED ERROR:', error.message);
    process.exit(1);
  }
}

seedVault();
