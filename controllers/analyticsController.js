const Ticket = require('../models/Ticket');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Get Operational Statistics for Sub-Heads & Admins
 * Includes: 
 * 1. Heatmap Data (active tickets with location)
 * 2. SLA Analytics (Average Resolution Time per district)
 */
exports.getOperationalStats = async (req, res) => {
  try {
    // 1. Heatmap Data: Find all non-resolved tickets with GPS
    const heatmapData = await Ticket.find(
      { 
        status: { $ne: 'resolved' },
        'location.coordinates': { $ne: [0, 0] } 
      },
      'location category priority createdAt'
    );

    // 2. SLA Analytics: Avg Resolution Time (ART) per District
    // We join with User collection to get the district of the farmer
    const districtStats = await Ticket.aggregate([
      { $match: { status: 'resolved', resolvedAt: { $exists: true } } },
      {
        $lookup: {
          from: 'users',
          localField: 'farmer',
          foreignField: '_id',
          as: 'farmerInfo'
        }
      },
      { $unwind: '$farmerInfo' },
      {
        $project: {
          district: '$farmerInfo.district',
          resolutionTimeHrs: {
            $divide: [
              { $subtract: ['$resolvedAt', '$createdAt'] },
              1000 * 60 * 60 // Convert ms to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: '$district',
          avgART: { $avg: '$resolutionTimeHrs' },
          totalResolved: { $sum: 1 }
        }
      },
      { $sort: { avgART: 1 } }
    ]);

    // 3. Category Distribution: Total count by category
    const categoryStats = await Ticket.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        heatmap: heatmapData.map(t => ({
          lat: t.location.coordinates[1],
          lng: t.location.coordinates[0],
          category: t.category,
          priority: t.priority
        })),
        districtPerformance: districtStats.map(s => ({
          district: s._id || 'Unknown',
          avgART: Math.round(s.avgART * 10) / 10,
          count: s.totalResolved
        })),
        categories: categoryStats.map(c => ({
          label: c._id.replace('_', ' ').charAt(0).toUpperCase() + c._id.slice(1).replace('_', ' '),
          value: c.count
        }))
      }
    });
  } catch (error) {
    console.error('[ANALYTICS] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
};
