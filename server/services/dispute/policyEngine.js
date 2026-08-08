import { Order } from '../../models/Order.js';
import { Payment } from '../../models/Payment.js';
import { env } from '../../config/env.js';

const HIGH_RISK_REQUIRES_REVIEW = true;

class PolicyEngine {
  /**
   * Check if double charge claims are eligible for automatic refund
   */
  async checkDoubleChargeEligibility(orderId) {
    // 1. Retrieve order
    const order = await Order.findById(orderId);
    if (!order) {
      return { eligible: false, reason: 'Order not found' };
    }

    // 2. Retrieve all successful payments for the order
    const payments = await Payment.find({
      orderId: order._id,
      status: 'SUCCESS'
    });

    if (payments.length < 2) {
      return {
        eligible: false,
        reason: `Insufficient successful payments found. Expected at least 2, found ${payments.length}`
      };
    }

    // 3. Confirm duplicate payment exists (having same amount and same order)
    const originalPayment = payments[0];
    const duplicatePayment = payments[1];

    if (originalPayment.amount !== duplicatePayment.amount) {
      return {
        eligible: false,
        reason: 'Payments exist but amounts do not match, requiring manual review'
      };
    }

    // 4. Check auto refund limit (from env)
    if (duplicatePayment.amount > env.autoRefundLimit) {
      return {
        eligible: false,
        reason: `Payment amount ₹${duplicatePayment.amount} exceeds auto-refund threshold of ₹${env.autoRefundLimit}`
      };
    }

    return {
      eligible: true,
      reason: 'Duplicate payments verified and within auto-refund threshold',
      duplicatePayment,
      originalPayment
    };
  }

  /**
   * Check standard refund eligibility (e.g. REFUND_REQUEST)
   */
  async checkRefundRequestEligibility(orderId, productId = null) {
    const order = await Order.findById(orderId);
    if (!order) {
      return { eligible: false, reason: 'Order not found' };
    }

    if (order.status !== 'DELIVERED') {
      return {
        eligible: false,
        reason: `Order is not eligible for refund because status is '${order.status}' (expected 'DELIVERED')`
      };
    }

    // Check deliveryDate or deliveredAt fallback
    const deliveryDate = order.deliveredAt || order.deliveryDate;
    if (!deliveryDate) {
      return {
        eligible: false,
        reason: 'Order delivery date is missing, cannot verify refund window'
      };
    }

    // Check return/refund window (from env)
    const timeDiff = Date.now() - new Date(deliveryDate).getTime();
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

    if (daysDiff > env.returnWindowDays) {
      return {
        eligible: false,
        reason: `Refund request expired. Delivery was ${Math.floor(daysDiff)} days ago, which exceeds the ${env.returnWindowDays}-day return window`
      };
    }

    // Check if order is already refunded
    if (order.status === 'REFUNDED') {
      return {
        eligible: false,
        reason: 'Order is already marked as refunded'
      };
    }

    // Check if a success payment exists
    const payment = await Payment.findOne({ orderId: order._id, status: 'SUCCESS' });
    if (!payment) {
      return {
        eligible: false,
        reason: 'No successful payment transaction found for this order'
      };
    }

    // Calculate actual refund amount to check limit
    let refundAmount = order.totalAmount;
    if (productId && productId !== 'ALL') {
      const item = order.items.find(i => i.productId.toString() === productId.toString());
      if (item) {
        refundAmount = item.price * item.quantity;
      }
    }

    // Check auto-refund amount limit (from env)
    if (refundAmount > env.autoRefundLimit) {
      return {
        eligible: false,
        reason: `Disputed refund amount ₹${refundAmount} exceeds auto-refund threshold of ₹${env.autoRefundLimit}`
      };
    }

    return {
      eligible: true,
      reason: `Eligible for return: within ${env.returnWindowDays}-day refund window`,
      payment
    };
  }

  /**
   * Check if return window has expired (polymorphic to handle Date strings, Date objects, or Order objects)
   */
  isReturnWindowExpired(dateOrOrder) {
    if (!dateOrOrder) return false; // Default to eligible if dates are missing

    let dateVal;
    if (dateOrOrder instanceof Date) {
      dateVal = dateOrOrder;
    } else if (typeof dateOrOrder === 'object') {
      // It's a Mongoose or standard Order object!
      dateVal = dateOrOrder.deliveredAt || dateOrOrder.deliveryDate;
    } else {
      // It's a date string or timestamp
      dateVal = new Date(dateOrOrder);
    }

    if (!dateVal || isNaN(new Date(dateVal).getTime())) {
      return false; // Default to not expired if date parsing fails
    }

    const timeDiff = Date.now() - new Date(dateVal).getTime();
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    return daysDiff > env.returnWindowDays;
  }
}

export const policyEngine = new PolicyEngine();
export default policyEngine;
