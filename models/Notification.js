const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    channel: {
      type: String,
      enum: ['sms', 'push', 'email'],
      required: true,
    },
    title: {
      type: String,
      default: 'SCAS Advisory',
    },
    content: {
      type: String,
      required: [true, 'Notification content is required'],
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'delivered'],
      default: 'pending',
    },
    ticketRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    errorLog: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ status: 1 });

// 🧹 AUTO-MAINTENANCE: Automatically delete notifications after 30 days (TTL Index)
// 30 days = 30 * 24 * 60 * 60 = 2592000 seconds
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('Notification', notificationSchema);
