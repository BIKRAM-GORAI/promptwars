import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../../config/env.js';
import { Payment } from '../../models/Payment.js';
import { Order } from '../../models/Order.js';
import { Product } from '../../models/Product.js';

class RazorpayService {
  constructor() {
    this.razorpay = null;
    if (env.razorpay.keyId && env.razorpay.keySecret) {
      this.razorpay = new Razorpay({
        key_id: env.razorpay.keyId,
        key_secret: env.razorpay.keySecret
      });
      console.log('[PAYMENT] Razorpay client initialized successfully.');
    } else {
      console.warn('[PAYMENT WARNING] Razorpay credentials missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in env.');
    }
  }

  /**
   * Create a Razorpay Order
   */
  async createRazorpayOrder({ orderId, amount }) {
    if (!this.razorpay) {
      throw new Error('Razorpay service is not configured');
    }

    const options = {
      amount: Math.round(amount * 100), // Amount in paise
      currency: 'INR',
      receipt: orderId.toString(),
      payment_capture: 1 // Auto-capture payments
    };

    try {
      const order = await this.razorpay.orders.create(options);
      console.log(`[PAYMENT] Created Razorpay order: ${order.id} for Order ID: ${orderId}`);
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      };
    } catch (error) {
      console.error(`[PAYMENT ERROR] Razorpay order creation failed: ${error.message}`);
      throw new Error(`Razorpay order creation failed: ${error.message}`);
    }
  }

  /**
   * Verify Razorpay Payment Signature and confirm purchase
   */
  async verifyPayment({ orderId, userId, amount, razorpayPaymentId, razorpayOrderId, razorpaySignature, paymentMethod = 'RAZORPAY' }) {
    if (!this.razorpay) {
      throw new Error('Razorpay service is not configured');
    }

    // Verify signature
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const generated_signature = crypto
      .createHmac('sha256', env.razorpay.keySecret)
      .update(text)
      .digest('hex');

    if (generated_signature !== razorpaySignature) {
      console.error('[PAYMENT ERROR] Invalid signature digest verification failed');
      throw new Error('Payment signature verification failed. Possible fraud attempt.');
    }

    console.log(`[PAYMENT] Signature verified successfully for payment: ${razorpayPaymentId}`);

    // Fetch the order to perform stock deduction
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status === 'CONFIRMED') {
      console.log(`[PAYMENT] Order ${orderId} is already paid.`);
      const existingPayment = await Payment.findOne({ orderId });
      return existingPayment;
    }

    // Deduct stock for each item in the order
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (product) {
        product.stock = Math.max(0, product.stock - item.quantity);
        await product.save();
        console.log(`[PAYMENT] Deducted stock for ${product.name}. Qty: -${item.quantity}. Remaining: ${product.stock}`);
      }
    }

    // Create the Payment Record
    const payment = await Payment.create({
      orderId,
      userId,
      amount,
      currency: 'INR',
      status: 'SUCCESS',
      transactionId: razorpayPaymentId,
      paymentMethod,
      gatewayResponse: {
        razorpayOrderId,
        razorpaySignature
      }
    });

    // Update order status to DELIVERED and set deliveredAt to now for immediate dispute processing
    order.status = 'DELIVERED';
    order.deliveredAt = new Date();
    order.paymentId = razorpayPaymentId;
    await order.save();

    console.log(`[PAYMENT] Order ${orderId} confirmed via Razorpay. Transaction ID: ${razorpayPaymentId}`);
    return payment;
  }

  /**
   * Execute refund via Razorpay (called by Dispute Resolver auto-resolution workflows)
   */
  async refundPayment(paymentId, amount) {
    if (!this.razorpay) {
      throw new Error('Razorpay service is not configured');
    }

    try {
      console.log(`[PAYMENT] Requesting Razorpay refund for Payment ID ${paymentId} of amount ₹${amount}`);
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: Math.round(amount * 100) // Amount in paise
      });
      console.log(`[PAYMENT] Razorpay refund succeeded. Refund ID: ${refund.id}`);
      return refund.id;
    } catch (error) {
      console.error(`[PAYMENT ERROR] Razorpay refund failed: ${error.message}`);
      throw new Error(`Razorpay refund failed: ${error.message}`);
    }
  }
}

export const razorpayService = new RazorpayService();
