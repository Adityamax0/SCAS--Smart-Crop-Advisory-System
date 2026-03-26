const Ticket = require('../models/Ticket');
const { getSocket } = require('../socket');
const { sendNotification } = require('../services/notificationService');
const User = require('../models/User');

/**
 * SCAS: Digital Twin Simulation Controller
 * 🌪️ Allows demonstration of predictive and large-scale reactive logic.
 */

exports.triggerScenario = async (req, res) => {
  try {
    const { scenario, district } = req.body;
    const io = getSocket();

    if (!district) return res.status(400).json({ success: false, message: 'District is required for localized simulation.' });

    console.log(`[SIMULATION] Triggering ${scenario.toUpperCase()} in ${district}...`);

    let resultMessage = "";
    
    switch (scenario) {
      case 'hailstorm':
        // 1. Find all non-resolved tickets in the district and upgrade to CRITICAL
        const affectedUsers = await User.find({ district, role: 'farmer' }).select('_id');
        const userIds = affectedUsers.map(u => u._id);
        
        const updateResult = await Ticket.updateMany(
          { farmer: { $in: userIds }, status: { $ne: 'resolved' } },
          { 
            priority: 'critical', 
            category: 'weather_damage',
            description: `⚠️ [PREDICTIVE ALERT]: System detected Hailstorm in ${district}. Automated Re-prioritization to CRITICAL. Original Title: ` + "$description"
          }
        );

        // 2. Emit global Siren event via Socket.io to all workers in that district
        io.to(district).emit('emergency_broadcast', {
          type: 'HAILSTORM_WARNING',
          message: `📉 URGENT: Hailstorm detected in ${district}. All active field tickets upgraded to CRITICAL. Activate Emergency Protocol.`,
          severity: 'high'
        });

        resultMessage = `Hailstorm simulation active. ${updateResult.modifiedCount} tickets escalated to Critical.`;
        break;

      case 'pest_outbreak':
        // Simulation of a fast-spreading locust or pest issue
        io.to(district).emit('emergency_broadcast', {
          type: 'PEST_OUTBREAK',
          message: `🐝 ALERT: Locust activity detected near ${district} borders. High surveillance required for all Paddy crops.`,
          severity: 'medium'
        });
        resultMessage = `Pest Outbreak broadcasted to all workers in ${district}.`;
        break;

      default:
        return res.status(400).json({ success: false, message: 'Unknown scenario.' });
    }

    res.status(200).json({
      success: true,
      message: resultMessage,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('[SIMULATION] Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
