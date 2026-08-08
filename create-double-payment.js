import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Order } from './server/models/Order.js';
import { Payment } from './server/models/Payment.js';

dotenv.config();

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('Error: MONGODB_URI is not defined in .env');
  process.exit(1);
}

const createDuplicatePayment = async () => {
  try {
    console.log('[DATABASE] Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('[DATABASE] Connected successfully.');

    // Find the most recent order in the system
    const lastOrder = await Order.findOne().sort({ createdAt: -1 });
    if (!lastOrder) {
      console.warn('[WARN] No orders found in the database. Please place an order in the UI first!');
      process.exit(0);
    }

    // Find the original payment record for this order
    const originalPayment = await Payment.findOne({ orderId: lastOrder._id });
    if (!originalPayment) {
      console.warn(`[WARN] No payment records found for Order ID: ${lastOrder._id}`);
      process.exit(0);
    }

    // Create a duplicate payment record matching the same orderId and amount
    const duplicateTxId = `pay_dup_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const duplicatePayment = await Payment.create({
      orderId: lastOrder._id,
      userId: originalPayment.userId,
      amount: originalPayment.amount,
      currency: originalPayment.currency || 'INR',
      status: 'SUCCESS',
      transactionId: duplicateTxId,
      paymentMethod: originalPayment.paymentMethod || 'MOCK_CARD',
      createdAt: new Date()
    });

    console.log(`\n[SUCCESS] Duplicate payment successfully created for Order #${lastOrder._id}!`);
    console.log(`- Order Total: ₹${lastOrder.totalAmount}`);
    console.log(`- Original Transaction ID: ${originalPayment.transactionId}`);
    console.log(`- Duplicate Transaction ID: ${duplicatePayment.transactionId}\n`);
    console.log('You can now navigate to your Order history page in the UI, report a billing/double-charge issue, and see the AI resolve and refund it automatically!');

    process.exit(0);
  } catch (error) {
    console.error(`[ERROR] Failed to create duplicate payment: ${error.message}`);
    process.exit(1);
  }
};

createDuplicatePayment();
