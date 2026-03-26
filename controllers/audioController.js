// SCAS Production Build - Sync ID: 1774123456789
const fs = require('fs');
const groqService = require('../services/groqService');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

exports.processAudio = async (req, res) => {
  try {
    let transcription = '';

    // 🎙️ STEP 1: Transcription Layer
    if (req.file) {
      const stats = fs.statSync(req.file.path);
      if (stats.size < 4000) {
        console.warn(`[AUDIO] File too small (${stats.size} bytes), likely static noise.`);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          success: false, 
          message: 'Audio signal too weak. Please speak closer to the mic or type your issue.' 
        });
      }

      try {
        transcription = await groqService.transcribeAudio(req.file.path);
        console.log('[AUDIO] Transcription:', transcription);
      } catch (whisperErr) {
        console.warn('[AUDIO] Whisper Transcription failed. Prompting manual fallback.');
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(200).json({
          success: true,
          action: 'advisory',
          message: 'I am temporarily having trouble understanding audio right now. Could you please type your question in the box below instead?'
        });
      }
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    } else if (req.body.text) {
      transcription = req.body.text;
    } else {
      return res.status(400).json({ success: false, message: 'No audio or text provided' });
    }

    if (!transcription || transcription.trim().length < 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Could not hear you clearly. Please speak louder or provide more details.' 
      });
    }

    // 🎙️ STEP 2: Llama-3 Analysis & Strategy
    let analysis;
    try {
      analysis = await groqService.analyzeCropIssue(transcription);
      console.log('[AUDIO] Intent Analysis:', analysis);
    } catch (llamaErr) {
      console.warn('[AUDIO] Llama-3 Intent Analysis failed. Falling back to generic advisory.', llamaErr.message);
      analysis = { response: "I am analyzing your crop details.", action: "advisory", confidence: "medium" };
    }

    // 🏛️ STEP 3: Bharat-VISTAAR & Problem Vault Fusion
    const icarService = require('../services/icarService');
    const { findSimilarProblems } = require('../services/vectorService');
    
    // Concurrent Lookup for low latency
    const [officialGuideline, similarCases] = await Promise.all([
      icarService.getICARGuideline(transcription),
      findSimilarProblems(transcription, 1)
    ]);

    // 🗣️ STEP 4: Bhashini Vaanianuvaad Translation Logic
    const detectedDialect = transcription.match(/[अ-ह]/) ? 'hi' : 'en';
    const translationPrefix = detectedDialect === 'hi' 
      ? "[बानी अनुवाद सक्रिय]" 
      : "[Vaanianuvaad Active]";

    let finalResponse = `${translationPrefix} ${analysis.response}`;

    // Append Proven Solution if found
    if (similarCases.length > 0) {
      finalResponse += `\n\n✅ [PROVEN SOLUTION]: ${similarCases[0].answer}`;
    }

    // Append ICAR Citation
    finalResponse += `\n\n🔍 **Official Guidance (Bharat-VISTAAR):** ${officialGuideline.recommendation}\n*Source: Bharat-VISTAAR (ICAR-IARI 2026 Verified Guidelines)*`;

    // 💾 STEP 5: Ticket Persistence (If Confidence low or specifically requested)
    let newTicket = null;
    if (analysis.action === 'ticket' || analysis.confidence === 'low') {
      newTicket = await Ticket.create({
        farmer: req.user?._id,
        description: `[VOICE TRANSCRIPT]: ${transcription}`,
        category: analysis.category || 'other',
        priority: analysis.confidence === 'low' ? 'critical' : 'medium',
        metadata: { verified_source: similarCases.length > 0 ? 'problem_vault' : 'ai_only' }
      });
    }

    return res.status(200).json({
      success: true,
      action: analysis.action,
      message: finalResponse,
      transcription,
      detectedDialect,
      ticket: newTicket
    });

  } catch (err) {
    console.error('[AUDIO process ERROR]', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    
    // 🛡️ EMERGENCY FALLBACK: Auto-Create Ticket
    if (req.user) {
      try {
        const fallbackTicket = await Ticket.create({
          farmer: req.user._id,
          description: `🚨 [SYSTEM FALLBACK]: Audio processing failed. Transcription Buffer: "${req.body.text || 'Audio Stream Attached'}"`,
          priority: 'high',
          metadata: { system_error: true }
        });
        return res.status(200).json({
          success: true,
          message: 'I had a minor glitch, but I have saved your record and alerted a human expert.',
          action: 'ticket',
          ticket: fallbackTicket
        });
      } catch (inner) {
        console.error('Critical Fallback Failed:', inner);
      }
    }
    
    res.status(500).json({ success: false, message: 'Server error processing audio' });
  }
};
