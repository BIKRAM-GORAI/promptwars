import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { connectDB } from './config/db.js';
import { Dispute } from './models/Dispute.js';
import { Order } from './models/Order.js';
import { Payment } from './models/Payment.js';
import { AutomationLog } from './models/AutomationLog.js';
import { disputeResolver } from './services/dispute/disputeResolver.js';
import { User } from './models/User.js';

const runTest = async () => {
  console.log('==================== AUTOMATED RESOLUTION TEST ====================');
  await connectDB();

  try {
    // Find the customer we seeded (John Doe)
    const customer = await User.findOne({ email: 'john@example.com' });
    if (!customer) {
      console.error('[TEST FAILED] Customer John Doe not found. Please run seed script first: npm run seed');
      process.exit(1);
    }

    // Find the double charge order we seeded
    const order = await Order.findById('64c7e63b4f52ab1f5a111024');
    if (!order) {
      console.error('[TEST FAILED] Double charge order #1024 not found. Please run seed script first.');
      process.exit(1);
    }

    // Create a new dispute for double charge
    console.log('[TEST] Creating mock dispute: "I was charged twice for order #1024."');
    const dispute = await Dispute.create({
      orderId: order._id,
      userId: customer._id,
      category: 'DOUBLE_CHARGE', // Let classifier classify, but initialize to category
      description: 'I was charged twice for order #1024.',
      status: 'PENDING'
    });

    console.log(`[TEST] Dispute created with ID: ${dispute._id}. Triggering Resolver...`);

    // Run the resolver synchronously
    const resolvedDispute = await disputeResolver.resolve(dispute._id);

    console.log('--------------------------- RESULT ---------------------------');
    console.log(`Dispute Status     : ${resolvedDispute.status}`);
    console.log(`AI Classification  : ${resolvedDispute.aiClassification.category} (Confidence: ${resolvedDispute.aiClassification.confidence})`);
    console.log(`Resolution Action  : ${resolvedDispute.resolutionDetails.action}`);
    console.log(`Refunded Amount    : ₹${resolvedDispute.resolutionDetails.amount}`);
    console.log(`Refund Transaction : ${resolvedDispute.resolutionDetails.refundedPaymentId}`);
    console.log(`Message to Customer: "${resolvedDispute.resolutionDetails.message}"`);
    console.log('--------------------------------------------------------------');

    // Verify database updates
    const payments = await Payment.find({ orderId: order._id });
    console.log('[TEST] Payment transaction statuses:');
    payments.forEach(p => {
      console.log(`  - Transaction ${p.transactionId}: status=${p.status}, refundedAmount=₹${p.refundedAmount}`);
    });

    const updatedOrder = await Order.findById(order._id);
    console.log(`[TEST] Disputed Order Status: ${updatedOrder.status}`);

    // Print Automation Logs Timeline
    console.log('--------------------- AUTOMATION LOGS TIMELINE ---------------------');
    const logs = await AutomationLog.find({ disputeId: dispute._id }).sort({ timestamp: 1 });
    logs.forEach((log, index) => {
      const time = log.timestamp.toISOString().split('T')[1].slice(0, 8);
      console.log(`[${time}] [${log.status}] ${log.action}: ${log.message}`);
    });
    console.log('====================================================================');

    process.exit(0);
  } catch (error) {
    console.error('[TEST CRITICAL ERROR] Execution failed:', error);
    process.exit(1);
  }
};

runTest();
