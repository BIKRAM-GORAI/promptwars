import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { Dispute } from '../models/Dispute.js';
import { AutomationLog } from '../models/AutomationLog.js';

const seed = async () => {
  console.log('[SEED] Starting database seeding...');
  const conn = await connectDB();
  if (!conn) {
    console.error('[SEED ERROR] Could not connect to database for seeding');
    process.exit(1);
  }

  try {
    // Clear all existing collections
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Payment.deleteMany({});
    await Dispute.deleteMany({});
    await AutomationLog.deleteMany({});

    console.log('[SEED] Cleared existing data');

    // 1. Seed Users
    const customer1 = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      role: 'CUSTOMER'
    });

    const customer2 = await User.create({
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'CUSTOMER'
    });

    const adminUser = await User.create({
      name: 'Admin System',
      email: 'admin@resolveai.com',
      role: 'ADMIN'
    });

    console.log('[SEED] Seeded Users:', { customer1: customer1._id, customer2: customer2._id, adminUser: adminUser._id });

    // 2. Seed Products
    const keyboard = await Product.create({
      name: 'Mechanical Keyboard',
      description: 'Premium mechanical keyboard with tactile blue switches and custom RGB backlighting.',
      price: 1499.00,
      image: '/images/products/keyboard.jpg',
      stock: 45,
      category: 'Electronics'
    });

    const mouse = await Product.create({
      name: 'Wireless Mouse',
      description: 'Ergonomic 2.4GHz wireless mouse with adjustable DPI and silent clicks.',
      price: 799.00,
      image: '/images/products/mouse.jpg',
      stock: 120,
      category: 'Electronics'
    });

    const headphones = await Product.create({
      name: 'Wireless Headphones',
      description: 'Over-ear active noise cancelling headphones with 40-hour battery life.',
      price: 2999.00,
      image: '/images/products/headphones.jpg',
      stock: 30,
      category: 'Electronics'
    });

    const monitor = await Product.create({
      name: '4K UltraHD Monitor',
      description: '27-inch IPS monitor with ultra-thin bezels and HDR10 support.',
      price: 14999.00,
      image: '/images/products/monitor.jpg',
      stock: 15,
      category: 'Electronics'
    });

    const webcam = await Product.create({
      name: '1080p HD Webcam',
      description: 'Full HD webcam with dual microphones and autofocus for streaming and meetings.',
      price: 1999.00,
      image: '/images/products/webcam.jpg',
      stock: 60,
      category: 'Electronics'
    });

    const stand = await Product.create({
      name: 'Aluminium Laptop Stand',
      description: 'Adjustable ergonomic laptop stand made of premium lightweight aluminium.',
      price: 999.00,
      image: '/images/products/stand.jpg',
      stock: 80,
      category: 'Accessories'
    });

    console.log('[SEED] Seeded Products');

    // 3. Seed Orders & Payments for Demo Scenarios

    // --- Scenario 1: Double Charge Demo ---
    // Customer 1 bought keyboard. Order is created. Two payments are recorded for this order.
    const doubleChargeOrder = await Order.create({
      _id: new mongoose.Types.ObjectId('64c7e63b4f52ab1f5a111024'), // Hex corresponding to order #1024 / similar
      userId: customer1._id,
      items: [{
        productId: keyboard._id,
        name: keyboard.name,
        quantity: 1,
        price: keyboard.price
      }],
      totalAmount: 1499.00,
      status: 'CONFIRMED',
      paymentId: 'pay_dc_1024_A',
      orderDate: new Date('2026-08-07T10:00:00Z'),
      deliveryDate: null
    });

    const payment1A = await Payment.create({
      orderId: doubleChargeOrder._id,
      userId: customer1._id,
      amount: 1499.00,
      currency: 'INR',
      status: 'SUCCESS',
      transactionId: 'pay_dc_1024_A',
      paymentMethod: 'MOCK_CARD_1',
      createdAt: new Date('2026-08-07T10:00:05Z')
    });

    const payment1B = await Payment.create({
      orderId: doubleChargeOrder._id,
      userId: customer1._id,
      amount: 1499.00,
      currency: 'INR',
      status: 'SUCCESS',
      transactionId: 'pay_dc_1024_B', // Duplicate transaction ID
      paymentMethod: 'MOCK_CARD_1',
      createdAt: new Date('2026-08-07T10:00:15Z')
    });

    console.log('[SEED] Seeded Scenario 1 (Double Charge Order #1024)');

    // --- Scenario 2: Payment successful but no order ---
    // Customer 1 made a payment for wireless mouse, but order got stuck or wasn't created.
    // We create a successful payment that doesn't correspond to any active confirmed/delivered order
    // (or orderId points to a mock order that was deleted/never finished, or a PENDING order with no items).
    // Let's create an order that is in 'PENDING' status, but has a successful payment.
    const orphanedOrder = await Order.create({
      userId: customer1._id,
      items: [{
        productId: mouse._id,
        name: mouse.name,
        quantity: 1,
        price: mouse.price
      }],
      totalAmount: 799.00,
      status: 'PENDING',
      paymentId: 'pay_orphaned_123',
      orderDate: new Date('2026-08-06T15:00:00Z')
    });

    const orphanedPayment = await Payment.create({
      orderId: orphanedOrder._id,
      userId: customer1._id,
      amount: 799.00,
      currency: 'INR',
      status: 'SUCCESS',
      transactionId: 'pay_orphaned_123',
      paymentMethod: 'MOCK_UPI',
      createdAt: new Date('2026-08-06T15:00:05Z')
    });

    console.log('[SEED] Seeded Scenario 2 (Payment successful, order stuck in PENDING)');

    // --- Scenario 3: Refund not received ---
    // Customer 2 bought laptop stand. Order was cancelled, and payment status is marked REFUNDED,
    // but customer claims refund was not received.
    const cancelledOrder = await Order.create({
      userId: customer2._id,
      items: [{
        productId: stand._id,
        name: stand.name,
        quantity: 1,
        price: stand.price
      }],
      totalAmount: 999.00,
      status: 'CANCELLED',
      paymentId: 'pay_cancelled_456',
      orderDate: new Date('2026-08-01T09:00:00Z')
    });

    const refundedPayment = await Payment.create({
      orderId: cancelledOrder._id,
      userId: customer2._id,
      amount: 999.00,
      currency: 'INR',
      status: 'REFUNDED',
      transactionId: 'pay_cancelled_456',
      paymentMethod: 'MOCK_NETBANKING',
      refundedAmount: 999.00,
      refundStatus: 'SUCCESS',
      createdAt: new Date('2026-08-01T09:00:05Z')
    });

    console.log('[SEED] Seeded Scenario 3 (Refund marked processed, customer says not received)');

    // --- Scenario 4: Eligible refund request ---
    // Customer 2 bought headphones, delivered 3 days ago. Within 7-day return window.
    const eligibleOrder = await Order.create({
      userId: customer2._id,
      items: [{
        productId: headphones._id,
        name: headphones.name,
        quantity: 1,
        price: headphones.price
      }],
      totalAmount: 2999.00,
      status: 'DELIVERED',
      paymentId: 'pay_eligible_789',
      orderDate: new Date('2026-08-03T11:00:00Z'),
      deliveryDate: new Date('2026-08-05T14:00:00Z')
    });

    const eligiblePayment = await Payment.create({
      orderId: eligibleOrder._id,
      userId: customer2._id,
      amount: 2999.00,
      currency: 'INR',
      status: 'SUCCESS',
      transactionId: 'pay_eligible_789',
      paymentMethod: 'MOCK_CARD_2',
      createdAt: new Date('2026-08-03T11:00:05Z')
    });

    console.log('[SEED] Seeded Scenario 4 (Eligible refund within window)');

    // --- Scenario 5: Expired refund request ---
    // Customer 2 bought webcam, delivered 19 days ago. Outside 7-day return window.
    const expiredOrder = await Order.create({
      userId: customer2._id,
      items: [{
        productId: webcam._id,
        name: webcam.name,
        quantity: 1,
        price: webcam.price
      }],
      totalAmount: 1999.00,
      status: 'DELIVERED',
      paymentId: 'pay_expired_101',
      orderDate: new Date('2026-07-18T10:00:00Z'),
      deliveryDate: new Date('2026-07-20T12:00:00Z')
    });

    const expiredPayment = await Payment.create({
      orderId: expiredOrder._id,
      userId: customer2._id,
      amount: 1999.00,
      currency: 'INR',
      status: 'SUCCESS',
      transactionId: 'pay_expired_101',
      paymentMethod: 'MOCK_UPI_2',
      createdAt: new Date('2026-07-18T10:00:05Z')
    });

    console.log('[SEED] Seeded Scenario 5 (Expired refund window)');

    // --- Scenario 6: Damaged product with evidence ---
    // Customer 1 bought keyboard. Delivered 2 days ago. Customer will upload photo.
    const damagedOrder = await Order.create({
      userId: customer1._id,
      items: [{
        productId: keyboard._id,
        name: keyboard.name,
        quantity: 1,
        price: keyboard.price
      }],
      totalAmount: 1499.00,
      status: 'DELIVERED',
      paymentId: 'pay_damaged_303',
      orderDate: new Date('2026-08-04T08:00:00Z'),
      deliveryDate: new Date('2026-08-06T15:00:00Z')
    });

    const damagedPayment = await Payment.create({
      orderId: damagedOrder._id,
      userId: customer1._id,
      amount: 1499.00,
      currency: 'INR',
      status: 'SUCCESS',
      transactionId: 'pay_damaged_303',
      paymentMethod: 'MOCK_CARD_1',
      createdAt: new Date('2026-08-04T08:00:05Z')
    });

    console.log('[SEED] Seeded Scenario 6 (Damaged product eligibility)');

    // --- Scenario 7: Ambiguous dispute ---
    // Customer 1 bought webcam. We will create a dispute that is pending.
    const ambiguousOrder = await Order.create({
      userId: customer1._id,
      items: [{
        productId: webcam._id,
        name: webcam.name,
        quantity: 1,
        price: webcam.price
      }],
      totalAmount: 1999.00,
      status: 'DELIVERED',
      paymentId: 'pay_ambiguous_404',
      orderDate: new Date('2026-08-05T08:00:00Z'),
      deliveryDate: new Date('2026-08-07T15:00:00Z')
    });

    const ambiguousPayment = await Payment.create({
      orderId: ambiguousOrder._id,
      userId: customer1._id,
      amount: 1999.00,
      currency: 'INR',
      status: 'SUCCESS',
      transactionId: 'pay_ambiguous_404',
      paymentMethod: 'MOCK_CARD_1',
      createdAt: new Date('2026-08-05T08:00:05Z')
    });

    console.log('[SEED] Seeded Scenario 7 (Ambiguous/Other)');

    console.log('[SEED] Database seeding completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error(`[SEED ERROR] Seeding failed: ${error.message}`);
    process.exit(1);
  }
};

seed();
