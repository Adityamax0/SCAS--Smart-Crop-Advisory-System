const Ticket = require('../models/Ticket');
const { assignToNearestWorker } = require('../services/escalationService');

/**
 * POST /api/sync
 * Idempotent sync endpoint for offline-submitted tickets.
 * Accepts an array of tickets, each with a unique clientId (UUID).
 * Duplicates are safely skipped.
 */
const syncOfflineTickets = async (req, res) => {
  try {
    const { tickets } = req.body;

    if (!Array.isArray(tickets) || tickets.length === 0) {
      return res.status(400).json({ success: false, message: 'An array of tickets is required.' });
    }

    const results = {
      synced: [],
      duplicates: [],
      errors: [],
    };

    for (const ticketData of tickets) {
      try {
        const { clientId, description, cropType, category, priority, coordinates } = ticketData;

        if (!clientId || !description) {
          results.errors.push({ clientId, error: 'Missing clientId or description' });
          continue;
        }

        // Idempotency: check if this clientId already exists
        const existing = await Ticket.findOne({ clientId });
        if (existing) {
          results.duplicates.push(clientId);
          continue;
        }

        const ticket = await Ticket.create({
          clientId,
          farmer: req.user._id,
          description,
          cropType,
          category: category || 'other',
          priority: priority || 'medium',
          location: coordinates
            ? { type: 'Point', coordinates }
            : { type: 'Point', coordinates: req.user.location.coordinates },
        });

        // Trigger worker assignment
        await assignToNearestWorker(ticket);

        results.synced.push(clientId);
      } catch (err) {
        results.errors.push({ clientId: ticketData.clientId, error: err.message });
      }
    }

    console.log(`[SYNC] Processed ${tickets.length}: ${results.synced.length} synced, ${results.duplicates.length} duplicates, ${results.errors.length} errors`);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { syncOfflineTickets };
