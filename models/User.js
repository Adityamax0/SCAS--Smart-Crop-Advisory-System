const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      match: [/^\+?[1-9]\d{9,14}$/, 'Please enter a valid phone number'],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['farmer', 'worker', 'subhead', 'admin'],
      default: 'farmer',
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
    district: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    performanceScore: {
      type: Number,
      default: 100,
      max: 100,
    },
    // 🇮🇳 AgriStack (Digital Agriculture Mission 2026) Integration
    agriStackId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    agriStackVerified: {
      type: Boolean,
      default: false,
    },
    landRecords: [
      {
        surveyNumber: String,
        area: Number, // in hectares
        cropHistory: [String],
        verifiedAt: Date,
      }
    ],
    // 🌍 2026 Sustainability & Carbon Ledger
    carbonCredits: {
      type: Number,
      default: 0,
      min: 0,
    },
    sustainablePractices: [
      {
        practice: { type: String, enum: ['no_till', 'organic', 'low_water', 'solar_power'] },
        activatedAt: Date,
        creditsEarned: Number
      }
    ],
    // 🏛️ 2026 UFSI Federated Metadata
    ufsi_handshake: {
      auditToken: String,
      registryOrigin: String,
      legalStatus: { type: String, default: 'INACTIVE' },
      verifiedAt: Date
    },
    // 🌍 Triple C: MRV Baseline
    baselineMeasurement: {
      measuredAt: Date,
      method: { type: String, enum: ['satellite_ndvi', 'soil_sensor', 'manual_audit'] },
      initialValue: Number,
      verifiedBy: String
    }
  },
  {
    timestamps: true,
  }
);

// GeoSpatial index for proximity-based worker assignment
userSchema.index({ location: '2dsphere' });
userSchema.index({ role: 1, district: 1 });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
