const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000 // 5 seconds timeout
    });
    console.log(`✅ MongoDB Atlas Connected: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.log('⚠️ MongoDB connection failed. Continuing server execution to prevent crash...');
  }
};

// Register runtime connection event listeners
mongoose.connection.on('error', (err) => {
  console.error(`❌ MongoDB Runtime Connection Error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB Disconnected. The database is currently unreachable.');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB Reconnected successfully.');
});

module.exports = connectDB;
