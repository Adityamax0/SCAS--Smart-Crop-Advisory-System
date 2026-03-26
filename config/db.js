const mongoose = require('mongoose');

const connectDB = async () => {
  const MAX_RETRIES = 5;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      console.log(`[DB] MongoDB Atlas connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      retries++;
      console.error(`[DB] Connection attempt ${retries}/${MAX_RETRIES} failed: ${error.message}`);
      if (retries === MAX_RETRIES) {
        console.error('[DB] Max retries reached. Exiting process.');
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

module.exports = connectDB;
