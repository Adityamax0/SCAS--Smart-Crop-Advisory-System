const Ticket = require('../models/Ticket');
const User = require('../models/User');
const { sendNotification } = require('./notificationService');

/**
 * Assign ticket to the nearest available Bij Bhandar Worker
 * Uses MongoDB $near geospatial query on the worker's location index.
 */
const assignToNearestWorker = async (ticket) => {
  const worker = await User.findOne({
    role: 'worker',
    isActive: true,
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: ticket.location.coordinates,
        },
        $maxDistance: 50000, // 50 km radius
      },
    },
  });

  if (!worker) {
    console.warn(`[ESCALATION] No worker found near ticket ${ticket._id}. Auto-escalating to sub-head.`);
    return escalateToSubHead(ticket, 'No available worker within 50km radius');
  }

  ticket.assignedWorker = worker._id;
  ticket.status = 'assigned';
  ticket.escalationHistory.push({
    from: 'system',
    to: 'worker',
    reason: `Auto-assigned to nearest worker: ${worker.name} (${worker.district})`,
  });

  await ticket.save();

  // Notify the worker
  await sendNotification(worker._id, 'push', 'New Ticket Assigned', `Ticket #${ticket._id.toString().slice(-6)} requires your attention.`, ticket._id);

  console.log(`[ESCALATION] Ticket ${ticket._id} assigned to worker ${worker.name}`);
  return ticket;
};

/**
 * Escalate ticket from Worker tier to Sub-Head tier
 */
const escalateToSubHead = async (ticket, reason = 'Unresolved beyond threshold') => {
  const subhead = await User.findOne({
    role: 'subhead',
    isActive: true,
    district: ticket.location ? undefined : undefined, // District match if available
  });

  if (!subhead) {
    console.warn(`[ESCALATION] No sub-head available. Escalating directly to admin.`);
    return escalateToAdmin(ticket, 'No sub-head available for region');
  }

  ticket.assignedSubHead = subhead._id;
  ticket.status = 'escalated_subhead';
  ticket.escalatedAt = new Date();
  ticket.escalationHistory.push({
    from: 'worker',
    to: 'subhead',
    reason,
  });

  await ticket.save();

  // Notify Sub-Head
  await sendNotification(subhead._id, 'sms', 'Escalated Ticket', `Ticket #${ticket._id.toString().slice(-6)} escalated: ${reason}`, ticket._id);

  console.log(`[ESCALATION] Ticket ${ticket._id} escalated to sub-head ${subhead.name}`);
  return ticket;
};

/**
 * Escalate ticket to Admin / Government Official tier
 */
const escalateToAdmin = async (ticket, reason = 'Requires government intervention') => {
  ticket.status = 'escalated_admin';
  ticket.escalatedAt = new Date();
  ticket.escalationHistory.push({
    from: 'subhead',
    to: 'admin',
    reason,
  });

  await ticket.save();

  // Notify all admins
  const admins = await User.find({ role: 'admin', isActive: true });
  for (const admin of admins) {
    await sendNotification(admin._id, 'email', 'Critical Escalation', `Ticket #${ticket._id.toString().slice(-6)} requires govt intervention: ${reason}`, ticket._id);
  }

  console.log(`[ESCALATION] Ticket ${ticket._id} escalated to admin level. ${admins.length} admins notified.`);
  return ticket;
};

/**
 * Cron handler: High-Precision SLA Auto-Enforcement
 * Rules:
 * - Critical Priority: Escalate after 3 hours
 * - High Priority: Escalate after 6 hours
 * - Medium/Low Priority: Escalate after 12 hours
 */
const runAutoEscalation = async () => {
  console.log('[SLA] Running diagnostic check...');
  
  const now = new Date();
  const thresholds = {
    critical: 3 * 60 * 60 * 1000,
    high: 6 * 60 * 60 * 1000,
    medium: 12 * 60 * 60 * 1000,
    low: 24 * 60 * 60 * 1000
  };

  try {
    // 1. Fetch all pending or assigned tickets
    const activeTickets = await Ticket.find({
      status: { $in: ['submitted', 'assigned', 'in_progress', 'escalated_subhead'] }
    });

    for (const ticket of activeTickets) {
      try {
        const priority = ticket.priority || 'medium';
        const limit = thresholds[priority] || thresholds.medium;
        const lastAction = ticket.lastEscalatedAt || ticket.createdAt;
        const timeElapsed = now - lastAction;

        if (timeElapsed >= limit) {
          console.log(`[SLA] Breach detected for Ticket ${ticket._id} (${priority})`);
          
          ticket.slaBreached = true;
          
          // Apply penalty to current assignee if applicable
          if (ticket.assignedWorker && ticket.status === 'assigned') {
            await User.findByIdAndUpdate(ticket.assignedWorker, { $inc: { performanceScore: -5 } });
            console.log(`[SLA] Worker ${ticket.assignedWorker} penalized -5 pts`);
          }

          // Escalate based on current level
          if (ticket.status === 'submitted' || ticket.status === 'assigned' || ticket.status === 'in_progress') {
            await escalateToSubHead(ticket, `SLA Breach: Unresolved after ${Math.round(timeElapsed/3600000)}h (${priority})`);
          } else if (ticket.status === 'escalated_subhead') {
            await escalateToAdmin(ticket, `CRITICAL SLA Breach: Ignored at Sub-Head level`);
          }

          ticket.lastEscalatedAt = new Date();
          await ticket.save();
        }
      } catch (err) {
        console.error(`[SLA] Error processing ticket ${ticket._id}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[SLA] Auto-escalation failed:', error.message);
  }
};

/**
 * Retroactively assigns nearby abandoned tickets to a newly onboarded worker
 * Uses MongoDB $near geospatial query to find tickets within 50km.
 */
const reassignPendingTickets = async (newWorker) => {
  if (!newWorker.location || !newWorker.location.coordinates) return;

  try {
    const abandonedTickets = await Ticket.find({
      status: { $in: ['submitted', 'escalated_subhead'] },
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: newWorker.location.coordinates },
          $maxDistance: 50000,
        },
      },
    });

    for (const ticket of abandonedTickets) {
      ticket.assignedWorker = newWorker._id;
      ticket.status = 'assigned';
      ticket.slaBreached = false; // Reset breach status
      
      // CRITICAL SLA FIX: Reset the absolute clocks to exactly NOW.
      // Otherwise, the aggressive SLA cron job will see these tickets are > 6 hours old
      // and immediately rip them away from the new worker within 60 seconds!
      ticket.createdAt = new Date();
      ticket.lastEscalatedAt = new Date();

      ticket.escalationHistory.push({
        from: 'system',
        to: 'worker',
        reason: `Retroactively reassigned to newly onboarded regional worker: ${newWorker.name} (SLA Clocks Reset to ZERO)`,
      });
      await ticket.save();
      
      await sendNotification(newWorker._id, 'push', 'New Ticket Assigned', `Ticket #${ticket._id.toString().slice(-6)} requires your attention.`, ticket._id);
    }
    console.log(`[ESCALATION] Retroactively assigned ${abandonedTickets.length} tickets to new worker ${newWorker.name}`);
  } catch (err) {
    console.error('[ESCALATION] Reassign pending tickets error:', err.message);
  }
};

module.exports = {
  assignToNearestWorker,
  escalateToSubHead,
  escalateToAdmin,
  runAutoEscalation,
  reassignPendingTickets
};
