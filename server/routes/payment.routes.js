import express from 'express';
import { 
  createMockPayment, 
  getPaymentById,
  createRazorpayOrder,
  verifyRazorpayPayment
} from '../controllers/payment.controller.js';
import { authenticateUser } from '../middleware/auth.js';

const router = express.Router();

router.post('/mock', authenticateUser, createMockPayment);
router.post('/razorpay/order', authenticateUser, createRazorpayOrder);
router.post('/razorpay/verify', authenticateUser, verifyRazorpayPayment);
router.get('/:id', getPaymentById);

export default router;
