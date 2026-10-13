import mongoose from 'mongoose';
import dns from 'dns';

/**
 * Configure Custom DNS Resolution and Connect to MongoDB
 * Feature #12: MongoDB connection with custom DNS
 */
export const connectDB = async () => {
  try {
    // Custom DNS resolution configuration (Google + Cloudflare DNS)
    const customDnsServers = process.env.CUSTOM_DNS
      ? process.env.CUSTOM_DNS.split(',').map(s => s.trim()).filter(Boolean)
      : ['8.8.8.8', '8.8.4.4', '1.1.1.1'];

    try {
      dns.setServers(customDnsServers);
      console.log(`[DNS] Custom DNS configured: ${customDnsServers.join(', ')}`);
    } catch (dnsErr) {
      console.warn(`[DNS] Warning: Could not set custom DNS servers: ${dnsErr.message}`);
    }

    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/das_cafe';

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`[MongoDB] Connected successfully to: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    console.error(`[MongoDB] Ensure MongoDB service is running or check your MONGO_URI in .env`);
    // In production we may exit, in dev we allow the app to keep running to show friendly status
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};
