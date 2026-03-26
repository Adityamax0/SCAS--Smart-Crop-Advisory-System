require('dotenv').config();
const mongoose = require('mongoose');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { getSocket, initSocket } = require('../socket'); // Ensure socket is initialized if running in same process, but here we just need DB

/**
 * SCAS SIREN TEST UTILITY
 * 🚨 This script creates a 'NEEDS EXPERT' emergency ticket manually.
 * Use this to verify that your Worker Dashboard screams and shows the Red Border.
 */
async function triggerTestEmergency() {
  try {
    console.log('🚨 Initializing Emergency Siren Test...');
    await mongoose.connect(process.env.MONGODB_URI);

    const worker = await User.findOne({ role: 'worker', isActive: true });
    const farmer = await User.findOne({ role: 'farmer' });

    if (!farmer) {
      console.error('❌ Error: No farmer found in DB. Please register a farmer first.');
      process.exit(1);
    }

    const testTicket = await Ticket.create({
      clientId: `test-siren-${Date.now()}`,
      farmer: farmer._id,
      description: "⚠️ [EMERGENCY TEST]: This is a simulated high-priority AI failure. The AI was unable to identify the pest in this audio stream. Immediate human intervention required.",
      cropType: "Test/Simulation",
      status: worker ? 'assigned' : 'submitted',
      assignedWorker: worker ? worker._id : null,
      priority: 'critical',
      metadata: {
        requires_human_intervention: true,
        ai_confidence: 'none',
        test_case: true
      }
    });

    console.log('✅ TEST TICKET CREATED!');
    console.log('Ticket ID:', testTicket._id);
    console.log('Status: HAS RED BORDER + SIREN FLAG');
    console.log('\n📢 CHECK YOUR WORKER DASHBOARD NOW!');
    
    // Note: To see the real-time toast, the worker dashboard must be open in a browser.
    // The Socket.io emit usually happens in the controller, so we've just created the data here.
    
    process.exit(0);
  } catch (error) {
    console.error('❌ TEST ERROR:', error.message);
    process.exit(1);
  }
}

triggerTestEmergency();
