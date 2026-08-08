import assert from 'assert';
import test from 'node:test';
import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import policyEngine from '../services/dispute/policyEngine.js';

// Setup mock methods for unit testing Mongoose models without actual database connection
test('PolicyEngine - Double Charge Eligibility Verification', async (t) => {
  const engine = policyEngine;

  await t.test('should decline double charge eligibility if the order does not exist', async () => {
    // Temporarily mock Order.findById to return null
    const originalFindById = Order.findById;
    Order.findById = async () => null;

    const result = await engine.checkDoubleChargeEligibility('660d2b271a2b2c3d4e5f6g7h');
    
    assert.strictEqual(result.eligible, false);
    assert.strictEqual(result.reason, 'Order not found');

    // Restore
    Order.findById = originalFindById;
  });

  await t.test('should decline if less than 2 successful payments are found for the order', async () => {
    const originalFindById = Order.findById;
    Order.findById = async () => ({ _id: 'order_123', totalAmount: 1499.00 });

    const originalFind = Payment.find;
    Payment.find = async () => [
      { amount: 1499.00, status: 'SUCCESS', transactionId: 'tx_1' }
    ];

    const result = await engine.checkDoubleChargeEligibility('order_123');

    assert.strictEqual(result.eligible, false);
    assert.match(result.reason, /Insufficient successful payments/);

    Order.findById = originalFindById;
    Payment.find = originalFind;
  });

  await t.test('should decline if transaction amounts do not match', async () => {
    const originalFindById = Order.findById;
    Order.findById = async () => ({ _id: 'order_123', totalAmount: 1499.00 });

    const originalFind = Payment.find;
    Payment.find = async () => [
      { amount: 1499.00, status: 'SUCCESS', transactionId: 'tx_1' },
      { amount: 1200.00, status: 'SUCCESS', transactionId: 'tx_2' }
    ];

    const result = await engine.checkDoubleChargeEligibility('order_123');

    assert.strictEqual(result.eligible, false);
    assert.match(result.reason, /amounts do not match/);

    Order.findById = originalFindById;
    Payment.find = originalFind;
  });

  await t.test('should approve duplicate payment within auto-refund policy limits', async () => {
    const originalFindById = Order.findById;
    Order.findById = async () => ({ _id: 'order_123', totalAmount: 1499.00 });

    const originalFind = Payment.find;
    Payment.find = async () => [
      { amount: 1499.00, status: 'SUCCESS', transactionId: 'tx_1' },
      { amount: 1499.00, status: 'SUCCESS', transactionId: 'tx_2' }
    ];

    const result = await engine.checkDoubleChargeEligibility('order_123');

    assert.strictEqual(result.eligible, true);
    assert.match(result.reason, /Duplicate payments verified/);
    assert.strictEqual(result.duplicatePayment.transactionId, 'tx_2');

    Order.findById = originalFindById;
    Payment.find = originalFind;
  });
});
