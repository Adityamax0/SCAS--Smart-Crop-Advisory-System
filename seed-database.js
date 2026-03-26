require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Ticket = require('./models/Ticket');

/**
 * PRODUCTION-SAFE SEEDING SCRIPT
 * Populates essential system roles and initial crop knowledge.
 */
async function seedDatabase() {
  try {
    console.log('🌱 Starting Production Seeding Strategy...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas.');

    // 1. Check if database is already populated
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('⚠️ Database already contains users. Skipping seed to prevent data corruption.');
      process.exit(0);
    }

    console.log('🛠️ Generating System Roles (Admin, Sub-Head, Worker)...');
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Scas@2026', salt);

    const users = await User.insertMany([
      {
        name: 'SCAS System Admin',
        email: 'admin@scas.gov.in',
        password: hashedPassword,
        role: 'admin',
        district: 'Central',
        isActive: true
      },
      {
        name: 'Regional Sub-Head',
        email: 'subhead@scas.gov.in',
        password: hashedPassword,
        role: 'subhead',
        district: 'Ahmedabad',
        isActive: true
      },
      {
        name: 'Senior Field Worker',
        email: 'worker@scas.gov.in',
        password: hashedPassword,
        role: 'worker',
        district: 'Ahmedabad',
        isActive: true
      }
    ]);

    console.log(`✅ Successfully created ${users.length} system users.`);
    console.log('🚀 SYSTEM READY FOR PRODUCTION LOGINS.');
    console.log('--------------------------------------');
    console.log('CREDENTIALS FOR FIRST LOGIN:');
    console.log('User: admin@scas.gov.in');
    console.log('Pass: Scas@2026');
    console.log('--------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('❌ SEED ERROR:', error.message);
    process.exit(1);
  }
}

seedDatabase();
