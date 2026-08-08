import admin from 'firebase-admin';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

// Initialize Firebase Admin (Using the Project ID provided in user request configuration)
if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      projectId: 'promptwars-ffcfa'
    });
    console.log('[AUTH] Firebase Admin initialized for Project: promptwars-ffcfa');
  } catch (error) {
    console.error(`[AUTH ERROR] Firebase Admin initialization failed: ${error.message}`);
  }
}

/**
 * Middleware to authenticate customer requests.
 * Supports Firebase ID Tokens (for client login) and falls back to seeded customer if no token.
 */
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // If a token is provided in headers, verify it
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      // Admin token bypasses Firebase authentication to support reading customer files
      if (token === 'resolveai-admin-session-token') {
        const adminUser = await User.findOne({ email: env.admin.email, role: 'ADMIN' });
        req.user = adminUser ? adminUser : { name: 'System Admin', email: env.admin.email, role: 'ADMIN' };
        return next();
      }

      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Find or create customer in MongoDB using decoded Firebase details
        let user = await User.findOne({ email: decodedToken.email });
        
        if (!user) {
          user = await User.create({
            name: decodedToken.name || decodedToken.email.split('@')[0],
            email: decodedToken.email,
            role: 'CUSTOMER'
          });
          console.log(`[AUTH] Auto-created new customer record for: ${user.email}`);
        }
        
        req.user = {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        };
        
        return next();
      } catch (tokenError) {
        console.error(`[AUTH ERROR] Firebase token verification failed: ${tokenError.message}`);
        return res.status(401).json({ message: 'Unauthorized. Invalid or expired authentication token.' });
      }
    }
    
    // Fallback: If no token is provided, use seeded default customer for Phase 1 demo compatibility
    const customer = await User.findOne({ role: 'CUSTOMER' });
    if (!customer) {
      return res.status(404).json({ message: 'No seeded customer user found in the database. Run npm run seed.' });
    }
    
    req.user = {
      _id: customer._id,
      name: customer.name,
      email: customer.email,
      role: customer.role
    };
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to authenticate Admin endpoints.
 * Checks for a Mock Admin token in headers, matching the env credentials.
 */
export const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized. Missing admin authentication token.' });
    }

    const token = authHeader.split(' ')[1];
    
    if (token !== 'resolveai-admin-session-token') {
      return res.status(403).json({ message: 'Forbidden. Invalid or expired admin token.' });
    }

    const adminUser = await User.findOne({ email: env.admin.email, role: 'ADMIN' });
    req.user = adminUser ? adminUser : { name: 'System Admin', email: env.admin.email, role: 'ADMIN' };

    next();
  } catch (error) {
    next(error);
  }
};
