import { paymentService } from '../services/payment/paymentService.js';
import { razorpayService } from '../services/payment/razorpayService.js';

export const createMockPayment = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    
    if (!orderId) {
      res.status(400);
      throw new Error('Order ID is required to process payment');
    }

    // Call payment service abstraction layer
    const payment = await paymentService.createPayment({
      orderId,
      userId: req.user._id,
      amount: req.body.amount,
      currency: req.body.currency || 'INR',
      paymentMethod: req.body.paymentMethod || 'MOCK_CARD'
    });

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
};

export const getPaymentById = async (req, res, next) => {
  try {
    const payment = await paymentService.getPayment(req.params.id);
    if (!payment) {
      res.status(404);
      throw new Error('Payment transaction not found');
    }
    res.status(200).json(payment);
  } catch (error) {
    next(error);
  }
};

export const createRazorpayOrder = async (req, res, next) => {
  try {
    const { orderId, amount } = req.body;
    if (!orderId || !amount) {
      res.status(400);
      throw new Error('Order ID and Amount are required');
    }

    const order = await razorpayService.createRazorpayOrder({ orderId, amount });
    res.status(201).json(order);
  } catch (error) {
    next(error);
  }
};

export const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { orderId, amount, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
    
    if (!orderId || !amount || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      res.status(400);
      throw new Error('Missing required verification fields');
    }

    const payment = await razorpayService.verifyPayment({
      orderId,
      userId: req.user._id,
      amount,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature
    });

    res.status(200).json({ success: true, payment });
  } catch (error) {
    next(error);
  }
};
