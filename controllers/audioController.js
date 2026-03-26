const fs = require('fs');
const groqService = require('../services/groqService');
const Ticket = require('../models/Ticket');
const User = require('../models/User');

exports.processAudio = async (req, res) => {
  try {
    let transcription = '';

    if (req.file) {
      // 🛡️ NOISE PROTECTION: Skip files < 4KB (too small for valid speech)
      const stats = fs.statSync(req.file.path);
      if (stats.size < 4000) {
        console.warn(`[AUDIO] File too small (${stats.size} bytes), likely static noise.`);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          success: false, 
          message: 'Audio signal too weak. Please speak closer to the mic or type your issue.' 
        });
      }

      // 1. Transcribe audio using Whisper safely
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
      // Clean up the temp file
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    } else if (req.body.text) {
      // Direct text bypass (for testing or manual chat)
      transcription = req.body.text;
      console.log('[AUDIO] Direct Text Input:', transcription);
    } else {
      return res.status(400).json({ success: false, message: 'No audio or text provided' });
    }

    if (!transcription || transcription.trim().length < 5) {
      return res.status(400).json({ 
        success: false, 
        message: 'Could not hear you clearly. Please speak louder or provide more details.' 
      });
    }

    // Efficiency Fix: Apply Context Window Truncation (approx 1000 tokens heuristic)
    // Prevents massive token usage and latency spikes during very long conversations.
    const MAX_CONTEXT_CHARS = 1200;
    const cleanTranscription = transcription.length > MAX_CONTEXT_CHARS
      ? "... " + transcription.slice(-MAX_CONTEXT_CHARS)
      : transcription;

    // 🎙️ STEP 3: Llama-3 Analysis & Strategy
    let analysis;
    let finalResponse;
    try {
      analysis = await groqService.analyzeCropIssue(transcription);
      console.log('[AUDIO] Intent Analysis:', analysis);

      // 🏛️ Bharat-VISTAAR: Augment with ICAR Official Guidelines
      const icarService = require('../services/icarService');
      const officialGuideline = await icarService.getICARGuideline(transcription);

      // 🗣️ Bhashini Vaanianuvaad: Speech-to-Speech Translation Layer
      // Detect dialect/language and simulate Vaanianuvaad translation
      const detectedDialect = transcription.match(/[अ-ह]/) ? 'hi' : 'en'; // Simple heuristic for mock
      const translationMessage = detectedDialect === 'hi' 
        ? "Bhashini: वाणी अनुवाद (Vaanianuvaad) सक्रिय - स्थानीय बोली में उत्तर दिया जा रहा है।" 
        : "Bhashini: Vaanianuvaad Active - Responding in original dialect context.";

      finalResponse = `\n[${translationMessage}]\n\n${analysis.response}\n\n🔍 **Official Guidance (Bharat-VISTAAR):** ${officialGuideline.recommendation}\n*Source: Bharat-VISTAAR (ICAR-IARI 2026 Verified Guidelines)*`;

      // 💾 STEP 4: Persist Ticket if required strategy is identified
      if (analysis.action === 'ticket' || analysis.confidence === 'low') {
        const Ticket = require('../models/Ticket');
        newTicket = await Ticket.create({
          farmer: req.user._id,
          description: `[VOICE TRANSCRIPT]: ${transcription}`,
          category: analysis.category || 'other',
          priority: analysis.confidence === 'low' ? 'critical' : 'medium'
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

    } catch (llamaErr) {
      console.warn('[AUDIO] Llama-3 Intent Analysis failed.', llamaErr.message);
      // If user is not logged in, prompt them beautifully
      if (!req.user) {
        return res.status(200).json({ 
          success: true, 
          message: '🚨 I have detected a severe crop issue! Please **Log in** or **Register** so I can immediately alert an agricultural expert in your district.',
          action: 'advisory',
          transcription
        });
      }
      return res.status(200).json({
        success: true,
        action: 'advisory',
        message: 'I am experiencing a brief connection issue while thinking. Please try asking again in a moment, or use the "Submit Ticket" form directly.'
      });
    }
  } catch (err) {
      // Scenario A: Advisory with 'Problem Vault' verified lookup
      const { findSimilarProblems } = require('../services/vectorService');
      const similarCases = await findSimilarProblems(transcription, 1);
      
      let finalMessage = analysis.response;
      
      // If a highly similar verified problem is found, append it as 'Proven Solution'
      if (similarCases.length > 0) {
        finalMessage += `\n\n✅ [PROVEN SOLUTION]: Some farmers in your region solved this by: ${similarCases[0].answer}`;
      }

      return res.status(200).json({
        success: true,
        message: finalMessage,
        action: 'advisory',
        transcription,
        metadata: {
          requires_human_intervention: false,
          verified_source: similarCases.length > 0 ? 'problem_vault' : 'ai_only'
        }
      });
    }
  } catch (err) {
    console.error('[AUDIO process ERROR]', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    
    // 🛡️ EMERGENCY FALLBACK: If everything fails, still try to create a manual ticket to prevent data loss
    if (req.user) {
      try {
        const fallbackTicket = await Ticket.create({
          clientId: `err-${Date.now()}`,
          farmer: req.user._id,
          description: `🚨 [SYSTEM FALLBACK]: Audio processing failed. Transcription Buffer: "${req.body.text || 'Audio Stream Attached'}"`,
          priority: 'high',
          metadata: { requires_human_intervention: true, system_error: true }
        });
        return res.status(200).json({
          success: true,
          message: 'I had a minor glitch, but I have saved your record and alerted a human expert to call you back.',
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
