const Ticket = require('../models/Ticket');
const User = require('../models/User');

/**
 * GET /api/admin/dashboard
 * High-level analytics for admin/government officials
 */
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalTickets,
      submittedCount,
      assignedCount,
      escalatedSubHeadCount,
      escalatedAdminCount,
      resolvedCount,
      totalFarmers,
      totalWorkers,
      totalSubHeads,
      breachedTickets,
    ] = await Promise.all([
      Ticket.countDocuments(),
      Ticket.countDocuments({ status: 'submitted' }),
      Ticket.countDocuments({ status: 'assigned' }),
      Ticket.countDocuments({ status: 'escalated_subhead' }),
      Ticket.countDocuments({ status: 'escalated_admin' }),
      Ticket.countDocuments({ status: { $in: ['resolved', 'closed'] } }),
      User.countDocuments({ role: 'farmer' }),
      User.countDocuments({ role: 'worker' }),
      User.countDocuments({ role: 'subhead' }),
      Ticket.find({ slaBreached: true, status: { $nin: ['resolved', 'closed'] } })
        .populate('farmer', 'name phone district')
        .populate('assignedWorker', 'name phone')
        .sort({ updatedAt: -1 })
        .limit(10),
    ]);

    // Average resolution time for resolved tickets
    const resolvedTickets = await Ticket.find({
      status: { $in: ['resolved', 'closed'] },
      resolvedAt: { $exists: true },
    }).select('createdAt resolvedAt');

    let avgResolutionHours = 0;
    if (resolvedTickets.length > 0) {
      const totalHours = resolvedTickets.reduce((sum, t) => {
        return sum + (new Date(t.resolvedAt) - new Date(t.createdAt)) / (1000 * 60 * 60);
      }, 0);
      avgResolutionHours = Math.round((totalHours / resolvedTickets.length) * 10) / 10;
    }

    // Category breakdown
    const categoryBreakdown = await Ticket.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        tickets: {
          total: totalTickets,
          submitted: submittedCount,
          assigned: assignedCount,
          escalatedSubHead: escalatedSubHeadCount,
          escalatedAdmin: escalatedAdminCount,
          resolved: resolvedCount,
        },
        users: {
          farmers: totalFarmers,
          workers: totalWorkers,
          subHeads: totalSubHeads,
        },
        performance: {
          avgResolutionHours,
          slaCompliance: totalTickets > 0
            ? Math.round((resolvedCount / totalTickets) * 100)
            : 0,
        },
        categoryBreakdown,
        breachedTickets,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/admin/escalation-report
 * Detailed escalation report
 */
const getEscalationReport = async (req, res) => {
  try {
    const escalatedTickets = await Ticket.find({
      status: { $in: ['escalated_subhead', 'escalated_admin'] },
    })
      .populate('farmer', 'name phone district')
      .populate('assignedWorker', 'name phone')
      .populate('assignedSubHead', 'name phone')
      .sort({ escalatedAt: -1 })
      .limit(50);

    const districtHotspots = await Ticket.aggregate([
      { $match: { status: { $in: ['escalated_subhead', 'escalated_admin'] } } },
      {
        $lookup: {
          from: 'users',
          localField: 'farmer',
          foreignField: '_id',
          as: 'farmerInfo',
        },
      },
      { $unwind: '$farmerInfo' },
      {
        $group: {
          _id: '$farmerInfo.district',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        escalatedTickets,
        districtHotspots,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDashboardStats, getEscalationReport };
