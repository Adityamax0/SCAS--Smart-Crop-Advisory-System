const mongoose = require('mongoose');

const escalationEntrySchema = new mongoose.Schema(
  {
    from: { type: String, enum: ['system', 'worker', 'subhead', 'admin'] },
    to: { type: String, enum: ['worker', 'subhead', 'admin'] },
    reason: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: [true, 'Client-side UUID is required for idempotency'],
      unique: true,
      index: true,
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Farmer reference is required'],
    },
    assignedWorker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedSubHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['submitted', 'assigned', 'in_progress', 'escalated_subhead', 'escalated_admin', 'resolved', 'closed'],
      default: 'submitted',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    category: {
      type: String,
      enum: ['pest', 'disease', 'nutrient_deficiency', 'irrigation', 'weather_damage', 'other'],
      default: 'other',
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: 2000,
    },
    cropType: {
      type: String,
      trim: true,
    },
    mediaUrls: [
      {
        type: String,
      },
    ],
    voiceUrl: {
      type: String,
      default: null,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    resolution: {
      notes: { type: String },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      resolvedAt: { type: Date },
      proofOfWorkUrl: { type: String },
      proofOfWorkType: { type: String, enum: ['image', 'audio', 'none'], default: 'none' }
    },
    escalationHistory: [escalationEntrySchema],
    slaBreached: {
      type: Boolean,
      default: false,
    },
    lastEscalatedAt: {
      type: Date,
      default: null,
    },
    escalatedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    // 🚀 FUTURE-PROOFING: Flexible metadata reservoir for post-deployment expansion
    // Use this for AI Diagnosis, Sensor Data, or Vision Analysis results.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// GeoSpatial index for location-based queries
ticketSchema.index({ location: '2dsphere' });
// Compound indexes for common queries
ticketSchema.index({ status: 1, createdAt: -1 });
ticketSchema.index({ assignedWorker: 1, status: 1 });
ticketSchema.index({ farmer: 1, createdAt: -1 });

module.exports = mongoose.model('Ticket', ticketSchema);
