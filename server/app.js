import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route Imports
import healthRouter from './routes/health.routes.js';
import productRouter from './routes/product.routes.js';
import orderRouter from './routes/order.routes.js';
import paymentRouter from './routes/payment.routes.js';
import disputeRouter from './routes/dispute.routes.js';
import adminRouter from './routes/admin.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security Headers with Helmet
// Configure CSP to allow Firebase Auth, Razorpay, Google Fonts, and Cloudinary resource loading
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.gstatic.com", "https://apis.google.com", "https://checkout.razorpay.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://lh3.googleusercontent.com"],
      connectSrc: ["'self'", "https://www.gstatic.com", "https://*.googleapis.com", "https://*.firebaseapp.com", "https://*.firebaseio.com", "https://identitytoolkit.googleapis.com", "https://api.razorpay.com"],
      frameSrc: ["'self'", "https://*.firebaseapp.com", "https://api.razorpay.com", "https://checkout.razorpay.com"]
    }
  }
}));

// Enable CORS
app.use(cors());

// General rate limiter for APIs
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

// Express JSON and urlencoded body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logging using morgan and custom logger
app.use(morgan('dev'));
app.use(requestLogger);

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve uploaded images (local uploads directory fallback)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/health', healthRouter);
app.use('/api/products', productRouter);
app.use('/api/orders', orderRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/disputes', disputeRouter);
app.use('/api/admin', adminRouter);

// Fallback: serve index.html for undefined routes to support client-side routing if any
app.get('*', (req, res, next) => {
  // If requesting API, proceed to notFound/errorHandler instead of HTML
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return next();
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 Route Not Found for APIs
app.use((req, res, next) => {
  res.status(404);
  const error = new Error(`API endpoint not found: ${req.originalUrl}`);
  next(error);
});

// Centralized error handling middleware
app.use(errorHandler);

export default app;
export { app };
