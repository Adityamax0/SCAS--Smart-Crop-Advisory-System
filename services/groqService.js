const Groq = require('groq-sdk');
const fs = require('fs');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Transcribe an audio file using Groq's fast Whisper model
 * @param {string} filePath - Path to the temporary audio file
 * @returns {Promise<string>} - Transcribed text
 */
exports.transcribeAudio = async (filePath) => {
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-large-v3",
      language: "en", // The model auto-detects, but 'en' or 'hi' hints are good. 'en' fits generic first pass.
    });
    return transcription.text;
  } catch (error) {
    console.error('Groq Whisper API Error:', error);
    throw new Error('Failed to transcribe audio via Groq');
  }
};

const { searchKB, addToKB } = require('./knowledgeService');

/**
 * Send text to Llama-3 to determine if it's an advisory question or requires a ticket
 * @param {string} text - Transcribed user input
 * @returns {Promise<Object>} - Decoded JSON intent
 */
exports.analyzeIntent = async (text) => {
  try {
    // 1. Ask Llama-3 to intelligently classify the user's raw input first
    const prompt = `
You are Krishi Mitra, an AI Agricultural Expert for Indian Farmers.
A farmer has said the following: "${text}"

Determine the exact nature of this message. 
CRITICAL RULES (FOLLOW IN EXACT ORDER):
1. HIGHEST PRIORITY: If the farmer says ANY word of agreement or command (e.g., "yes", "haan", "ha", "haaa", "ok", "karo", "do it", "raise", "ticket", "bula lo"), ASSUME they are granting permission to raise a ticket. The intent MUST be "ticket". NEVER classify these as greetings or small talk.
2. If it's a severe pest attack, unknown disease, or request for physical help, intent MUST be "escalate_prompt". The response MUST politely ask the farmer if they want to raise a formal ticket so an expert can visit. Do NOT say you have created it. Just ask for permission.
3. If it's purely a greeting ("hello", "hi", "namaste", "kaise ho"), intent MUST be "greeting".
4. If it's a general farming question (e.g., "when to harvest"), intent MUST be "advisory".

Respond in pure JSON format:
{
  "intent": "greeting" | "ticket" | "escalate_prompt" | "advisory",
  "category": "pest" | "disease" | "weather" | "general" | "other",
  "response": "Your response in the SAME LANGUAGE as the farmer (Hindi/English). If it's a greeting, just say hello back playfully!"
}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const aiResult = JSON.parse(chatCompletion.choices[0]?.message?.content || '{}');

    // 2. If it's just a greeting, return instantly without any DB checks
    if (aiResult.intent === 'greeting') {
      return {
        intent: 'advisory', // frontend maps 'advisory' to normal chat bubble
        category: 'general',
        response: aiResult.response,
        source: 'conversational'
      };
    }

    // 3. If it's an agricultural 'advisory', we MUST enforce the Hallucination Guardrail
    if (aiResult.intent === 'advisory') {
      const kbMatch = await searchKB(text);

      // Guardrail: High Confidence -> Return verified KB answer
      if (kbMatch && !kbMatch.lowConfidence) {
        return {
          intent: 'advisory',
          category: kbMatch.category,
          response: kbMatch.answer,
          source: 'knowledge_base'
        };
      }
      
      // Guardrail: Low or No Confidence -> Ask permission to escalate!
      console.warn(`[GROQ] Hallucination Guardrail Triggered. Asking permission to escalate: "${text}"`);
      return {
        intent: 'escalate_prompt',
        category: aiResult.category || 'other',
        response: aiResult.response + '\n\n(This issue seems serious. Would you like me to raise a formal ticket so a Field Worker can assist you? / क्या आप चाहते हैं कि मैं एक कृषि विशेषज्ञ को बुलाऊं?)'
      };
    }

    // 4. If Llama-3 independently decided it was an 'escalate_prompt' (severe disease identified natively)
    if (aiResult.intent === 'escalate_prompt') {
      return {
        intent: 'escalate_prompt',
        category: aiResult.category || 'other',
        response: aiResult.response
      };
    }

    // 5. If the farmer explicitly agreed to raise the ticket (intent: ticket)
    if (aiResult.intent === 'ticket') {
      return {
        intent: 'ticket',
        category: aiResult.category || 'other',
        response: aiResult.response
      };
    }

    // Ultimate fallback
    return aiResult;
  } catch (error) {
    console.error('Groq Llama-3 API Error:', error);
    throw new Error('Failed to analyze intent via Groq');
  }
};

/**
 * Generate real-time crop recommendations for a district if not in DB
 * @param {string} district 
 * @param {string} state 
 * @returns {Promise<Array>} - List of crops
 */
exports.generateRegionalAdvisory = async (district, state) => {
  try {
    const prompt = `
      You are an Indian Agricultural Scientist. 
      Generate a list of 3 best crops to grow in ${district}, ${state} based on typical soil and climate.
      
      Return ONLY a JSON array of objects:
      [
        { "name": "Crop Name", "season": "Kharif|Rabi|Zaid", "expectedYield": "e.g. 4-5 Tons/Ha", "suitabilityScore": 1-100 }
      ]
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = chatCompletion.choices[0]?.message?.content || '{"crops": []}';
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : (parsed.crops || []);
  } catch (error) {
    console.error('[GROQ ADVISORY] AI Fallback Error:', error.message);
    return []; // Return empty so frontend handles 'Collecting data...'
  }
};

/**
 * Identify Indian District and State from GPS coordinates
 * @param {number} lat 
 * @param {number} lon 
 * @returns {Promise<Object>} - { district, state }
 */
exports.reverseGeocode = async (lat, lon) => {
  try {
    const prompt = `Identify the Indian District and State for coordinates (${lat}, ${lon}). Return ONLY a JSON object: { "district": "Name", "state": "Name" }`;
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0, // Deterministic
    });

    return JSON.parse(chatCompletion.choices[0]?.message?.content || '{}');
  } catch (error) {
    console.error('[GROQ GEOCODE] Error:', error.message);
    return null;
  }
};
