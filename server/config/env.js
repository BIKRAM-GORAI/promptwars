import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables from root folder
dotenv.config({ path: path.join(__dirname, '../../.env') });

const requiredEnv = ['MONGODB_URI', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];

for (const envName of requiredEnv) {
  if (!process.env[envName]) {
    console.error(`[ERROR] Missing required environment variable: ${envName}`);
  }
}

export const env = {
  port: process.env.PORT || 5000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/resolveai',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite',
  storageType: process.env.STORAGE_TYPE || 'local',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || process.env.GMAIL_EMAIL || '',
    pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '',
    from: process.env.EMAIL_FROM || process.env.GMAIL_EMAIL || 'noreply@resolveai.com',
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@resolveai.com',
    password: process.env.ADMIN_PASSWORD || 'adminpassword123',
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || ''
  },
  returnWindowDays: parseInt(process.env.RETURN_WINDOW_DAYS || '7', 10),
  autoRefundLimit: parseFloat(process.env.AUTO_REFUND_LIMIT || '10000')
};
