import express from 'express';
import mongoose from 'mongoose';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  let dbStatus = 'disconnected';

  if (dbState === 1) dbStatus = 'connected';
  else if (dbState === 2) dbStatus = 'connecting';
  else if (dbState === 3) dbStatus = 'disconnecting';

  res.status(200).json({
    status: 'ok',
    service: 'resolveai',
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

router.get('/me', authenticateUser, (req, res) => {
  res.status(200).json({
    status: 'ok',
    user: req.user
  });
});

export default router;
