require('dotenv').config();
const mongoose = require('mongoose');
const Redis = require('ioredis');
const Groq = require('groq-sdk');
const { pipeline } = require('@xenova/transformers');

async function runTests() {
  console.log('--- SCAS SYSTEM VERIFICATION START ---');
  let passed = 0;
  let failed = 0;

  // 1. MONGODB TEST
  try {
    process.stdout.write('[TEST 1] Connecting to MongoDB... ');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ PASS');
    passed++;
  } catch (err) {
    console.log('❌ FAIL:', err.message);
    failed++;
  }

  // 2. REDIS TEST
  try {
    process.stdout.write('[TEST 2] Connecting to Upstash Redis... ');
    const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
    await redis.set('scas_test_key', 'working', 'EX', 10);
    const val = await redis.get('scas_test_key');
    if (val === 'working') {
      console.log('✅ PASS');
      passed++;
    } else {
      throw new Error('Redis read/write mismatch');
    }
    redis.quit();
  } catch (err) {
    console.log('❌ FAIL:', err.message);
    failed++;
  }

  // 3. GROQ AI TEST
  try {
    process.stdout.write('[TEST 3] Connecting to Groq AI (Llama-3)... ');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Say "hello" exactly.' }],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 10
    });
    if (completion.choices[0].message.content.toLowerCase().includes('hello')) {
      console.log('✅ PASS');
      passed++;
    } else {
      throw new Error('Unexpected response from Groq');
    }
  } catch (err) {
    console.log('❌ FAIL:', err.message);
    failed++;
  }

  // 4. EMBEDDING ENGINE TEST
  try {
    process.stdout.write('[TEST 4] Loading HuggingFace Embedding Engine... ');
    // use a tiny model for fast test, or the actual one depending on cache
    const generateEmbedding = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const out = await generateEmbedding('Test sentence', { pooling: 'mean', normalize: true });
    if (out && out.data.length > 0) {
      console.log('✅ PASS');
      passed++;
    } else {
      throw new Error('Embedding failed to generate data');
    }
  } catch (err) {
    console.log('❌ FAIL:', err.message);
    failed++;
  }

  console.log('--------------------------------------');
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  
  if (failed > 0) {
    console.log('❌ SYSTEM CHECK FAILED');
    process.exit(1);
  } else {
    console.log('✅ SYSTEM CHECK PASSED');
    process.exit(0);
  }
}

runTests();
