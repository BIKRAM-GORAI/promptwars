import { Payment } from '../../models/Payment.js';
import { Order } from '../../models/Order.js';
import { Product } from '../../models/Product.js';

class MockPaymentService {
  async createPayment({ orderId, userId, amount, currency = 'INR', paymentMethod = 'MOCK_CARD' }) {
    const transactionId = `pay_mock_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
    
    // Fetch the order to perform stock deduction
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Deduct stock for each item in the order
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.stock = Math.max(0, product.stock - item.quantity);
        await product.save();
        console.log(`[PAYMENT MOCK] Successfully deducted stock for ${product.name}. Qty: -${item.quantity}. Remaining: ${product.stock}`);
      }
    }

    const payment = await Payment.create({
      orderId,
      userId,
      amount,
      currency,
      status: 'SUCCESS',
      transactionId,
      paymentMethod
    });

    // Update order status to DELIVERED and set deliveredAt to now for immediate dispute processing
    await Order.findByIdAndUpdate(orderId, {
      status: 'DELIVERED',
      deliveredAt: new Date(),
      paymentId: transactionId
    });

    console.log(`[PAYMENT MOCK] Created successful payment: ${transactionId} for Order ${orderId}`);
    return payment;
  }

  async getPayment(paymentId) {
    // Try finding by transactionId first, then by database ObjectId
    let payment = await Payment.findOne({ transactionId: paymentId });
    if (!payment) {
      try {
        payment = await Payment.findById(paymentId);
      } catch (err) {
        // Not a valid ObjectId
      }
    }
    return payment;
  }

  async getPaymentStatus(transactionId) {
    const payment = await Payment.findOne({ transactionId });
    return payment ? payment.status : 'NOT_FOUND';
  }

  async refundPayment(transactionId, refundAmount = null) {
    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      throw new Error(`Payment transaction ${transactionId} not found`);
    }

    if (payment.status === 'REFUNDED') {
      throw new Error(`Payment transaction ${transactionId} is already fully refunded`);
    }

    const amountToRefund = refundAmount === null ? payment.amount : refundAmount;

    if (amountToRefund > payment.amount - payment.refundedAmount) {
      throw new Error(`Refund amount ₹${amountToRefund} exceeds the refundable balance of ₹${payment.amount - payment.refundedAmount}`);
    }

    // Perform database updates
    payment.refundedAmount += amountToRefund;
    
    if (payment.refundedAmount >= payment.amount) {
      payment.status = 'REFUNDED';
      payment.refundStatus = 'SUCCESS';
    } else {
      payment.status = 'PARTIALLY_REFUNDED';
      payment.refundStatus = 'SUCCESS'; // Or keep pending/partially completed
    }

    await payment.save();

    // If fully refunded, also check and update the order status to REFUNDED
    if (payment.status === 'REFUNDED') {
      await Order.findByIdAndUpdate(payment.orderId, {
        status: 'REFUNDED'
      });
    }

    console.log(`[PAYMENT MOCK] Processed refund of ₹${amountToRefund} for transaction ${transactionId}. New status: ${payment.status}`);
    
    return {
      success: true,
      transactionId,
      refundedAmount: amountToRefund,
      status: payment.status,
      payment
    };
  }
}

export const mockPaymentService = new MockPaymentService();
export default mockPaymentService;
